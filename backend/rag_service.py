import os
import re
import time
import yaml

# ═══════════════════════════════════════════════════════
# 纯文件系统知识库（替代 ChromaDB，零依赖）
# 可用 BIRD_KB_DIR 环境变量重定向目录（scripts/batch_eval.py 批量评估时
# 用它指向真实库的临时副本，防止识别测试把新鸟写入真实知识库）
# ═══════════════════════════════════════════════════════
KB_DIR = os.environ.get("BIRD_KB_DIR", "./knowledge_base")


def _list_kb_files():
    """列出所有知识库 Markdown 文件"""
    if not os.path.exists(KB_DIR):
        return []
    return sorted([f for f in os.listdir(KB_DIR) if f.endswith(".md")])


def _parse_md(filepath):
    """解析 Markdown 文件，返回 (meta_dict, body_str)"""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    meta = {}
    body = content
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            meta = yaml.safe_load(parts[1])
            body = parts[2]
    
    return meta, body


def get_bird_metadata() -> list[dict]:
    """
    返回所有鸟种的轻量元数据列表。
    用于前端图鉴卡片渲染。
    """
    metas = []
    for i, filename in enumerate(_list_kb_files(), 1):
        filepath = os.path.join(KB_DIR, filename)
        meta, _ = _parse_md(filepath)
        metas.append({
            "id": i,
            "name": meta.get("name", filename.replace(".md", "")),
            "englishName": meta.get("englishName", ""),
            "latinName": meta.get("latinName", ""),
            "category": meta.get("category", ""),
            "rarity": meta.get("rarity", ""),
            "location": meta.get("location", ""),
            "funFact": meta.get("funFact", ""),
        })
    return metas


def get_bird_details(name: str) -> dict | None:
    """
    根据鸟名精确检索详细资料。
    用于前端图鉴详情弹窗填充 details 字段。
    """
    filepath = os.path.join(KB_DIR, f"{name}.md")
    if not os.path.exists(filepath):
        return None
    
    meta, body = _parse_md(filepath)
    
    sections = {
        "appearance": "",
        "habitatAndHabits": "",
        "callCharacteristics": "",
        "distribution": ""
    }
    
    for key, cn_title in [
        ("appearance", "外貌特征"),
        ("habitatAndHabits", "生活习性"),
        ("callCharacteristics", "鸣叫特点"),
        ("distribution", "分布区域")
    ]:
        pattern = rf"##\s*{cn_title}\n(.*?)(?=\n##\s|\Z)"
        match = re.search(pattern, body, re.DOTALL)
        if match:
            sections[key] = match.group(1).strip()
    
    return {
        "name": meta.get("name", name),
        "englishName": meta.get("englishName", ""),
        "latinName": meta.get("latinName", ""),
        "category": meta.get("category", ""),
        "rarity": meta.get("rarity", ""),
        "location": meta.get("location", ""),
        "funFact": meta.get("funFact", ""),
        "details": sections
    }


def retrieve_context_for_birds(bird_names: list[str]) -> str:
    """
    批量检索鸟种资料，用于识别接口的 prompt 注入。
    只提取【外貌特征】，且限制数量防止 prompt 过长导致模型注意力分散。
    """
    contexts = []
    for name in bird_names[:15]:  # ← 只取前15种，避免信息过载
        filepath = os.path.join(KB_DIR, f"{name}.md")
        if not os.path.exists(filepath):
            continue
        
        _, body = _parse_md(filepath)
        
        appearance = ""
        app_match = re.search(
            r"##\s*外貌特征\s*\n(.*?)(?=\n##\s|\Z)",
            body,
            re.DOTALL
        )
        if app_match:
            appearance = app_match.group(1).strip()[:120]  # ← 更短，只留核心辨识点
        
        if appearance:
            contexts.append(f"【{name}】{appearance}...")
    
    return "\n".join(contexts)


def _query_tokens(query: str) -> list[str]:
    """
    查询分词：空格切词 + 中文滑窗 bigram。
    中文没有空格，整句作为一个"词"会让关键词计数永远命中不了（冒烟实测）；
    bigram 让"八哥和乌鸫怎么区分"里的"八哥""乌鸫"都能命中鸟卡。
    """
    tokens: list[str] = []
    for word in query.lower().split():
        if re.fullmatch(r"[一-鿿]+", word):
            # 2~4 字的短中文词先整词匹配（鸟名多是 2~4 字），再补 bigram 覆盖长句
            if 2 <= len(word) <= 4:
                tokens.append(word)
            tokens.extend(word[i:i + 2] for i in range(len(word) - 1))
        elif len(word) > 1:
            tokens.append(word)
    # 去重保序，防止长查询靠重复词刷分
    seen: set[str] = set()
    return [t for t in tokens if not (t in seen or seen.add(t))]


def semantic_search_birds(query: str, n_results: int = 5) -> list[dict]:
    """
    语义搜索：用户用自然语言描述找鸟。
    使用简单关键词匹配（对于 40-120 种鸟完全够用）；中文经 bigram 分词。
    """
    tokens = _query_tokens(query)
    results = []

    for filename in _list_kb_files():
        filepath = os.path.join(KB_DIR, filename)
        meta, body = _parse_md(filepath)
        name = meta.get("name", filename.replace(".md", ""))

        full_text = f"{name} {meta.get('englishName', '')} {meta.get('latinName', '')} {body}".lower()

        # 简单评分：每个 token 在文档中出现的次数
        score = sum(full_text.count(tok) for tok in tokens)

        if score > 0:
            results.append({
                "name": name,
                "category": meta.get("category", ""),
                "rarity": meta.get("rarity", ""),
                "score": score,
                "snippet": body[:300] + "..."
            })
    
    # 按分数排序，去掉 score 字段返回
    results.sort(key=lambda x: x["score"], reverse=True)
    for r in results:
        del r["score"]
    
    return results[:n_results]


# 拉丁学名必须是双名法（属名首字母大写 + 种加词小写），
# 拒绝目/科/属级分类名（如 Strigiformes）、括号注释和夹带中文的值
LATIN_NAME_RE = re.compile(r'^[A-Z][a-z]+ [a-z][a-z-]+$')
CJK_RE = re.compile(r'[一-鿿]')
MAX_GENERATION_ATTEMPTS = 3

# iNaturalist 权威源校验（官方公开 taxa 接口；礼貌间隔 1s，超时 5s，不轮询不批量）
INAT_TAXA_URL = "https://api.inaturalist.org/v1/taxa"
INAT_REQUEST_TIMEOUT = 5
INAT_REQUEST_INTERVAL = 1.0


def _extract_section(text: str, title: str) -> str:
    match = re.search(rf'---\s*{title}\s*---\s*(.*?)(?=---\s*|$)', text, re.DOTALL)
    return match.group(1).strip() if match else ""


def _valid_english_name(value: str) -> bool:
    return bool(value) and not CJK_RE.search(value)


def _valid_latin_name(value: str) -> bool:
    value = value.strip()
    return bool(value) and not CJK_RE.search(value) and bool(LATIN_NAME_RE.match(value))


def _verify_with_inaturalist(latin_name: str, chinese_name: str):
    """
    iNaturalist 权威源事后校验（官方公开 taxa 接口，GET /v1/taxa?q=拉丁名）。

    校验两个维度（对第一个匹配结果）：
      a. 拉丁名一致：双名法前两词比对，忽略大小写与亚种后缀（iNat 可能返回三名法）；
      b. 中文名一致或可匹配：preferred_common_name（locale=zh-CN）与生成中文名互相子串。

    返回：
      {"id": taxon_id}  校验通过（附 taxon id，入库时写入 frontmatter inaturalist_id）
      False             内容不一致（视为本次生成失败，调用方走重试）
      None              网络/接口异常（调用方降级：跳过校验照常入库，只打 WARNING）
                        拉丁名匹配但 iNat 无中文俗名时，中文维度无法核验 → 视为通过并打 WARNING。
    """
    try:
        import requests
        time.sleep(INAT_REQUEST_INTERVAL)  # 礼貌间隔
        r = requests.get(
            INAT_TAXA_URL,
            params={"q": latin_name, "locale": "zh-CN", "per_page": 1},
            timeout=INAT_REQUEST_TIMEOUT,
            headers={"Accept-Language": "zh-CN"},
        )
        if r.status_code != 200:
            return None
        results = (r.json() or {}).get("results") or []
        if not results:
            return False  # 查无此名，视为不一致
        taxon = results[0]
    except Exception:
        return None  # 网络/解析异常 → 降级

    # a. 拉丁名：双名法前两词（忽略大小写/亚种后缀）
    inat_words = (taxon.get("name") or "").strip().split()
    gen_words = latin_name.strip().split()
    if len(inat_words) < 2 or len(gen_words) < 2:
        return False
    if inat_words[0].lower() != gen_words[0].lower() or inat_words[1].lower() != gen_words[1].lower():
        return False

    # b. 中文名：互相子串匹配；iNat 无中文俗名时该维度无法核验 → 放过但提醒
    inat_cn = (taxon.get("preferred_common_name") or "").strip()
    gen_cn = chinese_name.strip()
    if inat_cn and CJK_RE.search(inat_cn):
        if inat_cn != gen_cn and inat_cn not in gen_cn and gen_cn not in inat_cn:
            return False
    else:
        print(f"⚠️ WARNING: iNaturalist 无「{latin_name}」的中文俗名，中文维度未核验（拉丁名已通过）")

    taxon_id = taxon.get("id")
    return {"id": taxon_id} if taxon_id else {"id": None}


def add_bird_to_knowledge_base(name: str, english_name: str = "", latin_name: str = "") -> str | None:
    """
    自动为新发现的鸟类生成知识库资料并入库（LLM 生成 + iNaturalist 权威源校验 + 不一致重试）。

    - prompt 要求物种级名称：输入是「猫头鹰」「麻雀」这类统称时，模型必须细化到
      具体物种并在「规范中文名」一节返回，函数以规范名作为文件名；
    - 英文名/拉丁名缺失或不合法（空值、夹中文、非双名法）时自动重试，最多 3 次；
    - 格式校验通过后调 iNaturalist taxa API 做内容真实性校验（拉丁名+中文名两维度），
      不一致视为生成失败继续重试；iNat 网络/接口异常则降级跳过该校验（WARNING），照常入库；
    - 通过校验时 frontmatter 额外写入 inaturalist_id（taxon id，可选字段，解析/展示零影响）。

    返回写入的鸟名（可能不等于输入名）；失败返回 None。
    """
    try:
        import dashscope
    except ImportError:
        print("❌ 自动添加鸟种失败: 未安装 dashscope")
        return None

    prompt = f"""
请为观鸟入门者撰写关于「{name}」的简要百科资料。

【物种级要求 — 最高优先级】
- 如果「{name}」是具体物种（如红尾水鸲、纵纹腹小鸮），直接基于该物种撰写。
- 如果「{name}」是统称或泛称（如猫头鹰、麻雀、鹰、鸭子），请先判断它最可能指代的常见具体物种，然后基于该具体物种撰写全部内容。
- 「规范中文名」一节必须填写你最终采用的具体物种标准中文名（若输入已是具体物种则原样填写）。

【名称格式硬性要求】
- 英文名：该物种的标准英文俗名，只含英文，禁止夹带中文或注释。
- 拉丁名：必须是双名法物种学名（属名首字母大写 + 种加词小写，如 Pycnonotus jocosus），禁止输出目/科/属级分类名（如 Strigiformes、Corvidae），禁止任何括号注释。

请严格按以下格式输出（不要有任何多余内容）：

--- 规范中文名 ---
（该物种的标准中文名）

--- 英文名 ---
（该鸟种的标准英文名）

--- 拉丁名 ---
（该鸟种的标准拉丁学名，格式如 Pycnonotus jocosus）

--- 外貌特征 ---
（50-80字，描述体型、羽色、最显著的辨识特征）

--- 生活习性 ---
（50-80字，描述栖息地、食性、行为特点）

--- 鸣叫特点 ---
（30-50字，描述叫声）

--- 分布区域 ---
（30-50字，描述主要分布地区，尤其注意是否分布在中国和新加坡）

--- 趣味冷知识 ---
（一句话有趣的冷知识）

--- 类别 ---
（城市鸟/林鸟/水鸟/猛禽 之一）

--- 稀有度 ---
（极度常见/常见/罕见/稀有 之一）

--- 常见地点 ---
（一句话描述在哪里最容易见到）
"""

    for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
        try:
            response = dashscope.Generation.call(
                model='qwen-flash',
                messages=[{"role": "user", "content": prompt}]
            )
        except Exception as e:
            print(f"⚠️ 第 {attempt} 次生成请求异常: {e}")
            continue

        if response.status_code != 200:
            print(f"⚠️ 第 {attempt} 次生成失败（API status {response.status_code}）: {response.message}")
            continue

        generated = response.output.text

        canonical_name = _extract_section(generated, "规范中文名") or name
        final_english = _extract_section(generated, "英文名") or english_name
        final_latin = _extract_section(generated, "拉丁名") or latin_name
        appearance = _extract_section(generated, "外貌特征")
        habitat = _extract_section(generated, "生活习性")
        call = _extract_section(generated, "鸣叫特点")
        distribution = _extract_section(generated, "分布区域")
        fun_fact = _extract_section(generated, "趣味冷知识")
        category = _extract_section(generated, "类别") or "林鸟"
        rarity = _extract_section(generated, "稀有度") or "常见"
        location = _extract_section(generated, "常见地点") or "公园绿地"

        # 物种级名称校验：空值 / 夹中文 / 非双名法 → 重试，绝不写入空字段文件
        missing = []
        if not _valid_english_name(final_english):
            missing.append("英文名")
        if not _valid_latin_name(final_latin):
            missing.append("拉丁名")
        if missing:
            print(f"⚠️ 第 {attempt} 次生成缺少合规字段（{'、'.join(missing)}），重试...")
            continue

        # ── 权威源事后校验：iNaturalist taxa API ──
        # 内容不一致 → 判本次生成失败走重试；网络/接口异常 → 降级跳过（WARNING），校验是增强不是门禁
        verified = _verify_with_inaturalist(final_latin, canonical_name)
        if verified is False:
            print(f"⚠️ 第 {attempt} 次生成未通过 iNaturalist 校验（拉丁名/中文名不一致），重试...")
            continue
        if verified is None:
            print(f"⚠️ WARNING: iNaturalist 校验本次未执行（网络/接口异常），仅格式校验，照常入库: {canonical_name}")
        inat_id = (verified or {}).get("id")

        os.makedirs(KB_DIR, exist_ok=True)

        inat_line = f"inaturalist_id: {inat_id}\n" if inat_id else ""
        md_content = f"""---
name: {canonical_name}
englishName: {final_english}
latinName: {final_latin}
category: {category}
rarity: {rarity}
location: {location}
funFact: {fun_fact}
{inat_line}---

## 外貌特征
{appearance}

## 生活习性
{habitat}

## 鸣叫特点
{call}

## 分布区域
{distribution}
"""

        filepath = os.path.join(KB_DIR, f"{canonical_name}.md")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(md_content)

        print(f"🆕 自动新增鸟种到知识库: {canonical_name}")
        return canonical_name

    print(f"❌ 自动添加鸟种失败（{MAX_GENERATION_ATTEMPTS} 次尝试后仍缺必填字段）: {name}")
    return None


def _normalize_name(name: str) -> str:
    """鸟名归一化：去全部空格 + 全角转半角 + 小写（与 scripts/batch_eval.py 判定逻辑保持一致）"""
    s = str(name or "").strip()
    chars = []
    for ch in s:
        code = ord(ch)
        if code == 0x3000:  # 全角空格
            chars.append(" ")
        elif 0xFF01 <= code <= 0xFF5E:  # 全角字符 → 半角
            chars.append(chr(code - 0xFEE0))
        else:
            chars.append(ch)
    return "".join(chars).replace(" ", "").lower()


def find_kb_match(name: str) -> str | None:
    """
    候选鸟名与知识库已有鸟名的规范化匹配（后验匹配）：
    先精确相等，再双向子串（"白鹭"可匹配到"小白鹭"，"珠颈斑鸠 "也能精确命中）。
    返回匹配到的知识库鸟名；匹配不上返回 None（不硬凑）。
    """
    target = _normalize_name(name)
    if not target:
        return None
    kb_names = [m["name"] for m in get_bird_metadata()]
    for kb_name in kb_names:
        if _normalize_name(kb_name) == target:
            return kb_name
    for kb_name in kb_names:
        normalized = _normalize_name(kb_name)
        if normalized and (normalized in target or target in normalized):
            return kb_name
    return None