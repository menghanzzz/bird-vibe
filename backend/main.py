import os
import json
import re
import tempfile
import shutil
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import dashscope
import uvicorn

# 新增：RAG 检索层
from rag_service import (
    get_bird_metadata,
    get_bird_details,
    semantic_search_birds,
    add_bird_to_knowledge_base,
    find_kb_match,
)
# 新增：BioCLIP 识别管道第一级（专门模型；不可用时优雅回退千问）
import bioclip_service

load_dotenv()
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")

if not dashscope.api_key:
    raise RuntimeError("未找到 DASHSCOPE_API_KEY，请检查 .env 文件配置！")

app = FastAPI(title="BirdVibe API", description="初阶观鸟平台全栈项目")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════
# 新增路由 1：图鉴元数据列表
# ═══════════════════════════════════════════════════════
@app.get("/api/v1/birds")
def list_birds():
    """
    返回所有鸟种的轻量元数据。
    前端 pokedex 页面用这个渲染卡片列表。
    """
    return get_bird_metadata()


# ═══════════════════════════════════════════════════════
# 新增路由 2：单鸟 RAG 详情
# ═══════════════════════════════════════════════════════
@app.get("/api/v1/birds/{bird_name}/details")
def bird_details(bird_name: str):
    """
    根据鸟名检索详细知识库内容。
    前端图鉴详情弹窗用这个填充 details 字段。
    """
    details = get_bird_details(bird_name)
    if not details:
        raise HTTPException(status_code=404, detail=f"未找到鸟类资料: {bird_name}")
    return details


# ═══════════════════════════════════════════════════════
# 新增路由 3：语义搜索
# ═══════════════════════════════════════════════════════
@app.post("/api/v1/birds/search")
def search_birds(query: str = Form(...)):
    """
    语义搜索：用户描述找鸟。
    例如 query="河边黑白相间的鸟"
    """
    return {"candidates": semantic_search_birds(query, n_results=5)}


# ═══════════════════════════════════════════════════════
# 新增路由 4：AI 聊天向导（BirdChat 悬浮窗）
# ═══════════════════════════════════════════════════════
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: dict | None = None  # 识别页联动时附带的结构化上下文（如识别候选名单）


# ── 意图路由：规则法（零成本、可解释；LLM 分类会增加一倍延迟）──
_FAQ_KEYWORDS = (
    "怎么解锁", "如何解锁", "解锁条件", "图鉴怎么", "图鉴如何",
    "地图怎么", "海报怎么", "社区怎么", "怎么用", "如何使用",
    "记录在哪", "足迹怎么", "为什么没解锁",
)
_RECOG_DESCRIBE_RE = re.compile(
    r"(看到|见到|拍到|发现|院子里|树上|河边|窗台|公园).{0,40}?"
    r"(是什么|什么鸟|哪种鸟|帮我认|帮我找|不认得|不认识)"
    r"|没(拍到|拍清)|只看到|看不清.{0,10}(鸟|雀|鸫|鹎|鹭|鸥|燕|鸦|鹰|隼)"
)


def _chat_intent(user_text: str, ctx: dict | None) -> str:
    """返回四种意图之一：compare（识别结果追问）/ identify（文字描述找鸟）
    / faq（产品使用）/ encyclopedia（鸟类百科，默认）"""
    if ctx and ctx.get("type") == "recognize_result":
        return "compare"
    if any(k in user_text for k in _FAQ_KEYWORDS):
        return "faq"
    if _RECOG_DESCRIBE_RE.search(user_text):
        return "identify"
    return "encyclopedia"


# ── 各意图的 system prompt ──
_PROMPT_ENCYCLOPEDIA = (
    "你是 BirdVibe 的观鸟向导「小鸟观察家」。\n"
    "规则：\n"
    "1. 优先依据【知识库资料】回答；资料里没有的，明说'图鉴里暂时没有这种鸟的资料'，不要编造鸟种和拉丁名；\n"
    "2. 回答口语化、简洁（一般 3~6 句），观鸟新手能看懂；\n"
    "3. 与鸟类无关的问题，礼貌一句话带过并引导回观鸟话题；\n"
    "4. 对比题（如'A 和 B 怎么区分'）列出 2~3 个最实用的野外辨识点。"
)

_PROMPT_IDENTIFY = (
    "你是 BirdVibe 的「对话式找鸟」向导。用户还没拍到照片，只靠文字描述找鸟。\n"
    "步骤：\n"
    "1. 依据【候选鸟资料】列出 2~4 个最可能的候选，每个给一个最显眼的野外辨识点（一句话）；\n"
    "2. 然后反问用户一个最能区分这些候选的特征问题（从喙色、体型、尾长、行为姿态中选最关键的一个）；\n"
    "3. 用户补充特征后收窄候选；收窄到 1~2 个时，建议用户到识别页拍一张照片做最终确认；\n"
    "4. 候选都不像时明说，不要编造资料里没有的鸟种。"
)

_PROMPT_COMPARE = (
    "用户刚用 BirdVibe 的识别功能得到一份候选名单（见最后的【识别结果】）。"
    "你的任务是帮用户在这些候选里做选择：\n"
    "1. 结合【知识库资料】解释各候选的关键辨识点，指出最可能的一个并说明理由；\n"
    "2. 若几个候选都成立，给出'再观察哪个特征就能分辨'的具体建议；\n"
    "3. 语气像有经验的观鸟伙伴，简洁。"
)

_PROMPT_FAQ = (
    "你是 BirdVibe 的使用助手。只回答本 App 的使用问题，依据【产品说明】；"
    "说明里没有的功能，老实说不知道，不要编造。\n"
    "【产品说明】\n"
    "- 解锁图鉴：识别页上传照片 → 在结果卡片点「确认这就是它」→ 该鸟解锁并记录首次时间地点；"
    "解锁依据只看你确认过的识别记录。\n"
    "- 数据存哪：解锁记录只存在你自己浏览器里（localStorage），不上服务器，清浏览器缓存会丢。\n"
    "- 地图标记：识别时带上位置（手动填或浏览器定位）的确认记录会自动出现在地图页。\n"
    "- 首页看板与社区：目前是演示内容；海报导出可用；社区发帖功能尚未开放。"
)


def _kb_context_block(name: str, appearance_len: int = 200) -> str | None:
    """取一只鸟的档案，拼成上下文块（identify 场景用更长的外貌段）。"""
    d = get_bird_details(name)
    if not d:
        return None
    det = d["details"]
    return (
        f"【{d['name']}（{d['englishName']}，{d['latinName']}）】"
        f"类别:{d['category']}；稀有度:{d['rarity']}；常见地点:{d['location']}。\n"
        f"外貌:{det['appearance'][:appearance_len]}\n"
        f"习性:{det['habitatAndHabits'][:120]}\n"
        f"鸣叫:{det['callCharacteristics'][:80]}\n"
        f"分布:{det['distribution'][:120]}"
    )


@app.post("/api/v1/chat")
def chat(req: ChatRequest):
    """
    AI 聊天向导 v2：意图分流（百科/描述找鸟/识别结果对比/产品 FAQ）+
    知识库检索上下文 + qwen-flash 生成。
    入参 OpenAI 风格 messages + 可选 context；返回 {"content": "...", "intent": ...}。
    """
    if not req.messages:
        raise HTTPException(status_code=400, detail="消息不能为空")
    last_user = next((m for m in reversed(req.messages) if m.role == "user"), None)
    if not last_user or not last_user.content.strip():
        raise HTTPException(status_code=400, detail="缺少用户消息")

    user_text = last_user.content.strip()
    intent = _chat_intent(user_text, req.context)
    system_prompt = ""
    context = ""

    if intent == "faq":
        system_prompt = _PROMPT_FAQ

    elif intent == "compare":
        # 识别联动：候选名单 + 知识库档案 + 用户追问
        system_prompt = _PROMPT_COMPARE
        cand_names = [c.get("name", "") for c in (req.context or {}).get("candidates", [])
                      if isinstance(c, dict) and c.get("name")]
        cand_lines = [f"- {c.get('name')}（把握 {int(c.get('confidence', 0) * 100)}%）"
                      for c in (req.context or {}).get("candidates", []) if isinstance(c, dict)]
        blocks = [_kb_context_block(nm) for nm in dict.fromkeys(cand_names)]
        context = "【识别结果】\n" + "\n".join(cand_lines)
        kb = "\n\n".join(b for b in blocks if b)
        if kb:
            context += "\n\n【知识库资料】\n" + kb

    elif intent == "identify":
        # 描述找鸟：top5 候选，外貌段加长，prompt 引导反问收窄
        system_prompt = _PROMPT_IDENTIFY
        searched = [h["name"] for h in semantic_search_birds(user_text, n_results=5)]
        blocks = [_kb_context_block(nm, appearance_len=280) for nm in dict.fromkeys(searched)]
        context = "\n\n".join(b for b in blocks if b) or "（未检索到相近的图鉴条目，请基于常识谨慎推测并建议用户补拍照片）"

    else:  # encyclopedia
        system_prompt = _PROMPT_ENCYCLOPEDIA
        direct = [m["name"] for m in get_bird_metadata() if m.get("name") and m["name"] in user_text]
        searched = [h["name"] for h in semantic_search_birds(user_text, n_results=3)]
        picked: list[str] = []
        for nm in direct + searched:
            if nm not in picked:
                picked.append(nm)
            if len(picked) >= 3:
                break
        blocks = [_kb_context_block(nm) for nm in picked]
        context = "\n\n".join(b for b in blocks if b) or "（本次检索未命中知识库条目）"

    if context:
        system_prompt += "\n\n" + context

    # 组装：system + 近 10 条对话历史
    history = [
        {"role": m.role, "content": m.content}
        for m in req.messages[-10:]
        if m.role in ("user", "assistant")
    ]
    history.insert(0, {"role": "system", "content": system_prompt})

    # 生成回答
    try:
        response = dashscope.Generation.call(model="qwen-flash", messages=history)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"模型调用失败: {e}")
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"模型调用失败: {response.message}")
    return {"content": response.output.text.strip(), "intent": intent}


# ═══════════════════════════════════════════════════════
# 改造原有路由：识别接口加入 RAG 增强
# ═══════════════════════════════════════════════════════
def _season_hint(month: int) -> str:
    """北半球季节提示（知识库鸟种主要分布在中国与新加坡）"""
    if month in (3, 4, 5):
        return "北半球春季——迁徙旺季，留意旅鸟与刚抵达的夏候鸟"
    if month in (6, 7, 8):
        return "北半球夏季——繁殖期，留意繁殖羽与幼鸟"
    if month in (9, 10, 11):
        return "北半球秋季——候鸟南迁旺季，留意旅鸟与刚抵达的冬候鸟"
    return "北半球冬季——越冬候鸟聚集，留意北方南迁的冬候鸟"


# free 模式（A/B 测试用）极简 prompt：只描述识别任务，不提知识库候选池、不加地理/季节排除规则
# 输出 JSON 契约与 standard 模式完全一致
_FREE_PROMPT = """你是一位经验丰富的鸟类识别助手。请仔细观察图片，自由识别图中的鸟类（不限于任何预设名单），给出你认为最可能的 5 个候选。

要求：
1. 先客观描述你实际看到的视觉特征：体型大小、主要羽色、头/喉/胸/翅/脚的颜色与斑纹、喙形与喙色、腿色、姿态。
2. top5_candidates：按把握程度从高到低排列，每个候选包含：
   - name：标准中文学名（物种级；若是"猫头鹰""麻雀""八哥"这类统称，必须细化为最可能的具体物种）
   - confidence：0~1 的浮点数，逐候选递减，禁止所有候选填相同的值
   - reason：识别依据——说明你实际看到的特征及入选原因；confidence 低于 0.7 时必须包含「不确定点：…」
3. certainty_level：对 top1 的诚实自评（"高"/"中"/"低"）；非「高」时 uncertainty_explanation 必须填写最大不确定因素，为「高」时填空字符串。
4. feature_description：一句话客观描述图中特征（不要猜种名）。
5. is_rare：该鸟是否属于稀有鸟类（布尔值）。
6. 只输出合法 JSON 字符串，不要使用 markdown 代码块。

JSON结构（顶层字段缺一不可）：
{
  "top5_candidates": [
    {
      "name": "精确的中文学名",
      "confidence": 0到1之间的浮点数,
      "reason": "识别依据；confidence<0.7 时必须包含「不确定点：…」"
    }
  ],
  "certainty_level": "高或中或低",
  "feature_description": "一句话客观视觉描述",
  "is_rare": false,
  "uncertainty_explanation": "certainty_level非「高」时填写最大不确定因素，否则填空字符串"
}"""


# standard 模式（新架构）：自由识别 + 代码层后验匹配。
# 极简自由识别 prompt（源自 free 模式），地点/日期通过 {soft_hint} 占位符注入为软提示（仅供参考），
# 彻底移除知识库候选池注入与地理/季节硬性排除规则；候选与知识库的匹配在代码层后验完成。
# 输出 JSON 契约与 free 模式完全一致。
_STANDARD_PROMPT = """你是一位严谨的自然科学向导。请仔细观察图片，自由识别图中的鸟类（不限于任何预设名单），给出你认为最可能的 5 个候选。

{soft_hint}
要求：
1. 先客观描述你实际看到的视觉特征：体型大小、主要羽色、头/喉/胸/翅/脚的颜色与斑纹、喙形与喙色、腿色、姿态。
2. top5_candidates：按把握程度从高到低排列，每个候选包含：
   - name：标准中文学名（物种级；若是"猫头鹰""麻雀""八哥"这类统称，必须细化为最可能的具体物种）
   - confidence：0~1 的浮点数，逐候选递减，禁止所有候选填相同的值
   - reason：识别依据——说明你实际看到的特征及入选原因；confidence 低于 0.7 时必须包含「不确定点：…」
3. certainty_level：对 top1 的诚实自评（"高"/"中"/"低"）；非「高」时 uncertainty_explanation 必须填写最大不确定因素，为「高」时填空字符串。
4. feature_description：一句话客观描述图中特征（不要猜种名）。
5. is_rare：该鸟是否属于稀有鸟类（布尔值）。
6. 只输出合法 JSON 字符串，不要使用 markdown 代码块。

JSON结构（顶层字段缺一不可）：
{
  "top5_candidates": [
    {
      "name": "精确的中文学名",
      "confidence": 0到1之间的浮点数,
      "reason": "识别依据；confidence<0.7 时必须包含「不确定点：…」"
    }
  ],
  "certainty_level": "高或中或低",
  "feature_description": "一句话客观视觉描述",
  "is_rare": false,
  "uncertainty_explanation": "certainty_level非「高」时填写最大不确定因素，否则填空字符串"
}"""


# ── 主动消歧（active clarification）：模型在易混淆鸟组上没把握时，反问用户一个关键问题而不是硬猜 ──
# 触发规则：top1 与 top2 同属一组且分差 < CLARIFICATION_MARGIN；或识别器给出不确定说明且 top1 属任一分组。
# 用户答复后作为 extra_hint 带进重识别（最多一次：带线索的调用不再下发追问）。
CLARIFICATION_MARGIN = 0.05

CONFUSABLE_GROUPS = [
    {
        "group": "鹭科",
        "species": ["大白鹭", "中白鹭", "白鹭", "牛背鹭"],
        "question": "观察它的嘴、腿和脚趾（非繁殖期嘴色最准）：",
        "options": [
            "嘴黑色，腿黑色但脚趾黄色",
            "嘴长呈黄色，腿全黑，体型明显最大，嘴裂延伸到眼后",
            "嘴黄色、尖端发黑，腿全黑，体型中等，嘴裂只到眼睛正下方",
            "嘴黄色，腿全黑，体型最矮敦实，常站在田地里",
        ],
    },
    {
        "group": "鸥类",
        "species": ["红嘴鸥", "蒙古银鸥", "银鸥", "黑嘴鸥"],
        "question": "这只鸥的嘴是什么颜色？",
        "options": ["红色或深红褐色", "黄色（尖端常带一个红点）", "黑色"],
    },
    {
        "group": "鸲类",
        "species": ["欧亚鸲", "欧亚红尾鸲", "北红尾鸲"],
        "question": "它身上最显眼的亮色在哪个部位？",
        "options": ["胸口和腹部（橙红色一团）", "尾羽（棕红色，常上下点动）", "通体偏暗，没有明显亮色"],
    },
]


def _confusable_group_of(name: str):
    """候选鸟名命中哪个易混淆组（复用 rag_service 归一化：去空格/全半角/双向子串），未命中返回 None。"""
    from rag_service import _normalize_name
    norm = _normalize_name(name)
    if not norm:
        return None
    for g in CONFUSABLE_GROUPS:
        for s in g["species"]:
            sn = _normalize_name(s)
            if sn and (sn == norm or sn in norm or norm in sn):
                return g
    return None


def _maybe_clarification(result: dict):
    """主动消歧触发判定：命中返回追问卡片 dict，否则 None。"""
    cands = result.get("top5_candidates") or []
    if not cands:
        return None
    top1 = cands[0]
    g1 = _confusable_group_of(str(top1.get("name", "")))
    if not g1:
        return None
    top2 = cands[1] if len(cands) > 1 else None
    g2 = _confusable_group_of(str(top2.get("name", ""))) if top2 else None
    try:
        margin = abs(float(top1.get("confidence", 0)) - float(top2.get("confidence", 0))) if top2 else float("inf")
    except (TypeError, ValueError):
        margin = float("inf")
    uncertainty = (result.get("uncertainty_explanation") or "").strip()
    if g2 is g1 and margin < CLARIFICATION_MARGIN:
        reason = "top1/top2 同组且分差极小"
    elif uncertainty:
        reason = "识别器自评不确定且 top1 属易混淆组"
    else:
        return None
    return {
        "group": g1["group"],
        "question": g1["question"],
        "options": g1["options"],
        "candidates": [top1.get("name"), top2.get("name")] if top2 else [top1.get("name")],
        "reason": reason,
    }


def _try_bioclip_recognize(image_path: str):
    """
    BioCLIP 第一级：知识库内视觉匹配（专门模型）。
    返回识别结果 dict；模型不可用或 top1 低于阈值时返回 None，由调用方回退千问。
    """
    try:
        bio = bioclip_service.recognize(image_path)
    except bioclip_service.BioCLIPUnavailableError as e:
        print(f"⚠️ [bioclip] 模型不可用，回退千问兜底: {e}")
        return None

    print(f"[recognize][debug] BioCLIP top5: {[(t['name'], t['score']) for t in bio['top_k']]}")

    if bio["top1_below_threshold"] or not bio["top_k"]:
        print(f"⚠️ [bioclip] top1 低于阈值 {bio['threshold']}，判定为知识库外的鸟，走千问开放集兜底")
        return None

    kb_metas = {m["name"]: m for m in get_bird_metadata()}
    candidates = []
    for item in bio["top_k"]:
        meta = kb_metas.get(item["name"]) or {}
        candidates.append({
            "name": item["name"],
            "confidence": item["score"],
            "reason": "BioCLIP 视觉相似度匹配",
            "in_knowledge_base": True,
            "image_url": meta.get("officialImageUrl") or None,
        })

    top1_score = bio["top_k"][0]["score"]
    return {
        "top5_candidates": candidates,
        "certainty_level": "高" if top1_score >= 0.5 else "中",
        "feature_description": "",
        "is_rare": False,
        "uncertainty_explanation": "" if top1_score >= 0.5 else f"BioCLIP 置信度 {top1_score:.2f} 不高，建议结合实拍复核",
    }


@app.post("/api/v1/recognize")
async def recognize_bird(
    image: UploadFile = File(...),
    location: str = Form(""),
    lat: str = Form(""),
    lng: str = Form(""),
    date: str = Form(""),
    prompt_mode: str = Form("standard"),
    recognizer: str = Form("qwen"),
    extra_hint: str = Form("")
):
    if not image:
        raise HTTPException(status_code=400, detail="请上传鸟类照片")

    temp_dir = tempfile.mkdtemp()

    try:
        content_list = []

        image_path = os.path.join(temp_dir, image.filename)
        with open(image_path, "wb") as f:
            f.write(await image.read())
        content_list.append({"image": f"file://{image_path}"})

        # ── BioCLIP 第一级（可选）：专门模型做知识库内匹配；不可用/低分则继续走下方千问兜底。
        #    带观察者补充线索（extra_hint）时 BioCLIP 让位——它的标签库无法利用文本线索，直接千问 ──
        use_bioclip = (recognizer in ("bioclip", "bioclip_tuned")) and not extra_hint.strip()
        if use_bioclip:
            bio_result = _try_bioclip_recognize(image_path)
            if bio_result is not None:
                # recognizer 回显请求值；是否真为微调模型取决于服务端 BIRD_CLIP_CHECKPOINT 环境变量
                bio_result["recognizer"] = "bioclip_tuned" if recognizer == "bioclip_tuned" else "bioclip"
                clarification = _maybe_clarification(bio_result)
                if clarification:
                    bio_result["clarification"] = clarification
                return bio_result
            print("⚠️ [recognize] BioCLIP 未命中，回退千问开放集识别")

        # 观察日期：优先用前端传入的，缺省或非法格式则回退服务器当天（standard 软提示用）
        try:
            obs_date = datetime.strptime(date, "%Y-%m-%d").date() if date else datetime.now().date()
        except ValueError:
            obs_date = datetime.now().date()
        date_str = obs_date.strftime("%Y年%m月%d日")
        season_hint = _season_hint(obs_date.month)

        # 「不确定」视为未提供地点
        loc_hint = location.strip() if location and location.strip() != "不确定" else "未知"

        # prompt 模式开关：
        #   standard = 新架构「自由识别 + 后验匹配」：极简 prompt + 地点/日期软提示（仅供参考），
        #              知识库候选池注入与地理季节硬性排除已彻底移除，候选匹配在代码层后验完成；
        #   free = 旧极简 prompt，原样保留用于回归对比。
        mode = prompt_mode if prompt_mode in ("standard", "free") else "standard"
        if use_bioclip:
            mode = "free"  # BioCLIP 兜底固定走开放集 free，保留新鸟发现能力
        if mode == "free":
            prompt_text = _FREE_PROMPT
        else:
            gps_note = f"（GPS: {lat}, {lng}）" if lat and lng else ""
            # prompt v2（2026-10-14）：评测发现地理/时空提示造成锚定偏差（std top3 75.0% < free 77.3%，
            # McNemar p=0.08 方向性证据），弱化为"弱参考 + 显式反锚定指令"；若 v2 复评仍不敌 free，v3 将移除地点行
            soft_hint = (
                "【背景线索 · 弱参考，判断一律以图像实际特征为准】：\n"
                f"观察日期：{date_str}（{season_hint}，仅作背景参考）\n"
                f"拍摄地点：{loc_hint}{gps_note}（仅背景信息，不要因为地点而倾向当地常见种"
                "——逸鸟、迷鸟与旅行照片很常见；与图像特征冲突时一律以图像为准）\n"
            )
            prompt_text = _STANDARD_PROMPT.replace("{soft_hint}", soft_hint)

        # 观察者补充线索（追问答复后的重识别）：追加为软提示，仅供参考
        if extra_hint.strip():
            prompt_text += f"\n【观察者补充线索 · 仅供参考，不要盲从】：\n{extra_hint.strip()}\n"

        print(f"\n===== [recognize][debug] prompt_mode={mode} | prompt 全文开始 =====")
        print(prompt_text)
        print("===== [recognize][debug] prompt 全文结束 =====")

        content_list.append({"text": prompt_text})

        messages = [
            {
                "role": "user",
                "content": content_list
            }
        ]

        response = dashscope.MultiModalConversation.call(
            model='qwen3-vl-plus',
            messages=messages
        )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"阿里云API调用失败: {response.message}")

        print(f"\n===== [recognize][debug] token 用量: {getattr(response, 'usage', None)} =====")
        result_text = response.output.choices[0].message.content[0]["text"]
        print(f"\n===== [recognize][debug] prompt_mode={mode} | 模型原始返回开始 =====")
        print(result_text)
        print("===== [recognize][debug] 模型原始返回结束 =====")
        result_text = result_text.strip().removeprefix("```json").removesuffix("```").strip()

        result = json.loads(result_text)

        # 后验匹配：top5 每个候选与知识库已有鸟名做规范化匹配（去空格/全半角/双向子串），
        # 仅打 in_knowledge_base 标记（如"白鹭"会标记匹配到"小白鹭"），不改动候选本身
        for cand in result.get("top5_candidates", []):
            if isinstance(cand, dict):
                cand["in_knowledge_base"] = find_kb_match(str(cand.get("name", ""))) is not None

        # 🆕 自动发现新鸟：top1 与知识库规范化匹配不上才算新鸟
        #（"白鹭"这类别名/空格差异不会触发重复入库；入库失败时不置 is_new_bird，绝不产生空字段知识库文件）
        top1_name = result.get("top5_candidates", [{}])[0].get("name", "")

        # 拒答/无效输出严禁入库：评测实证 qwen 会把"无法识别"填进 name 字段，
        # 曾被当作新鸟种写入知识库（污染图鉴）；黑名单 + 否定前缀双重拦截
        _REFUSAL_NAMES = {"", "无", "未知", "无效", "未识别", "无法识别", "识别失败",
                          "无鸟", "没有鸟类", "无鸟类", "非鸟类", "不适用"}
        _REFUSAL_PREFIXES = ("无法", "无对应", "无可见", "未识别", "不是", "非鸟")
        _is_refusal = (top1_name.strip() in _REFUSAL_NAMES
                       or top1_name.strip().startswith(_REFUSAL_PREFIXES))
        if _is_refusal:
            print(f"⚠️ 识别拒答输出「{top1_name}」已拦截，不触发自动入库")

        # 评测冻结开关：BIRD_DISABLE_INGEST=1 时跳过自动入库。
        # 为什么需要：评测期间入库会让隔离 KB 随时间增长，BioCLIP softmax 分数随运行顺序漂移，
        # 污染阈值类指标的测量（2026-10-14 实证，详见 eval_set/EVAL_NOTES.md）
        _ingest_disabled = os.environ.get("BIRD_DISABLE_INGEST", "") == "1"
        if _ingest_disabled and top1_name and find_kb_match(top1_name) is None:
            print(f"🔒 [评测冻结] 跳过新鸟入库: {top1_name}")

        if (top1_name and not _is_refusal and not _ingest_disabled
                and find_kb_match(top1_name) is None):
            print(f"🔍 发现新鸟种: {top1_name}，正在自动入库...")
            added_name = add_bird_to_knowledge_base(
                name=top1_name,
                english_name="",
                latin_name=""
            )
            if added_name:
                result["is_new_bird"] = True
            else:
                print(f"⚠️ 新鸟种 {top1_name} 自动入库失败，未写入知识库")

        # 主动消歧：带线索的重识别不再下发追问卡（前端最多触发一次，这里双保险防循环）
        if not extra_hint.strip():
            clarification = _maybe_clarification(result)
            if clarification:
                result["clarification"] = clarification

        result["recognizer"] = "qwen_fallback" if use_bioclip else "qwen"
        return result

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="大模型返回的数据不是合法的JSON，请重试。")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == '__main__':
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
