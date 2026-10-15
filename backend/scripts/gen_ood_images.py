#!/usr/bin/env python3
"""生成合成 OOD（分布外）测试图：系统面对非鸟输入时的拒绝行为。

局限说明：合成图 ≠ 真实世界非鸟照片（猫/车/风景），仅覆盖"明显非鸟"与
"简单鸟形剪影"两档，结论外推到真实 OOD 需谨慎。
"""
import random
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("/Users/menghanzhang/Desktop/bird/backend/eval_set/ood_photos")
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(7)


def noise_img(name, base):
    img = Image.new("RGB", (640, 480))
    px = img.load()
    for y in range(480):
        for x in range(640):
            px[x, y] = tuple(min(255, max(0, c + rng.randint(-60, 60))) for c in base)
    img.save(OUT / name)


def solid_img(name, c1, c2=None):
    img = Image.new("RGB", (640, 480), c1)
    if c2:
        d = ImageDraw.Draw(img)
        for i in range(480):
            t = i / 480
            col = tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))
            d.line([(0, i), (640, i)], fill=col)
    img.save(OUT / name)


def pattern_img(name, kind):
    img = Image.new("RGB", (640, 480), (240, 240, 235))
    d = ImageDraw.Draw(img)
    if kind == "stripes":
        for x in range(0, 640, 40):
            d.rectangle([x, 0, x + 20, 480], fill=(80, 120, 160))
    elif kind == "circles":
        for _ in range(25):
            x, y, r = rng.randint(0, 640), rng.randint(0, 480), rng.randint(15, 60)
            d.ellipse([x - r, y - r, x + r, y + r], outline=(40, 40, 40), width=4)
    else:  # grid
        for x in range(0, 640, 80):
            d.line([(x, 0), (x, 480)], fill=(30, 30, 30), width=3)
        for y in range(0, 480, 80):
            d.line([(0, y), (640, y)], fill=(30, 30, 30), width=3)
    img.save(OUT / name)


def silhouette_bird(name):
    """天空渐变 + 鸟形剪影（无纹理，测'鸟形即幻觉'倾向）。"""
    img = Image.new("RGB", (640, 480))
    d = ImageDraw.Draw(img)
    for i in range(480):
        t = i / 480
        col = (int(120 + 100 * t), int(170 + 40 * t), int(220 + 20 * t))
        d.line([(0, i), (640, i)], fill=col)
    cx, cy = 320, 240
    d.ellipse([cx - 90, cy - 50, cx + 90, cy + 50], fill=(35, 35, 40))      # 身体
    d.ellipse([cx + 50, cy - 80, cx + 110, cy - 20], fill=(35, 35, 40))     # 头
    d.polygon([(cx + 105, cy - 60), (cx + 150, cy - 45), (cx + 105, cy - 35)], fill=(200, 140, 40))  # 喙
    d.polygon([(cx - 20, cy + 40), (cx - 60, cy + 120), (cx + 10, cy + 45)], fill=(35, 35, 40))      # 尾
    img.save(OUT / name)


noise_img("ood01_彩色噪点.jpg", (150, 120, 100))
noise_img("ood02_绿色噪点.jpg", (80, 140, 80))
noise_img("ood03_灰色噪点.jpg", (128, 128, 128))
noise_img("ood04_蓝色噪点.jpg", (60, 100, 180))
solid_img("ood05_纯色红.jpg", (180, 50, 50))
solid_img("ood06_天空渐变.jpg", (100, 160, 220), (220, 230, 240))
solid_img("ood07_草地渐变.jpg", (60, 120, 60), (150, 180, 110))
pattern_img("ood08_条纹.jpg", "stripes")
pattern_img("ood09_圆圈.jpg", "circles")
pattern_img("ood10_网格.jpg", "grid")
silhouette_bird("ood11_鸟形剪影A.jpg")
silhouette_bird("ood12_鸟形剪影B.jpg")

print(f"生成 {len(list(OUT.glob('*.jpg')))} 张 OOD 图 -> {OUT}")
