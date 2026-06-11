import os
import json
import tempfile
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import dashscope
import uvicorn

# 1. 基础配置：加载环境变量并设置阿里云 API Key
load_dotenv()
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")

if not dashscope.api_key:
    raise RuntimeError("未找到 DASHSCOPE_API_KEY，请检查 .env 文件配置！")

app = FastAPI(title="BirdVibe API", description="初阶观鸟平台全栈项目")

# 配置 CORS，允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 面试/开发阶段允许所有跨域
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. 核心路由与参数接收
@app.post("/api/v1/recognize")
async def recognize_bird(
    image: UploadFile = File(None), 
    audio: UploadFile = File(None),
    location: str = Form(""),
    lat: str = Form(""),  # 🌟 新增：接收纬度
    lng: str = Form("")   # 🌟 新增：接收经度
):
    # 如果两个文件都没传，直接拦截
    if not image and not audio:
        raise HTTPException(status_code=400, detail="至少需要上传图片照片或鸟叫音频之一")

    temp_dir = tempfile.mkdtemp()
    
    try:
        content_list = []

        if image:
            image_path = os.path.join(temp_dir, image.filename)
            with open(image_path, "wb") as f:
                f.write(await image.read())
            content_list.append({"image": f"file://{image_path}"})

        if audio:
            audio_path = os.path.join(temp_dir, audio.filename)
            with open(audio_path, "wb") as f:
                f.write(await audio.read())
            content_list.append({"audio": f"file://{audio_path}"})

        has_image = bool(image)
        has_audio = bool(audio)
        
        if has_image and has_audio:
            input_desc = "图片和声音"
            reason_desc = "结合外貌羽色和鸣叫特征的识别理由"
        elif has_image:
            input_desc = "图片"
            reason_desc = "结合图片中的外貌羽色、体型等视觉特征的识别理由"
        else:
            input_desc = "声音"
            reason_desc = "结合声音中的鸣叫频率、节奏等听觉特征的识别理由"

        pokedex_names = "树麻雀, 爪哇八哥, 珠颈斑鸠, 黑枕黄鹂, 白领翡翠, 苍鹭, 小白鹭, 红原鸡, 普通喜鹊, 乌鸫, 白鹡鸰, 普通翠鸟, 戴胜, 绿头鸭, 夜鹭, 大山雀, 画眉, 鸳鸯, 丹顶鹤, 红腹锦鸡, 黑天鹅, 游隼, 红嘴鸥, 家燕, 黄腹花蜜鸟, 冠斑犀鸟, 太平鸟, 领雀嘴鹎, 灰喜鹊, 红头长尾山雀"

        # 🌟 动态构建位置描述，逼迫 AI 解析经纬度
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
        3. 如果该鸟类完全不在上述列表中，请严格使用《世界鸟类名录》中的标准中文学名，绝对禁止生造词汇、使用地方俗名或笼统统称（如“八哥”、“麻雀”）。
        4. 必须严格返回合法的JSON格式字符串，绝不要包含任何markdown语法（如```json等）。

        JSON结构必须完全一致：
        {{
            "top5_candidates": [
                {{
                    "name": "精确的中文学名",
                    "confidence": 0.95,
                    "reason": "{reason_desc}，并结合解析出的地理位置（国家/城市）进行解释"
                }}
            ],
            "is_rare": false
        }}
        """
        content_list.append({"text": prompt_text})
        

        # 4. 阿里云全模态调用
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

        # 5. 健壮性与结果返回
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"阿里云API调用失败: {response.message}")

        # 提取模型返回的文本并清理可能带有的 markdown 标记
        result_text = response.output.choices[0].message.content[0]["text"]
        result_text = result_text.strip().removeprefix("```json").removesuffix("```").strip()

        # 转换为标准 JSON 字典返回给前端
        return json.loads(result_text)

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="大模型返回的数据不是合法的JSON，请重试。")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 无论成功失败，必须清理临时文件，防止服务器存储爆炸
        shutil.rmtree(temp_dir, ignore_errors=True)

# 6. 服务启动
if __name__ == '__main__':
    # 使用 reload=True 方便你开发时修改代码自动重启
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)