import os
import json
import tempfile
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
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

if __name__ == '__main__':
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)