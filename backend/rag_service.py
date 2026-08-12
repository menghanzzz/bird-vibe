import os
import re
import yaml

# ═══════════════════════════════════════════════════════
# 纯文件系统知识库（替代 ChromaDB，零依赖）
# ═══════════════════════════════════════════════════════
KB_DIR = "./knowledge_base"


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


def semantic_search_birds(query: str, n_results: int = 5) -> list[dict]:
    """
    语义搜索：用户用自然语言描述找鸟。
    使用简单关键词匹配（对于 40-120 种鸟完全够用）。
    """
    query_lower = query.lower()
    results = []
    
    for filename in _list_kb_files():
        filepath = os.path.join(KB_DIR, filename)
        meta, body = _parse_md(filepath)
        name = meta.get("name", filename.replace(".md", ""))
        
        full_text = f"{name} {meta.get('englishName', '')} {meta.get('latinName', '')} {body}".lower()
        
        # 简单评分：query 中每个词在文档中出现的次数
        score = 0
        for word in query_lower.split():
            if len(word) > 1:
                score += full_text.count(word)
        
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


def add_bird_to_knowledge_base(name: str, english_name: str = "", latin_name: str = "") -> bool:
    """
    自动为新发现的鸟类生成知识库资料并入库。
    使用 DashScope API 生成结构化 Markdown。
    """
    try:
        import dashscope
        
        prompt = f"""
请为观鸟入门者撰写关于「{name}」的简要百科资料。

请严格按以下格式输出（不要有任何多余内容）：

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
        response = dashscope.Generation.call(
            model='qwen-turbo',
            messages=[{"role": "user", "content": prompt}]
        )
        
        if response.status_code != 200:
            return False
            
        generated = response.output.text
        
        def extract_section(text: str, title: str) -> str:
            match = re.search(rf'---\s*{title}\s*---\s*(.*?)(?=---\s*|$)', text, re.DOTALL)
            return match.group(1).strip() if match else ""
        
        english_name = extract_section(generated, "英文名") or english_name
        latin_name = extract_section(generated, "拉丁名") or latin_name
        appearance = extract_section(generated, "外貌特征")
        habitat = extract_section(generated, "生活习性")
        call = extract_section(generated, "鸣叫特点")
        distribution = extract_section(generated, "分布区域")
        fun_fact = extract_section(generated, "趣味冷知识")
        category = extract_section(generated, "类别") or "林鸟"
        rarity = extract_section(generated, "稀有度") or "常见"
        location = extract_section(generated, "常见地点") or "公园绿地"
        
        os.makedirs(KB_DIR, exist_ok=True)
        
        md_content = f"""---
name: {name}
englishName: {english_name}
latinName: {latin_name}
category: {category}
rarity: {rarity}
location: {location}
funFact: {fun_fact}
---

## 外貌特征
{appearance}

## 生活习性
{habitat}

## 鸣叫特点
{call}

## 分布区域
{distribution}
"""
        
        filepath = os.path.join(KB_DIR, f"{name}.md")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(md_content)
        
        print(f"🆕 自动新增鸟种到知识库: {name}")
        return True
        
    except Exception as e:
        print(f"❌ 自动添加鸟种失败: {e}")
        return False