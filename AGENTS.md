# BirdVibe — AI 观鸟图鉴全栈应用

## 工作目录

- 本项目唯一有效工作目录是 `/Users/menghanzhang/Desktop/bird`
- 任何文件操作、脚本运行、路径引用都必须基于该目录
- 如发现其他位置的同名 bird 目录或 bird.zip，属于废弃副本，不要在其中读写
- 执行批量操作（下载、删除）前，先确认当前工作目录

面向观鸟入门者的 AI 应用：上传照片识别鸟种、解锁图鉴、记录足迹地图、社区分享。整个项目由**前端（Next.js）+ 后端（FastAPI）+ Markdown 知识库**三部分组成，前后端分别启动、通过 HTTP 对接。

## 目录结构

```
bird/
├── AGENTS.md                 # 本文件（项目根说明）
├── backend/                  # Python FastAPI 后端
│   ├── main.py               # FastAPI 入口 + 全部 API 路由（端口 8000）
│   ├── rag_service.py        # 知识库检索服务（纯文件系统实现，无向量库）
│   ├── bioclip_service.py    # BioCLIP 识别管道第一级（imageomics/bioclip，低分自动回退千问）
│   ├── scripts/batch_eval.py # 批量 A/B 评估：qwen std / free / bioclip 三轮（可选第 4 轮 bioclip_tuned，需 BIRD_CLIP_CHECKPOINT 指向微调权重；自动隔离知识库）
│   ├── knowledge_base/       # 42 个鸟类 Markdown 文件（YAML frontmatter + 正文，新鸟由后端自动生成）
│   ├── venv/                 # Python 虚拟环境（用 venv/bin/python 运行）
│   └── .env                  # DASHSCOPE_API_KEY（必需，勿提交/勿外泄）
└── bird-vibe-app/            # Next.js 前端
    ├── app/                  # App Router 页面：/ /recognize /pokedex /map /community
    ├── components/           # BirdChat、BirdMap、ui/（shadcn 组件）
    ├── store/useBirdStore.ts # zustand 全局状态（birdRecords 识别记录 + customBirds；baseBirds 仅展示）
    └── AGENTS.md             # ⚠️ Next.js 16 专项警告，改前端前必读
```

## 技术栈

**前端 `bird-vibe-app/`**
- Next.js **16.2.7**（App Router，⚠️ 与训练数据中的旧版有破坏性差异）
- React 19.2.4 + TypeScript 5（strict）+ Tailwind CSS v4（PostCSS 插件方式，无 tailwind.config）
- shadcn（style: radix-nova，别名 `@/` → 项目根）+ lucide-react 图标
- zustand v5（`persist` 中间件，localStorage key: `birdvibe-pokedex`）
- echarts + echarts-for-react（首页图表/海报）、leaflet + react-leaflet（地图）、canvas-confetti、html-to-image、heic2any

**后端 `backend/`**
- Python **3.12**（venv 基于 conda env `birdpy312` 创建：Intel Mac 上 torch 2.2.2 是最后一个 x86_64 wheel，Python 3.13 无对应构建）+ FastAPI 0.141 + uvicorn 0.54
- dashscope 1.27（阿里云百炼 SDK：`qwen3-vl-plus` 视觉识别、`qwen-flash` 文本生成；原 `qwen-omni-turbo`/`qwen-turbo` 已于 2026-10-10 百炼老模型批量下线）
- **BioCLIP 混合识别管道**：`bioclip_service.py` 加载 imageomics/bioclip（首次启动从 HuggingFace 下载 ~350MB，国内可 `export HF_ENDPOINT=https://hf-mirror.com` 加速）；设备自动 MPS（Apple Silicon）→ CPU 回退，本机 Intel → CPU；top1 < 0.40（常量可调）自动回退千问
- PyYAML + python-dotenv + python-multipart（FastAPI 表单硬性依赖）+ requests + openpyxl（评估脚本）；**没有 requirements.txt**，依赖装在 `backend/venv/`，关键版本：torch 2.2.2 / torchvision 0.17.2 / numpy<2（torch 2.2 只兼容 NumPy 1.x）/ open_clip_torch 3.3

## 常用命令

```bash
# 前端（bird-vibe-app/，端口 3000）
npm run dev      # 开发
npm run build    # 构建（改完必须能过）
npm run lint     # ESLint 9（flat config: eslint.config.mjs）

# 后端（在 backend/ 目录下，端口 8000）
venv/bin/python main.py          # 或直接 uvicorn main:app --reload --port 8000
                                 #（venv 基于 conda env birdpy312 的 Python 3.12 创建；
                                 #  重建：conda create -n birdpy312 python=3.12 -y &&
                                 #  /opt/anaconda3/envs/birdpy312/bin/python -m venv --clear venv &&
                                 #  venv/bin/pip install fastapi uvicorn dashscope pyyaml python-dotenv
                                 #  python-multipart requests openpyxl torch==2.2.2 torchvision==0.17.2
                                 #  "numpy<2" open_clip_torch）
                                 #  python-multipart 是 FastAPI 表单解析硬性依赖，漏装启动即报错
```
后端启动必须有 `backend/.env` 且含 `DASHSCOPE_API_KEY`，否则直接 RuntimeError。后端知识库路径为相对路径 `./knowledge_base`，**必须从 `backend/` 目录启动**。

## 后端 API（main.py）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/birds` | 全部鸟种轻量元数据列表 |
| GET | `/api/v1/birds/{name}/details` | 单鸟详情（外貌/习性/鸣叫/分布四个章节） |
| POST | `/api/v1/birds/search` | 语义搜索（form 字段 `query`） |
| POST | `/api/v1/recognize` | 照片识别（multipart：image + 可选 location/lat/lng/date/prompt_mode/recognizer）。**standard（默认）= 自由识别 + 后验匹配**：极简 prompt（无候选池注入、无地理季节硬排除），地点/日期仅软提示；代码层对候选做规范化匹配打 `in_knowledge_base`（"白鹭"可匹配"小白鹭"），新鸟入库以此为门槛。**free = 旧极简 prompt**（回归对比）。**recognizer=bioclip**：BioCLIP 专用模型先做知识库内匹配（候选 confidence=BioCLIP 分数、reason 固定文案、image_url 有图则填），top1<0.40 或模型不可用自动回退千问 free 并标 `recognizer=qwen_fallback`。可选 `extra_hint`（观察者补充线索，追加进 prompt 软提示；带线索时 BioCLIP 让位千问且不再下发追问）。响应可选 `clarification`（主动消歧追问卡片：`{group, question, options, candidates, reason}`，top1/top2 同属 CONFUSABLE_GROUPS 且分差<0.05，或识别器不确定且 top1 属易混淆组时下发；前端答复后重识别一次为限）。响应统一带可选 `recognizer`/`in_knowledge_base`/`image_url` 字段；stdout 打 debug 日志（prompt 全文 + 模型原始返回 + BioCLIP top5） |
| POST | `/api/v1/chat` | AI 聊天向导（BirdChat 悬浮窗）。JSON：`messages`（OpenAI 风格）+ 可选 `context`（`{type:"recognize_result", candidates:[{name,confidence}]}` 时进入识别对比模式）。**规则法意图四分**：compare（识别结果追问）/ identify（文字描述找鸟：列候选+反问收窄）/ faq（产品使用）/ encyclopedia（鸟类百科）。检索=鸟名 substring 直匹配 + `semantic_search_birds`（中文 bigram 分词），top3/5 档案做上下文，qwen-flash 生成。返回 `{content, intent}` |

识别到不在图鉴中的鸟时，后端会自动调用大模型生成资料并写入 `knowledge_base/{鸟名}.md`。

## 知识库文件格式（前后端共同依赖，改动需保持兼容）

```markdown
---
name: 树麻雀
englishName: Eurasian Tree Sparrow
latinName: Passer montanus
category: 城市鸟      # 城市鸟/林鸟/水鸟/猛禽
rarity: 极度常见      # 极度常见/常见/罕见/稀有
location: 街头巷尾
funFact: 脸颊上有明显的黑斑。
inaturalist_id: 11862  # 可选：iNaturalist taxon id（自动入库通过权威源校验时写入；解析/展示零影响）
---

## 外貌特征
## 生活习性
## 鸣叫特点
## 分布区域
```

`rag_service.py` 按此格式解析（YAML frontmatter + `## 章节` 正则提取），前端元数据字段名 `englishName`/`latinName` 等与之对应；`inaturalist_id` 是可选字段（自动入库的 iNaturalist 校验回路通过时写入，为将来拉图/对数据留钩子，解析与 API 返回均不依赖）。自动入库管线 = LLM 生成 → 格式校验（英文名/拉丁名）→ iNaturalist taxa API 内容校验（拉丁名+中文名两维度，不一致重试最多 3 次）→ 入库；iNat 网络异常时降级跳过该校验（WARNING 日志），网络问题不阻塞入库。`KB_DIR` 支持 `BIRD_KB_DIR` 环境变量重定向（`scripts/batch_eval.py` 批量评估时用它把知识库指向真实库的临时副本，防止测试新鸟写入污染真实库）。

## 前端关键约定

- **解锁判定只看识别记录**：`birdRecords`（鸟名 → 首次识别日期/地点/坐标/照片）是解锁的唯一依据，经 zustand persist 持久化（localStorage key `birdvibe-pokedex`，version 1）。`baseBirds` 仅作初始卡片展示，不参与解锁；旧版 `unlockedIds` 已废弃，老数据由 persist `migrate` 自动迁移（v0→v1：`unlockedIds`/`customBirds` → 合成 `birdRecords` 记录），不丢解锁状态。
- **识别页解锁时机 = 用户点选确认后**：结果为 top3 对比卡片（默认选中 top1），点「确认这就是它」才触发 `unlockBird` + 详情拉取 + 彩带（`is_new_bird` 延迟刷新也在确认后）；识别返回不再自动解锁。卡片图优先用候选的 `image_url` 字段（后端尚未返回，当前显示占位图）。
- **页面数据双来源**：图鉴卡片列表 = `baseBirds` + `customBirds`（识别到新鸟时写入的展示元数据）；卡片百科详情来自后端 `/api/v1/birds/{name}/details`；地图标记来自 `birdRecords` 中带经纬度的记录。
- **后端地址统一配置**：所有请求从 `@/lib/api` 导入 `API_BASE_URL`（定义在 `lib/api.ts`），默认 `http://localhost:8000`，可用 `.env.local` 中的 `NEXT_PUBLIC_API_URL` 覆盖；**禁止再硬编码 `localhost:8000`**。
- **Leaflet 必须 `dynamic(..., { ssr: false })` 引入**（见 `app/map/page.tsx`），否则 SSR 报错。
- 所有页面均为 `"use client"` 组件；UI 文案为中文，注释用中文、风格活泼（大量 emoji）。
- 全局布局：左侧固定边栏（`emerald-950` 深绿主题），`layout.tsx` 挂载全局 `BirdChat` 悬浮窗。

## ⚠️ 已知问题（翻新时注意）

1. ~~`components/BirdChat.tsx` 调用 `POST /api/v1/chat`，后端没有该路由，聊天功能坏~~（2026-10-14 已修复）：后端实现 `/api/v1/chat`——用最近一条用户消息检索知识库（鸟名 substring 直匹配 + `semantic_search_birds` bigram 分词补位，取 top3 完整档案做上下文），qwen-flash 生成回答；OpenAI 风格 `messages` 入参，返回 `{"content": "..."}`。顺带修复 `semantic_search_birds` 中文不分词导致永远检索不到的问题（中文滑窗 bigram）。
2. ~~知识库自动生成质量~~（已修复，见下方）：`红尾水鸲.md` 已补齐 englishName/latinName，`猫头鹰.md` 已删除（统称不入库，等识别到具体物种再生成），`add_bird_to_knowledge_base` 已加物种级校验 + 重试，不再产生空字段文件。
3. 前端 `heic2any`、`html2canvas` 等依赖需确认是否仍在使用，避免无效依赖堆积。
4. `npm run lint` 剩 9 个非阻塞 warning（`<img>` 建议换 `next/image`、个别 unused var），不影响 exit code，翻新对应页面时顺手清理。

> 已清理的遗留（2026-09）：`backend/scripts/init_vectorstore.py`、`backend/package.json`、`backend/package-lock.json`、`backend/node_modules/`（旧版 ChromaDB 脚本 + 误装的 Node 依赖）已删除；`recognize/page.tsx` 中引用不存在 `details` 字段的死代码（曾导致 build 失败）已移除；全部 15 个历史 lint error（`any` 滥用、effect 内同步 setState、`Date.now()` 触发 purity 规则等）已修复；知识库 2 个字段异常文件已修复/删除（见已知问题 #2）。

## 给 AI 的工作守则

- **改前端代码前，先读 `bird-vibe-app/AGENTS.md` 并按其要求查阅 `node_modules/next/dist/docs/` 对应指南**——Next.js 16 的 API 与旧版不同，凭记忆写容易错。
- 修改知识库格式、`rag_service.py` 解析逻辑、`useBirdStore.ts` 数据结构时，三处必须一起核对。
- 验证改动：前端 `npm run build` 与 `npm run lint`（剩非阻塞 warning，见已知问题 #4）必须通过；涉及识别的功能需后端在线 + 有效 API key，无法本地验证时要在交付说明中写明。
- 不要读取或提交 `.env`。
