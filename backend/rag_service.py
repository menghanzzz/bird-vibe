import os
import re
import dashscope
import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
import yaml

# ═══════════════════════════════════════════════════════
# ChromaDB 客户端（懒加载）
# 使用 chromadb 内置默认 ONNX embedding，无需 sentence-transformers
# ═══════════════════════════════════════════════════════
_chroma_client = None
_collection = None

def _get_collection():
    """获取或初始化 ChromaDB collection"""
    global _chroma_client, _collection
    if _collection is None:
        ef = DefaultEmbeddingFunction()
        _chroma_client = chromadb.PersistentClient(path="./chroma_db")
        _collection = _chroma_client.get_collection("bird_knowledge", embedding_function=ef)
    return _collection


def get_bird_metadata() -> list[dict]:
    """
    返回所有鸟种的轻量元数据列表。
    用于前端图鉴卡片渲染（替代原来硬编码的 baseBirds 骨架）。
    """
    coll = _get_collection()
    results = coll.get()
    metas = []
    for i, meta in enumerate(results["metadatas"]):
        metas.append({
            "id": i + 1,
            "name": meta["name"],
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
    coll = _get_collection()
    results = coll.query(
        query_texts=[name],
        n_results=1,
        where={"name": name}
    )
    if not results["documents"] or not results["documents"][0]:
        return None

    doc = results["documents"][0][0]
    meta = results["metadatas"][0][0]

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
        match = re.search(pattern, doc, re.DOTALL)
        if match:
            sections[key] = match.group(1).strip()

    return {
        "name": meta["name"],
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
    只提取【辨识特征】和【分布区域】，信息密度最高。
    """
    coll = _get_collection()
    contexts = []
    for name in bird_names:
        try:
            results = coll.query(
                query_texts=[name],
                n_results=1,
                where={"name": name}
            )
            if results["documents"] and results["documents"][0]:
                doc = results["documents"][0][0]
                
                appearance = ""
                distribution = ""
                
                app_match = re.search(
                    r"##\s*外貌特征\s*\n(.*?)(?=\n##\s|\Z)", 
                    doc, 
                    re.DOTALL
                )
                if app_match:
                    appearance = app_match.group(1).strip()[:180]
                
                dist_match = re.search(
                    r"##\s*分布区域\s*\n(.*?)(?=\n##\s|\Z)", 
                    doc, 
                    re.DOTALL
                )
                if dist_match:
                    distribution = dist_match.group(1).strip()
                
                parts = [f"【{name}】"]
                if appearance:
                    parts.append(f"关键辨识：{appearance}...")
                if distribution:
                    parts.append(f"分布：{distribution}")
                
                contexts.append(" | ".join(parts))
        except Exception:
            continue
    return "\n\n".join(contexts)


def semantic_search_birds(query: str, n_results: int = 5) -> list[dict]:
    """
    语义搜索：用户用自然语言描述找鸟。
    """
    coll = _get_collection()
    results = coll.query(query_texts=[query], n_results=n_results)
    candidates = []
    for i in range(len(results["documents"][0])):
        candidates.append({
            "name": results["metadatas"][0][i]["name"],
            "category": results["metadatas"][0][i].get("category", ""),
            "rarity": results["metadatas"][0][i].get("rarity", ""),
            "snippet": results["documents"][0][i][:300] + "..."
        })
    return candidates


def add_bird_to_knowledge_base(name: str, english_name: str = "", latin_name: str = "") -> bool:
    """
    自动为新发现的鸟类生成知识库资料并入库。
    使用 DashScope API 生成结构化 Markdown。
    """
    try:
        prompt = f"""
请为观鸟入门者撰写关于「{name}」的简要百科资料。
如果英文名是 {english_name} 或拉丁名是 {latin_name}，请一并标注。

请严格按以下格式输出（不要有任何多余内容）：

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
        
        appearance = extract_section(generated, "外貌特征")
        habitat = extract_section(generated, "生活习性")
        call = extract_section(generated, "鸣叫特点")
        distribution = extract_section(generated, "分布区域")
        fun_fact = extract_section(generated, "趣味冷知识")
        category = extract_section(generated, "类别") or "林鸟"
        rarity = extract_section(generated, "稀有度") or "常见"
        location = extract_section(generated, "常见地点") or "公园绿地"
        
        kb_dir = "./knowledge_base"
        os.makedirs(kb_dir, exist_ok=True)
        
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
        
        filepath = os.path.join(kb_dir, f"{name}.md")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(md_content)
        
        coll = _get_collection()
        coll.add(
            documents=[md_content],
            metadatas=[{
                "name": name,
                "englishName": english_name,
                "latinName": latin_name,
                "category": category,
                "rarity": rarity,
                "location": location,
                "funFact": fun_fact,
                "source": f"{name}.md"
            }],
            ids=[name]
        )
        
        global _collection
        _collection = None
        
        print(f"🆕 自动新增鸟种到知识库: {name}")
        return True
        
    except Exception as e:
        print(f"❌ 自动添加鸟种失败: {e}")
        return False