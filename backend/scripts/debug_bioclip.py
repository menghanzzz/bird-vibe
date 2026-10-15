#!/usr/bin/env python3
"""
BioCLIP 单图全链路分步计时诊断。

用法（backend/venv 的 python，从 backend/ 目录跑）：
  venv/bin/python scripts/debug_bioclip.py eval_photos/1.jpg [eval_photos/5.jpg ...]

逐步骤计时：PIL 打开+load → RGB 转换 → 模型预处理(transforms) → 图像编码 →
文本相似度排序 → 完整 recognize() 对照。单步超过 30s 判定卡死并终止诊断。
"""
import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # 让 bioclip_service 可导入

STEP_TIMEOUT = 30
MODEL_LOAD_TIMEOUT = 120


def timed_step(label, fn, timeout=STEP_TIMEOUT):
    """单步计时 + 超时保护：超过 timeout 秒打印卡死步骤并退出(2)。"""
    t0 = time.time()
    ex = ThreadPoolExecutor(max_workers=1)
    fut = ex.submit(fn)
    try:
        result = fut.result(timeout=timeout)
    except FutureTimeout:
        print(f"  ✗ {label}: 超过 {timeout}s 未返回 —— 卡死环节定位到此")
        sys.exit(2)
    finally:
        ex.shutdown(wait=False)
    dt = time.time() - t0
    print(f"  ✓ {label}: {dt * 1000:.0f}ms")
    return result


def diagnose(image_path: str) -> None:
    p = Path(image_path)
    print(f"\n══════════ {p} ({p.stat().st_size / 1024:.0f}KB) ══════════")

    import bioclip_service as bs

    # ── 0. 元信息（不解码像素） ──
    from PIL import Image
    with Image.open(p) as probe:
        print(f"  [meta] format={probe.format} mode={probe.mode} size={probe.size} "
              f"frames={getattr(probe, 'n_frames', 1)} progressive={probe.info.get('progressive')}")

    # ── 1. PIL 打开 + load（解码全图） ──
    def step_open():
        img = Image.open(p)
        img.load()          # 强制解码
        return img
    img = timed_step("PIL Image.open + load()", step_open)

    # ── 2. RGB 转换 ──
    img_rgb = timed_step("convert('RGB')", lambda: img.convert("RGB"))

    # ── 3. 模型加载（含文本缓存预热，放宽超时） ──
    def step_model():
        m = bs._get_model()
        bs._load_kb_labels()  # 触发文本特征缓存
        return m
    model, preprocess, tokenizer, device = timed_step("BioCLIP 模型加载（含文本特征缓存）", step_model,
                                                      timeout=MODEL_LOAD_TIMEOUT)
    labels, bird_of_label = bs._load_kb_labels()
    print(f"  [info] labels={len(labels)}（{len(set(bird_of_label))} 种鸟） device={device}")

    # ── 4. 预处理 transforms（resize/crop/normalize） ──
    tensor = timed_step("preprocess transforms", lambda: preprocess(img_rgb).unsqueeze(0).to(device))

    # ── 5. 图像编码 encode_image ──
    import torch
    def step_encode():
        with torch.no_grad():
            feats = model.encode_image(tensor)
            return (feats / feats.norm(dim=-1, keepdim=True)).cpu()
    image_features = timed_step("encode_image（图像编码）", step_encode)

    # ── 6. 文本相似度排序 ──
    def step_rank():
        tokens = tokenizer(labels).to(device)
        with torch.no_grad():
            tf = model.encode_text(tokens)
            tf = tf / tf.norm(dim=-1, keepdim=True)
            probs = ((image_features.to(device) @ tf.T) * model.logit_scale.exp()).softmax(dim=-1).squeeze(0)
        top = probs.shape[0]
        scores, idxs = torch.topk(probs, min(5, top))
        return [(bird_of_label[i], round(s, 4)) for s, i in zip(scores.tolist(), idxs.tolist())]
    ranked = timed_step("文本相似度排序 top5", step_rank)
    print(f"  [top5] {ranked}")

    # ── 7. 完整 recognize() 对照 ──
    timed_step("完整 recognize() 对照", lambda: bs.recognize(str(p)))


def main():
    ap = argparse.ArgumentParser(description="BioCLIP 单图分步计时诊断")
    ap.add_argument("images", nargs="+", help="图片路径（可多张，首张为问题图，其余为对照）")
    args = ap.parse_args()
    for img in args.images:
        diagnose(img)
    print("\n诊断完成，未触发单步超时。")


if __name__ == "__main__":
    main()
