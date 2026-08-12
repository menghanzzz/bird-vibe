import os
import json
import tempfile
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import dashscope
import uvicorn

# 新增：RAG 检索层
from rag_service import (
    get_bird_metadata,
    get_bird_details,
    retrieve_context_for_birds,
    semantic_search_birds,
    add_bird_to_knowledge_base
)

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
# 改造原有路由：识别接口加入 RAG 增强
# ═══════════════════════════════════════════════════════
@app.post("/api/v1/recognize")
async def recognize_bird(
    image: UploadFile = File(...),
    location: str = Form(""),
    lat: str = Form(""),
    lng: str = Form("")
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

        # 关键改造：从向量库动态获取候选池，不再硬编码
        all_metas = get_bird_metadata()
        pokedex_names = ", ".join([b["name"] for b in all_metas])

        # 关键改造：RAG 检索增强 prompt
        # 为所有候选鸟检索资料注入上下文
        rag_context = ""

        location_prompt = f"文字描述：{location if location else '无'}"
        if lat and lng:
            location_prompt += f"\n精确GPS坐标：纬度 {lat}, 经度 {lng} (指令：你必须先在脑海中将该坐标解析为具体的国家和城市，然后严格依据该地的本地留鸟/候鸟名录进行推理！)"

        
        prompt_text = f"""
你是一个极其严谨的自然科学向导。

【核心线索】：
用户提供的线索是：图片。
用户的拍摄地点是：
{location_prompt}

【绝对强制要求 — 按优先级排序】：
1. 【先看图，再看名单】你必须首先仔细观察图片中的客观视觉特征：体型大小、主要羽色、头部有无特殊斑块/羽冠、喙色、腿色、翅膀颜色。用文字在脑海中描述你实际看到的，然后对照下方的候选名单进行匹配。禁止凭"感觉"或"整体色调"猜测！
2. 【颜色斑块位置是铁证】特别注意眼、头、喉、胸、翅、脚这几个部位的颜色差异。眼后是否有红斑？头顶是白、黑还是褐？胸部有无斑纹？喙和腿是什么颜色？这些细节是区分相似鸟种的唯一依据，必须如实描述。
3. 【地理位置排除法】根据拍摄地点判断哪些鸟种可能出现在该地区。如果某鸟种的分布明显不包含该地点，直接排除。但不要因为地点合适就强行匹配视觉不符的鸟种——视觉特征永远优先于地理位置。
4. 【候选池约束】你只能从以下官方图鉴列表中选择，必须【一字不差】地输出列表中的名字：
[{pokedex_names}]
5. 【新鸟处理】如果图片中的鸟完全不在上述列表中，请严格使用《世界鸟类名录》中的标准中文学名，绝对禁止生造词汇、使用地方俗名或笼统称（如"八哥"、"麻雀"）。
6. 【JSON格式】必须严格返回合法的JSON格式字符串，绝不要包含任何markdown语法（如```json等）。
7. 【置信度】confidence字段必须根据你对该候选的实际把握程度独立判断，top1通常在0.5~0.92之间，越靠后的候选越低，禁止所有候选填写相同的值。
8. 【诚实评估】certainty_level字段是你对top1识别结果的诚实自我评估：
   - "高"：图像清晰、特征明显，你有把握确定种类
   - "中"：能看到部分特征，有合理猜测但存在不确定性
   - "低"：图像模糊、角度不佳或特征不足，无法可靠判断种类
9. 【客观描述】feature_description字段：用一句话描述你在图中实际观察到的客观视觉特征（体型、羽色、姿态、喙色、腿色、头部斑块位置等），不要猜测种名。例如："一只体型中等、头顶黑色带白色斑块、眼后有红色小斑、喙细长的鸟"。

【重要提醒】：
- 红耳鹎的眼后有红色斑块，头顶黑色羽冠高耸。
- 白头鹎的头顶中央有白色斑块，眼后无红斑。
- 太平鸟的翅膀上有红色蜡质翅尖，体型较小。
- 不要把这些文字描述往图片上硬套，必须根据你实际观察到的图片特征来判断。

JSON结构必须完全一致：
{{
  "top5_candidates": [
    {{
      "name": "精确的中文学名",
      "confidence": 根据实际把握填写0到1之间的浮点数,
      "reason": "说明你实际观察到的视觉特征（颜色、斑纹位置、体型），并解释为什么排除其他相似鸟种"
    }}
  ],
  "certainty_level": "高或中或低",
  "feature_description": "一句话描述图中实际观察到的客观视觉特征，必须包含头部/眼部颜色细节",
  "is_rare": false
}}
"""

        content_list.append({"text": prompt_text})

        messages = [
            {
                "role": "user",
                "content": content_list
            }
        ]

        response = dashscope.MultiModalConversation.call(
            model='qwen-omni-turbo',
            messages=messages
        )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"阿里云API调用失败: {response.message}")

        result_text = response.output.choices[0].message.content[0]["text"]
        result_text = result_text.strip().removeprefix("```json").removesuffix("```").strip()

        result = json.loads(result_text)

        # 🆕 自动发现新鸟：如果 top1 不在现有图鉴中，自动添加
        all_names = [b["name"] for b in get_bird_metadata()]
        top1_name = result.get("top5_candidates", [{}])[0].get("name", "")

        if top1_name and top1_name not in all_names:
            print(f"🔍 发现新鸟种: {top1_name}，正在自动入库...")
            add_bird_to_knowledge_base(
                name=top1_name,
                english_name="",
                latin_name=""
            )
            result["is_new_bird"] = True

        return result

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="大模型返回的数据不是合法的JSON，请重试。")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == '__main__':
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
