"""
BioCLIP 识别服务：识别管道第一级（专门模型），与千问（通用大模型兜底）组成混合架构。

- 模型：imageomics/bioclip（HuggingFace，ViT-B/16，约 350MB），首次加载自动下载到 HF 本地缓存
- 设备自动选择：Apple Silicon 用 MPS，回退 CPU
- 标签：knowledge_base/ 全部鸟种动态读取（rag_service.get_bird_metadata），
  每只鸟两个文本标签（拉丁学名 + 中文名），与 BioCLIP 训练格式一致
- 预处理：open_clip 的 model transforms（resize/bicubic + center crop 224 + ImageNet normalize），
  与 BioCLIP 训练预处理一致
- 阈值兜底：top1 分数低于 SCORE_THRESHOLD 判定为"知识库外的鸟"，
  由 main.py 回退千问 free 识别（开放集发现能力不丢）
- 模型加载失败抛 BioCLIPUnavailableError，由调用方回退千问并打日志
"""
from __future__ import annotations

import os
import threading
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from pathlib import Path
from typing import Optional

try:
    import torch
    _TORCH_IMPORT_ERROR = None
except Exception as e:  # torch 未安装/平台无对应 wheel 时，服务优雅降级为"不可用"，由调用方回退千问
    torch = None
    _TORCH_IMPORT_ERROR = f"{type(e).__name__}: {e}"

# ── HuggingFace 网络防护（须在 huggingface_hub 首次 import 前设置，其常量在 import 时固化）──
# 症状：huggingface_hub 每次加载权重都会发远端 HEAD 检查；网络不通时按 10s×5 次重试退避，
# 最多卡 ~155s——batch_eval 中"某张图识别 >120s、其他图正常"的真凶（与图片本身无关，
# 只是首次触发模型加载的那张图背锅）。本机已实测复现。
# 对策：权重已在本地缓存时进程内切 HF_HUB_OFFLINE=1（跳过一切远端检查）；
# 未缓存时保持在线（允许首次下载），仅把 etag/下载超时收紧到 5s/15s 做纵深防御。
os.environ.setdefault("HF_HUB_ETAG_TIMEOUT", "5")
os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "15")
# 注意：必须在本模块内任何 huggingface_hub import 之前设好 HF_HUB_OFFLINE（其常量在 import 时固化），
# 因此缓存路径手写解析（HF_HUB_CACHE → HF_HOME → 默认 ~/.cache/huggingface），不 import huggingface_hub。
_hf_cache_root = os.environ.get("HF_HUB_CACHE") or os.path.join(
    os.environ.get("HF_HOME", os.path.expanduser("~/.cache/huggingface")), "hub")
_cache_dir = Path(_hf_cache_root) / "models--imageomics--bioclip"
try:
    if _cache_dir.exists() and (any(_cache_dir.rglob("*.bin")) or any(_cache_dir.rglob("*.safetensors"))):
        os.environ["HF_HUB_OFFLINE"] = "1"
except Exception:
    pass

# top1 分数低于此阈值 → 判定知识库外的鸟，走千问兜底（可调常量）
# 0.40 为 348 张评测集的 risk-coverage 扫描结论（2026-10-14）：混合系统 top1 在 0.40 处最优
# （75.0% vs 0.20 的 74.4%），且能拦下 8/11 次 BioCLIP 在 OOD 图上的自信幻觉；>0.55 后过度拒绝反而更差
SCORE_THRESHOLD = 0.40

# 单图推理 wall-clock 超时（秒）：超时抛 BioCLIPUnavailableError，由 main.py 走千问兜底。
# 仅约束图像编码+排序；模型首次加载（权重读盘/下载）不计入。
INFERENCE_TIMEOUT_SECONDS = 30

_MODEL_ID = "hf-hub:imageomics/bioclip"
# BioCLIP 训练使用的提示模板（物种级标签）
_PROMPT_TEMPLATE = "a photo of a {}, a type of bird"


class BioCLIPUnavailableError(RuntimeError):
    """BioCLIP 模型不可用（加载失败/未安装依赖），调用方应回退千问。"""


_lock = threading.Lock()
_state = {"model": None, "preprocess": None, "tokenizer": None, "device": None, "error": None}
_text_feature_cache: dict = {}  # {labels_key: text_features}，KB 变化即以新 key 自然生效


def _pick_device() -> str:
    if torch is None:
        return "cpu"
    try:
        if torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def _get_model():
    """惰性加载 BioCLIP（线程安全）。已失败则直接抛 BioCLIPUnavailableError，不重复尝试。"""
    with _lock:
        if _state["error"] is not None:
            raise BioCLIPUnavailableError(_state["error"])
        if _state["model"] is not None:
            return _state["model"], _state["preprocess"], _state["tokenizer"], _state["device"]
        if _TORCH_IMPORT_ERROR is not None:
            _state["error"] = f"torch 不可用: {_TORCH_IMPORT_ERROR}"
            print(f"⚠️ [bioclip] {_state['error']}")
            raise BioCLIPUnavailableError(_state["error"])
        try:
            import open_clip
            device = _pick_device()
            model, _, preprocess = open_clip.create_model_and_transforms(_MODEL_ID)
            # 微调权重（BIRD_CLIP_CHECKPOINT → finetune_bioclip.py 产出的 model_finetuned.pt）；
            # 加载失败回落预训练权重并 WARNING，服务可用性不受影响
            ckpt = os.environ.get("BIRD_CLIP_CHECKPOINT")
            if ckpt:
                try:
                    state = torch.load(ckpt, map_location="cpu", weights_only=True)
                    if isinstance(state, dict) and "model_state_dict" in state:
                        state = state["model_state_dict"]
                    model.load_state_dict(state, strict=True)
                    print(f"[bioclip] 已加载微调权重: {ckpt}")
                except Exception as e:
                    print(f"⚠️ WARNING: 微调权重加载失败（{type(e).__name__}: {e}），"
                          f"回落 imageomics/bioclip 预训练权重")
            model = model.to(device).eval()
            tokenizer = open_clip.get_tokenizer(_MODEL_ID)
            _state.update(model=model, preprocess=preprocess, tokenizer=tokenizer, device=device)
            print(f"[bioclip] 模型加载成功 device={device}（id={_MODEL_ID}）")
            return model, preprocess, tokenizer, device
        except Exception as e:
            _state["error"] = f"{type(e).__name__}: {e}"
            print(f"⚠️ [bioclip] 模型加载失败: {_state['error']}")
            raise BioCLIPUnavailableError(_state["error"])


def is_available() -> bool:
    try:
        _get_model()
        return True
    except BioCLIPUnavailableError:
        return False


def get_failure_reason() -> Optional[str]:
    return _state["error"]


def _load_kb_labels() -> tuple[list[str], list[str]]:
    """动态读取知识库全部鸟种，每只鸟生成两个标签（拉丁学名、中文名），返回 (labels, 标签对应的鸟名)。"""
    from rag_service import get_bird_metadata
    labels: list[str] = []
    bird_of_label: list[str] = []
    for m in get_bird_metadata():
        latin = (m.get("latinName") or "").strip()
        chinese = (m.get("name") or "").strip()
        if latin:
            labels.append(_PROMPT_TEMPLATE.format(latin))
            bird_of_label.append(chinese)
        if chinese:
            labels.append(_PROMPT_TEMPLATE.format(chinese))
            bird_of_label.append(chinese)
    return labels, bird_of_label


def recognize(image_path: str, top_k: int = 5) -> dict:
    """
    BioCLIP 推理：图片 vs 知识库全部鸟种双标签的相似度排序。

    返回 {
        "top_k":     [{"name": 中文鸟名, "label": 命中标签, "score": float}],  # 按分数降序
        "top1_below_threshold": bool,   # top1 < SCORE_THRESHOLD 或为空
        "threshold": float,
        "matched_species_count": int,   # 参与匹配的鸟种数
    }
    知识库为空时 top_k 为空且 top1_below_threshold=True（调用方走千问兜底）。
    """
    model, preprocess, tokenizer, device = _get_model()

    labels, bird_of_label = _load_kb_labels()
    if not labels:
        return {"top_k": [], "top1_below_threshold": True, "threshold": SCORE_THRESHOLD,
                "matched_species_count": 0}

    # 文本特征（按 labels 缓存；KB 内容变化会产生新 key，旧缓存自然废弃）
    cache_key = tuple(labels)
    text_features = _text_feature_cache.get(cache_key)
    if text_features is None:
        with torch.no_grad():
            tokens = tokenizer(labels).to(device)
            feats = model.encode_text(tokens)
            feats = feats / feats.norm(dim=-1, keepdim=True)
        _text_feature_cache.clear()
        _text_feature_cache[cache_key] = feats
        text_features = feats

    # 图像推理：worker 线程 + wall-clock 超时保护；超时抛 BioCLIPUnavailableError 由 main.py 走千问兜底。
    # （超时线程无法强杀会自行跑完，请求侧已先返回，不会挂住请求。）
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(
        _encode_and_rank, model, preprocess, image_path, text_features, labels, bird_of_label, device, top_k
    )
    try:
        top_k_list, below, matched = future.result(timeout=INFERENCE_TIMEOUT_SECONDS)
    except FutureTimeout:
        print(f"⚠️ [bioclip] 单图推理超过 {INFERENCE_TIMEOUT_SECONDS}s 未返回，判定不可用，走千问兜底（图: {image_path}）")
        raise BioCLIPUnavailableError(f"单图推理超过 {INFERENCE_TIMEOUT_SECONDS}s 未返回")
    finally:
        executor.shutdown(wait=False)

    return {
        "top_k": top_k_list,
        "top1_below_threshold": below,
        "threshold": SCORE_THRESHOLD,
        "matched_species_count": matched,
    }


def _encode_and_rank(model, preprocess, image_path, text_features, labels, bird_of_label, device, top_k):
    """图像编码 + 相似度排序（在 worker 线程中执行）；PIL 解码/预处理错误转为 BioCLIPUnavailableError。"""
    try:
        from PIL import Image
        image = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0).to(device)
    except Exception as e:
        raise BioCLIPUnavailableError(f"图片解码/预处理失败: {type(e).__name__}: {e}")

    with torch.no_grad():
        image_features = model.encode_image(image)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        logits = (image_features @ text_features.T) * model.logit_scale.exp()
        probs = logits.softmax(dim=-1).squeeze(0)

    # 先取分数最高的若干标签，再按鸟种聚合（每只鸟取它两个标签中的最高分）
    probe_n = min(top_k * 2, probs.shape[0])
    top_scores, top_indices = torch.topk(probs, probe_n)
    best_per_bird: dict[str, tuple[float, str]] = {}
    for score, idx in zip(top_scores.tolist(), top_indices.tolist()):
        bird = bird_of_label[idx]
        if bird not in best_per_bird or score > best_per_bird[bird][0]:
            best_per_bird[bird] = (score, labels[idx])

    ranked = sorted(best_per_bird.items(), key=lambda kv: kv[1][0], reverse=True)[:top_k]
    top_k_list = [{"name": bird, "label": label, "score": round(score, 4)}
                  for bird, (score, label) in ranked]
    below = (not top_k_list) or (top_k_list[0]["score"] < SCORE_THRESHOLD)
    return top_k_list, below, len(best_per_bird)
