#!/usr/bin/env python3
"""
BioCLIP 微调脚本（设计运行环境：AutoDL Linux + NVIDIA GPU；本地 CPU 可跑冒烟）。

- 基座：open_clip_torch 加载 imageomics/bioclip（ViT-B/16）预训练权重
- 数据：training_data/ 按 manifest.json 读取（自动跳过 error/insufficient 物种）
- 标签：每个物种两个文本标签（拉丁学名 + 中文名，与 bioclip_service 同模板），
  物种文本原型 = 两个标签 embedding 的均值；训练目标是 48 类（以实际物种数为准）交叉熵
- 默认超参（8G 显存适配）：batch 32 / AdamW lr 1e-5 / cosine 衰减 warmup 5% /
  AMP 混合精度 / epoch 20 / early stopping(val top-1, patience 5)
- 产出（--output-dir）：model_finetuned.pt（纯 tensor state_dict，供 bioclip_service
  经 BIRD_CLIP_CHECKPOINT 加载）/ train_log.json / val_report.json

用法（AutoDL）：
  python finetune_bioclip.py --data-dir ./training_data --output-dir ./finetune_output
本地冒烟：
  venv/bin/python scripts/finetune_bioclip.py --epochs 1 --batch-size 2 --limit-species 2 \
      --output-dir /tmp/ft_smoke
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEXT_TEMPLATE = "a photo of a {}, a type of bird"  # 与 bioclip_service._PROMPT_TEMPLATE 保持一致

DEFAULT_DATA_DIR = BACKEND_DIR / "training_data"
DEFAULT_OUTPUT_DIR = BACKEND_DIR / "finetune_output"

# 默认超参（8G 显存适配）
DEFAULT_BATCH = 32
DEFAULT_LR = 1e-5
DEFAULT_EPOCHS = 20
WARMUP_RATIO = 0.05
PATIENCE = 5
SEED = 42


def load_species_and_files(data_dir: Path, limit_species: int | None = None):
    """从 manifest 读物种清单与 train/val 文件列表（跳过 error/insufficient）。"""
    manifest = json.loads((data_dir / "manifest.json").read_text(encoding="utf-8"))
    species_rows = []
    for name, rec in (manifest.get("species") or {}).items():
        if rec.get("error") or rec.get("insufficient"):
            continue
        images = rec.get("images") or []
        latin = rec.get("taxon_name") or rec.get("queried_latin") or ""
        chinese = name
        train_files = [data_dir / e["file"] for e in images if "/train/" in e["file"] and (data_dir / e["file"]).exists()]
        val_files = [data_dir / e["file"] for e in images if "/val/" in e["file"] and (data_dir / e["file"]).exists()]
        if not train_files:
            continue
        species_rows.append({
            "name": chinese, "latin": latin, "chinese": chinese,
            "train": train_files, "val": val_files,
        })
    species_rows.sort(key=lambda r: r["name"])
    if limit_species:
        species_rows = species_rows[:limit_species]
    return species_rows


class BirdDataset(Dataset):
    def __init__(self, rows, preprocess, split: str):
        self.samples = []
        for idx, row in enumerate(rows):
            for f in row[split]:
                self.samples.append((f, idx))
        self.preprocess = preprocess

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, i):
        from PIL import Image
        path, label = self.samples[i]
        img = Image.open(path).convert("RGB")
        return self.preprocess(img), label


def build_text_features(model, tokenizer, device, rows) -> torch.Tensor:
    """每个物种两个标签（拉丁+中文），embedding 归一化后取均值 → (n_species, dim)。"""
    labels = []
    for r in rows:
        labels.append(TEXT_TEMPLATE.format(r["latin"] or r["chinese"]))
        labels.append(TEXT_TEMPLATE.format(r["chinese"]))
    with torch.no_grad():
        tokens = tokenizer(labels).to(device)
        feats = model.encode_text(tokens)
        feats = feats / feats.norm(dim=-1, keepdim=True)
    n = len(rows)
    prototypes = (feats[0::2] + feats[1::2]) / 2  # 两个标签均值
    prototypes = prototypes / prototypes.norm(dim=-1, keepdim=True)
    return prototypes  # (n_species, dim)


@torch.no_grad()
def evaluate(model, loader, prototypes, device, amp: bool, rows, logit_scale) -> tuple[float, dict]:
    """返回 (top1 准确率, 按物种统计 {name: {total, correct}})。"""
    model.eval()
    correct, total = 0, 0
    per = {r["name"]: {"total": 0, "correct": 0} for r in rows}
    for images, targets in loader:
        images, targets = images.to(device), targets.to(device)
        with torch.cuda.amp.autocast(enabled=amp):
            feats = model.encode_image(images)
        feats = feats / feats.norm(dim=-1, keepdim=True)
        logits = (feats @ prototypes.T) * logit_scale
        preds = logits.argmax(dim=1)
        for t, p in zip(targets.tolist(), preds.tolist()):
            per[rows[t]["name"]]["total"] += 1
            if t == p:
                per[rows[t]["name"]]["correct"] += 1
                correct += 1
            total += 1
    model.train()
    return (correct / total if total else 0.0), per


def main():
    ap = argparse.ArgumentParser(description="BioCLIP 微调（AutoDL GPU / 本地冒烟）")
    ap.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    ap.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    ap.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    ap.add_argument("--batch-size", type=int, default=DEFAULT_BATCH)
    ap.add_argument("--lr", type=float, default=DEFAULT_LR)
    ap.add_argument("--limit-species", type=int, default=None, help="只用前 N 个物种（冒烟调试用）")
    ap.add_argument("--num-workers", type=int, default=2)
    args = ap.parse_args()

    data_dir, out_dir = Path(args.data_dir), Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    torch.manual_seed(SEED)

    import open_clip
    device = "cuda" if torch.cuda.is_available() else "cpu"
    amp = device == "cuda"
    print(f"device={device} amp={amp} data={data_dir}")

    rows = load_species_and_files(data_dir, args.limit_species)
    if len(rows) < 2:
        raise SystemExit(f"✗ 可用物种不足 2 个（data_dir={data_dir}），无法训练")
    print(f"物种 {len(rows)} 个：" + "、".join(r["name"] for r in rows[:8]) + (" …" if len(rows) > 8 else ""))

    model, _, preprocess = open_clip.create_model_and_transforms("hf-hub:imageomics/bioclip")
    tokenizer = open_clip.get_tokenizer("hf-hub:imageomics/bioclip")
    model = model.to(device)
    logit_scale = model.logit_scale.exp().detach()

    prototypes = build_text_features(model, tokenizer, device, rows)

    train_ds = BirdDataset(rows, preprocess, "train")
    val_ds = BirdDataset(rows, preprocess, "val")
    train_ld = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                          num_workers=args.num_workers, drop_last=False)
    val_ld = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False,
                        num_workers=args.num_workers) if len(val_ds) else None
    print(f"train {len(train_ds)} 张 / val {len(val_ds)} 张")

    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    total_steps = max(1, len(train_ld) * args.epochs)
    warmup_steps = max(1, int(total_steps * WARMUP_RATIO))

    def lr_lambda(step):
        if step < warmup_steps:
            return step / warmup_steps
        progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)
        return 0.5 * (1 + math.cos(math.pi * progress))

    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)
    scaler = torch.cuda.amp.GradScaler(enabled=amp)

    ckpt_path = out_dir / "model_finetuned.pt"
    log_path = out_dir / "train_log.json"
    history = []
    best_top1, best_epoch, bad_epochs = -1.0, -1, 0

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        model.train()
        running, seen = 0.0, 0
        for images, targets in train_ld:
            images, targets = images.to(device), targets.to(device)
            optimizer.zero_grad(set_to_none=True)
            with torch.cuda.amp.autocast(enabled=amp):
                feats = model.encode_image(images)
                feats = feats / feats.norm(dim=-1, keepdim=True)
                logits = (feats @ prototypes.T) * logit_scale
                loss = F.cross_entropy(logits, targets)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            scheduler.step()
            running += loss.item() * images.size(0)
            seen += images.size(0)

        train_loss = running / max(1, seen)
        val_top1, _ = evaluate(model, val_ld, prototypes, device, amp, rows, logit_scale) if val_ld else (float("nan"), {})
        rec = {"epoch": epoch, "train_loss": round(train_loss, 5),
               "val_top1": round(val_top1, 5) if val_ld else None,
               "lr": scheduler.get_last_lr()[0], "seconds": round(time.time() - t0, 1)}
        history.append(rec)
        log_path.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")

        improved = val_ld and val_top1 > best_top1
        if improved:
            best_top1, best_epoch, bad_epochs = val_top1, epoch, 0
            torch.save(model.state_dict(), ckpt_path)  # 纯 tensor，供 weights_only 加载
        else:
            bad_epochs += 1
        print(f"[epoch {epoch:02d}] train_loss={rec['train_loss']:.4f} "
              f"val_top1={rec['val_top1'] if val_ld else 'n/a'} lr={rec['lr']:.2e} "
              f"({rec['seconds']}s)" + ("  ★best" if improved else ""))

        if bad_epochs >= PATIENCE:
            print(f"early stopping：连续 {PATIENCE} 个 epoch 无提升（best epoch {best_epoch} val_top1 {best_top1:.4f}）")
            break

    # 用最优权重出 val 分类报告
    if ckpt_path.exists():
        model.load_state_dict(torch.load(ckpt_path, map_location=device, weights_only=True))
    prototypes = build_text_features(model, tokenizer, device, rows)
    _, per = evaluate(model, val_ld, prototypes, device, amp, rows, logit_scale) if val_ld else (0, {})
    report = {
        "best_epoch": best_epoch, "best_val_top1": best_top1,
        "species": {name: {**st, "accuracy": round(st["correct"] / st["total"], 4) if st["total"] else None}
                    for name, st in per.items()},
    }
    (out_dir / "val_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n完成：best epoch {best_epoch} val_top1 {best_top1:.4f}")
    print(f"checkpoint -> {ckpt_path}")
    print(f"train_log  -> {log_path}")
    print(f"val_report -> {out_dir / 'val_report.json'}")
    bottom = sorted(report["species"].items(), key=lambda kv: (kv[1]["accuracy"] is None, kv[1]["accuracy"] or 0))[:5]
    print("val 准确率最低 5 类：" + "、".join(f"{k} {v['accuracy']}" for k, v in bottom))


if __name__ == "__main__":
    main()
