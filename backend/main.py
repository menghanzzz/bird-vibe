import os
import json
import tempfile
import shutil
import re
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
import dashscope
import uvicorn

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

# ==================== 原有识别接口（完全保留）====================

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

        input_desc = "图片"
        reason_desc = "结合图片中的外貌羽色、体型等视觉特征的识别理由"

        pokedex_names = "树麻雀, 爪哇八哥, 珠颈斑鸠, 黑枕黄鹂, 白领翡翠, 苍鹭, 小白鹭, 红原鸡, 普通喜鹊, 乌鸫, 白鹡鸰, 普通翠鸟, 戴胜, 绿头鸭, 夜鹭, 大山雀, 画眉, 鸳鸯, 丹顶鹤, 红腹锦鸡, 黑天鹅, 游隼, 红嘴鸥, 家燕, 黄腹花蜜鸟, 冠斑犀鸟, 太平鸟, 领雀嘴鹎, 灰喜鹊, 红头长尾山雀"

        location_prompt = f"文字描述：{location if location else '无'}"
        if lat and lng:
            location_prompt += f"\n精确GPS坐标：纬度 {lat}, 经度 {lng} (指令：你必须先在脑海中将该坐标解析为具体的国家和城市，然后严格依据该地的本地留鸟/候鸟名录进行推理！)"

        prompt_text = f"""
你是一个极其严谨的自然科学向导。

【核心线索】：
用户提供的线索是：{input_desc}。
用户的拍摄地点是：
{location_prompt}

【绝对强制要求】：
1. 必须基于拍摄地点的地理位置（国家、城市、生境）进行交叉验证。
2. 优先查阅官方图鉴列表：[{pokedex_names}]。如果识别出的鸟类在这个列表中，你必须【一字不差】地输出列表中的名字！
3. 如果该鸟类完全不在上述列表中，请严格使用《世界鸟类名录》中的标准中文学名，绝对禁止生造词汇、使用地方俗名或笼统统称（如"八哥"、"麻雀"）。
4. 必须严格返回合法的JSON格式字符串，绝不要包含任何markdown语法（如```json等）。
5. confidence字段必须根据你对该候选的实际把握程度独立判断，top1通常在0.5~0.92之间，越靠后的候选越低，禁止所有候选填写相同的值。
6. certainty_level字段是你对top1识别结果的诚实自我评估：
   - "高"：图像清晰、特征明显，你有把握确定种类
   - "中"：能看到部分特征，有合理猜测但存在不确定性
   - "低"：图像模糊、角度不佳或特征不足，无法可靠判断种类
7. feature_description字段：用一句话描述你在图中实际观察到的客观视觉特征（体型、羽色、姿态等），不要猜测种名，例如"一只体型中等、背部偏灰褐色、停栖在树枝上的鸟"。

JSON结构必须完全一致：
{{
  "top5_candidates": [
    {{
      "name": "精确的中文学名",
      "confidence": 根据实际把握填写0到1之间的浮点数,
      "reason": "{reason_desc}，并结合解析出的地理位置（国家/城市）进行解释"
    }}
  ],
  "certainty_level": "高或中或低",
  "feature_description": "一句话描述图中观察到的客观视觉特征",
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

        return json.loads(result_text)

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="大模型返回的数据不是合法的JSON，请重试。")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


# ==================== 新增：RAG 知识库问答 ====================

# 回退数据（当 data/birds.pdf 不存在时使用）
FALLBACK_KNOWLEDGE = """
【树麻雀】Eurasian Tree Sparrow (Passer montanus)
分类：城市鸟 | 稀有度：极度常见 | 生境：街头巷尾
趣味知识：脸颊上有明显的黑斑。
外貌特征：体长约14厘米，体型圆润娇小。头顶栗褐色，最显著的特征是纯白色脸颊上各有一块清晰的黑色圆斑，如同贴了贴纸。背部褐色带黑色纵纹，腹部污白色。雌雄羽色相似，是少数雌雄难以区分的雀类之一。
生活习性：与人类共生的典型城市鸟，几乎不在远离建筑的地方生活。地面移动时双脚并拢蹦跳，不会单脚交替走路。喜欢成群在草丛或灌木中叽喳，会在干燥沙土上进行沙浴以去除羽毛寄生虫。杂食性，以草籽、谷物和昆虫为食。
鸣叫特点：叫声短促清脆，为单调的「喳、喳、喳」（tsip-tsip），没有复杂旋律。大群聚集时声音嘈杂密集，繁殖期雄鸟会发出更为连续的鸣唱以吸引配偶。
分布区域：广泛分布于欧亚大陆，是城市、农村最常见的鸟类之一。无论是组屋草地、小贩中心外围、还是校园角落，只要有食物和绿化，随处可见其蹦跳身影。

【爪哇八哥】Javan Myna (Acridotheres javanicus)
分类：城市鸟 | 稀有度：极度常见 | 生境：小贩中心
趣味知识：极度聪明，擅长模仿。
外貌特征：体长约24厘米，全身深黑色或暗灰色，额头有一小撮竖起的朋克式羽冠。最醒目的是鲜黄色的喙和双腿。飞行时翅膀基部闪现两块白色斑块，是重要的飞行辨识特征。眼周有黄色裸皮。
生活习性：性格极其大胆自信，是小贩中心和露天餐厅的常客。地面行走时大摇大摆迈步，不像麻雀那样蹦跳。智商极高，会跟随除草机捡食被惊飞的昆虫。傍晚大群聚集夜栖树，场面壮观。杂食性，食谱极广。
鸣叫特点：大嗓门，叫声粗厉沙哑且变化多端。作为椋鸟科成员，擅长模仿环境中的各种声音，包括口哨声、其他鸟类叫声甚至人类说话声。
分布区域：原产印尼爪哇岛，引入后凭借超强适应力成为本地最强势的鸟种之一，在东南亚各大城市数量庞大，被列为入侵物种。

【白领翡翠】Collared Kingfisher (Todiramphus chloris)
分类：水鸟 | 稀有度：常见 | 生境：红树林
趣味知识：脾气火爆的捕鱼高手。
外貌特征：体长约24厘米，背部、翅膀和尾羽为鲜艳的翠蓝绿色，腹部洁白，颈部有白色领环，「白领」之名由此而来。头顶蓝绿色，过眼纹黑色。喙粗长而有力，黑色，是捕猎的利器。
生活习性：领地意识极强，性格凶悍，会主动驱逐进入领地的其他鸟类。常静止栖于突出枝头或电线上俯视水面，发现猎物后俯冲捕捉。食物多样，包括鱼类、蟹、蜥蜴和昆虫，并非只吃鱼。
鸣叫特点：叫声响亮刺耳，为连续急促的「kek-kek-kek-kek」，具有强烈的宣示领地意味。声音远比外形凶悍，常在清晨率先打破宁静。
分布区域：广泛分布于南亚、东南亚至太平洋岛屿。本地在红树林、海岸、河岸及城市绿地均十分常见，是最容易观察到的翠鸟科成员。
"""

_knowledge_chunks = []

def load_knowledge_base():
    """加载知识库：优先读取 data/birds.pdf，否则用回退数据"""
    global _knowledge_chunks
    if _knowledge_chunks:
        return _knowledge_chunks

    pdf_path = os.path.join(os.path.dirname(__file__), "..", "data", "birds.pdf")
    text = ""

    if os.path.exists(pdf_path):
        try:
            import pypdf
            reader = pypdf.PdfReader(pdf_path)
            for page in reader.pages:
                text += page.extract_text() + "\n"
            print(f"[RAG] Loaded PDF: {len(reader.pages)} pages")
        except Exception as e:
            print(f"[RAG] PDF read failed: {e}, using fallback")
            text = FALLBACK_KNOWLEDGE
    else:
        print("[RAG] data/birds.pdf not found, using fallback dummy data")
        text = FALLBACK_KNOWLEDGE

    # 分块：按【鸟名】分割
    chunks = [c.strip() for c in re.split(r'(?=【)', text) if len(c.strip()) > 20]
    if len(chunks) <= 2:
        chunks = [c.strip() for c in text.split("\n\n") if len(c.strip()) > 20]

    _knowledge_chunks = chunks
    return chunks

def retrieve_relevant_chunks(query: str, top_k: int = 3):
    """关键词检索"""
    chunks = load_knowledge_base()
    keywords = [k for k in query.lower().split() if len(k) > 1]

    scored = []
    for chunk in chunks:
        lower = chunk.lower()
        score = sum(1 for kw in keywords if kw in lower)
        if lower.find(query.lower()) != -1:
            score += 5
        if score > 0:
            scored.append((chunk, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [c for c, _ in scored[:top_k]]


@app.post("/api/v1/chat")
async def chat_with_rag(request: dict):
    """
    RAG 聊天接口
    请求体：{"messages": [{"role": "user", "content": "..."}, ...]}
    """
    messages = request.get("messages", [])
    if not messages:
        raise HTTPException(status_code=400, detail="messages 不能为空")

    # 取最后一条用户消息做检索
    last_user_msg = None
    for m in reversed(messages):
        if m.get("role") == "user":
            last_user_msg = m.get("content", "")
            break

    query = last_user_msg or ""
    relevant = retrieve_relevant_chunks(query, top_k=3)
    knowledge_context = "\n\n---\n\n".join(relevant) if relevant else "暂无直接匹配的鸟类知识。"

    system_prompt = f"""你是一位专业的鸟类学顾问，也是 BirdVibe 平台的 AI 向导。你的任务是基于知识库回答用户的观鸟问题。

## 回答原则：
1. **基于知识**：优先使用下方提供的鸟类知识回答，不要编造信息。
2. **诚实边界**：如果知识库中没有相关信息，明确告知用户，并给出合理的推测或建议。
3. **新手友好**：用通俗有趣的语言解释专业概念，适当使用emoji增加亲和力。
4. **对比分析**：如果用户问"如何区分A和B"，用清晰的对比点（颜色、体型、行为、叫声）帮助区分。
5. **实用建议**：如果用户问"在哪里能看到"，结合分布信息给出具体建议。
6. **引用来源**：回答中提及具体鸟类时，用【】标注鸟名。

## 可用鸟类知识（已根据你的问题检索出最相关的内容）：
{knowledge_context}

## 当前知识库说明：
本知识库目前收录了多种常见鸟类，涵盖城市鸟、林鸟、水鸟、猛禽等。如果用户问题超出范围，请鼓励用户使用识别功能上传照片。"""

    # 构建完整消息列表
    full_messages = [{"role": "system", "content": system_prompt}]
    for m in messages:
        full_messages.append({"role": m["role"], "content": m["content"]})

    # 调用千问（非流式，简单直接）
    response = dashscope.Generation.call(
        model="qwen-turbo",
        messages=full_messages,
        result_format="message"
    )

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"阿里云API调用失败: {response.message}")

    answer = response.output.choices[0].message.content
    return {"role": "assistant", "content": answer}


if __name__ == '__main__':
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
