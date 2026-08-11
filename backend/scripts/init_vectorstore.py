import os
import yaml
import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction


def main():
    print("🚀 正在初始化 BirdVibe 向量知识库...")
    print("💡 使用 chromadb 内置 ONNX 模型（无需 sentence-transformers）")

    ef = DefaultEmbeddingFunction()
    client = chromadb.PersistentClient(path="../chroma_db")

    # 如果已存在则删除重建（embedding 模型变了必须重建）
    try:
        client.delete_collection("bird_knowledge")
        print("🗑️  已清除旧知识库")
    except Exception:
        pass

    collection = client.create_collection("bird_knowledge", embedding_function=ef)

    kb_dir = "../knowledge_base"
    if not os.path.exists(kb_dir):
        print(f"❌ 知识库目录不存在: {kb_dir}")
        print("请先在 knowledge_base/ 目录下放入鸟类 Markdown 文件")
        return

    files = [f for f in os.listdir(kb_dir) if f.endswith(".md")]
    print(f"📚 发现 {len(files)} 个鸟类知识文件")

    for filename in sorted(files):
        filepath = os.path.join(kb_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # 解析 YAML frontmatter
        meta = {}
        body = content
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                meta = yaml.safe_load(parts[1])
                body = parts[2]

        bird_name = meta.get("name", filename.replace(".md", ""))

        full_doc = f"""鸟种：{meta.get('name', '')}
英文名：{meta.get('englishName', '')}
拉丁名：{meta.get('latinName', '')}
类别：{meta.get('category', '')}
稀有度：{meta.get('rarity', '')}
常见地点：{meta.get('location', '')}
趣味知识：{meta.get('funFact', '')}

详细资料：
{body.strip()}
"""

        collection.add(
            documents=[full_doc],
            metadatas=[{
                "name": bird_name,
                "englishName": meta.get("englishName", ""),
                "latinName": meta.get("latinName", ""),
                "category": meta.get("category", ""),
                "rarity": meta.get("rarity", ""),
                "location": meta.get("location", ""),
                "funFact": meta.get("funFact", ""),
                "source": filename
            }],
            ids=[bird_name]
        )
        print(f"  ✅ {bird_name}")

    print(f"\n🎉 完成！总计入库 {collection.count()} 种鸟类")
    print("💡 向量库已持久化到 ../chroma_db/ 目录")


if __name__ == "__main__":
    main()