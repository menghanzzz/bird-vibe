# BioCLIP 微调 · AutoDL 环境准备说明

目标环境：AutoDL 实例（Linux + NVIDIA GPU，显存 ≥8G；实测 A10/3090 均可）。训练脚本与本地完全同一份：`backend/scripts/finetune_bioclip.py`。

## 1. 实例与环境

- 镜像：PyTorch 2.x + CUDA 官方镜像即可（如 `PyTorch 2.1.0` / `2.2.x`）
- 关键 pip 依赖（与本地 venv 版本对齐；GPU 版 torch 走 pytorch 官方源）：

```bash
pip install torch==2.2.2 torchvision==0.17.2 --index-url https://download.pytorch.org/whl/cu118
pip install open_clip_torch==3.3.0 pillow numpy==1.26.4 requests
```

> `numpy<2` 是硬约束：torch 2.2 编译于 NumPy 1.x，NumPy 2.x 会触发兼容告警/崩溃。

## 2. 预训练权重下载（国内镜像）

首次运行会从 HuggingFace 拉取 imageomics/bioclip（~350MB）。AutoDL 机器访问 huggingface.co 通常超时，必须先设镜像：

```bash
export HF_ENDPOINT=https://hf-mirror.com
```

脚本内 `open_clip.create_model_and_transforms("hf-hub:imageomics/bioclip")` 会自动读取该变量，权重缓存到 `~/.cache/huggingface`。

## 3. 数据上传（tar 包结构）

在本机 `backend/` 目录打包（包含 manifest 与全部图片，约 150MB）：

```bash
cd /Users/menghanzhang/Desktop/bird/backend
tar -czf bird_training_data.tar.gz training_data/
```

AutoDL 上传后解压，结构保持：

```
training_data/
├── manifest.json            # 物种清单/授权/来源链接（脚本据此读数据）
└── {鸟名}/
    ├── train/*.jpg          # 每物种 ~50 张
    └── val/*.jpg            # 每物种 ~12 张（观察者分散选样）
```

## 4. 训练与产出

```bash
python finetune_bioclip.py --data-dir ./training_data --output-dir ./finetune_output
```

默认超参（8G 显存适配，已在脚本注释标注）：batch 32 / AdamW lr 1e-5 / cosine + 5% warmup / AMP / epoch 20 / early stopping(val top-1, patience 5)。约 48 物种 × 50 张 = 2400 张训练图，单 epoch 在 3090 上约 1~2 分钟，全程预计 20~40 分钟。

产出（`--output-dir`）：

| 文件 | 说明 |
|---|---|
| `model_finetuned.pt` | 纯 tensor state_dict（`weights_only=True` 可加载） |
| `train_log.json` | 每 epoch 的 train_loss / val_top1 / lr / 耗时 |
| `val_report.json` | 按物种的 val 准确率清单（best epoch 权重评估） |

## 5. 拿回本地并接入识别服务

1. 拷回：`finetune_output/model_finetuned.pt` → 本机任意路径（建议 `backend/finetune_output/model_finetuned.pt`）
2. 启动后端时设置环境变量：

```bash
cd backend && BIRD_CLIP_CHECKPOINT=/path/to/model_finetuned.pt venv/bin/python main.py
```

- 加载成功：日志 `[bioclip] 已加载微调权重: ...`
- 加载失败（文件损坏/结构不符）：自动回落预训练权重并打 `⚠️ WARNING`，服务照常可用
- 未设置：完全保持现有零样本行为

3. 对比评估：第四轮 `recognizer=bioclip_tuned` 已加入 `batch_eval.py`，报告自动产出「微调 vs 零样本」对比表（前提是第四轮跑时服务端带着 `BIRD_CLIP_CHECKPOINT`）。

## 6. 常见坑

- **OOM**：把 `--batch-size` 降到 16；ViT-B/16 @ 224² AMP 在 8G 上 batch 32 余量充足
- **数据不足报错**：`可用物种不足 2 个` → `--data-dir` 没指到 training_data（manifest 同级）
- **验证集缺失**：某物种观察者太少 val 可能 <8 张，`val_report.json` 里该物种 total 会如实偏小
