#!/usr/bin/env python3
"""
识别接口批量 A/B 评估脚本：standard（带时空） vs free（极简 prompt）

流程：
1. 读 eval_photos.xlsx（按列名匹配，不依赖列顺序），照片在 eval_photos/ 目录
2. 每张照片跑两轮：
   - standard：带 location/date 参数（元数据里有的才传）
   - free：只传 prompt_mode=free
3. 回填 Excel 四列：带时空 top3 / 不带 top3 / top1 命中 / top3 命中
   （命中两列以 standard 轮为准；原始响应存 eval_raw/照片名_模式.json）
4. 生成 eval_report.md（分模式统计 + 疑似命中/格式异常清单 + 空白结论区）

防污染（最重要）：
- 默认由本脚本启动隔离后端：把真实知识库复制到临时目录，
  用 BIRD_KB_DIR 环境变量（rag_service 支持）指向该副本，
  识别错的新鸟种只会写进副本，跑完自动删除，绝不写真实 knowledge_base/
- 脚本启动即断言：临时目录解析后的路径 ≠ 真实知识库路径，否则直接退出
- 若 8000 端口已被占用（外部后端），脚本拒绝启动并提示，避免无法保证隔离

用法（用 backend/venv 的 python 跑，不 import main.py）：
  backend/venv/bin/python backend/scripts/batch_eval.py                    # 完整跑（自动起隔离后端）
  backend/venv/bin/python backend/scripts/batch_eval.py --limit 2        # 只跑前 2 张（调试）
  backend/venv/bin/python backend/scripts/batch_eval.py --only 4.jpg,5.jpg  # 只跑指定照片（增量补行免全量重跑）
  backend/venv/bin/python backend/scripts/batch_eval.py --no-server \
      --base-url http://127.0.0.1:8765                                   # 不打理后端（mock/自管服务）

请求可靠性：单轮失败自动重试（首次 + 最多 3 次，退避 1s/2s/4s），重试耗尽才记异常；
每张照片三轮之间各间隔 1s 降低限流概率。注意：不带 --only/--limit 重跑是**全量**重跑。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from datetime import date, datetime
from pathlib import Path

import requests
from openpyxl import load_workbook

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_EXCEL = BACKEND_DIR / "eval_photos.xlsx"
DEFAULT_PHOTOS_DIR = BACKEND_DIR / "eval_photos"
DEFAULT_RAW_DIR = BACKEND_DIR / "eval_raw"
DEFAULT_REPORT = BACKEND_DIR / "eval_report.md"
REAL_KB = (BACKEND_DIR / "knowledge_base").resolve()
VENV_PYTHON = BACKEND_DIR / "venv" / "bin" / "python"
MAIN_PY = BACKEND_DIR / "main.py"
SERVER_LOG = BACKEND_DIR / "eval_server.log"
KB_ENV_VAR = "BIRD_KB_DIR"

HIT_NO_VAL, HIT_YES_VAL = "否", "是"

# Excel 列名（与 eval_photos.xlsx 表头一致；按名匹配，不依赖列顺序）
COL_PHOTO = "照片"
COL_ACTUAL = "实际鸟种"
COL_TOP3_STD = "带时空 top3"
COL_TOP3_FREE = "不带 top3"
COL_TOP1_HIT = "top1 命中"
COL_TOP3_HIT = "top3 命中"
COL_LOCATION = "地点"
COL_TIME = "时间"
REQUIRED_COLS = (COL_PHOTO, COL_ACTUAL, COL_TOP3_STD, COL_TOP3_FREE, COL_TOP1_HIT, COL_TOP3_HIT)
OPTIONAL_COLS = (COL_LOCATION, COL_TIME)
# 第三轮（bioclip 专用模型）/ 第四轮（微调 bioclip_tuned）回填列：旧表缺失时自动补到表尾
COL_TOP3_BIOCLIP = "bioclip top3"
COL_BIOCLIP_HIT = "bioclip 命中"
COL_TOP3_TUNED = "bioclip_tuned top3"
COL_TUNED_HIT = "bioclip_tuned 命中"
EXTRA_COLS = (COL_TOP3_BIOCLIP, COL_BIOCLIP_HIT, COL_TOP3_TUNED, COL_TUNED_HIT)

MIME_BY_SUFFIX = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
}

# 请求可靠性：单轮失败自动重试（首次 + 最多 3 次重试），指数退避 1s/2s/4s；
# 重试耗尽才记为格式异常。每张照片的轮次之间间隔 1s，降低 API 限流概率。
MAX_ATTEMPTS = 4
RETRY_BACKOFF_SECONDS = (1, 2, 4)
ROUND_PAUSE_SECONDS = 1.0


# ═══════════════════════════════════════════════════════
# 命中判定（独立函数，供 mock 测试覆盖）
# ═══════════════════════════════════════════════════════

# 评测别名表：模型常用名 → 金标/KB 规范名。
# 每条都必须有数据证据才允许加入（注释附证据数）；"银鸥→蒙古银鸥""斑鸠→珠颈斑鸠"
# 这类属级/歧义通名刻意不收——模型未到物种级就该记为未命中，不能靠别名表灌水。
NAME_ALIASES = {
    "喜鹊": "普通喜鹊",      # 7 张证据：模型答通用名"喜鹊"指普通喜鹊
    "黑嘴喜鹊": "普通喜鹊",  # 旧分类名，东亚喜鹊现已并入普通喜鹊 Pica pica
    "原鸡": "红原鸡",       # Gallus gallus 中文规范名差异（4 张证据）
}


def normalize_name(name) -> str:
    """归一化：剥离括号注释（如"黄鹡鸰（幼鸟）"→"黄鹡鸰"）+ 去空格 + 全半角统一 + 小写 + 别名映射。"""
    if name is None:
        return ""
    s = re.sub(r"[（(].*?[)）]", "", str(name).strip())  # 括号注释是回答风格，不是名字的一部分
    chars = []
    for ch in s:
        code = ord(ch)
        if code == 0x3000:  # 全角空格
            chars.append(" ")
        elif 0xFF01 <= code <= 0xFF5E:  # 全角字符 → 半角
            chars.append(chr(code - 0xFEE0))
        else:
            chars.append(ch)
    norm = "".join(chars).replace(" ", "").lower()
    return NAME_ALIASES.get(norm, norm)


def classify_match(actual, candidates):
    """
    判定实际鸟种与候选名单的关系，返回 (结果, 命中的候选原文)：
      - "exact"：归一化后与某候选完全相等（计入命中率分子）
      - "suspected"：子串/模糊命中（如"斑鸠" vs "珠颈斑鸠"；不计入分子，进报告人工复核）
      - "none"：完全无关
    先对所有候选做精确匹配再做子串匹配，避免"斑鸠"候选抢占"珠颈斑鸠"的 exact。
    """
    a = normalize_name(actual)
    if not a:
        return ("none", None)
    normalized = [(c, normalize_name(c)) for c in (candidates or [])]
    for original, norm in normalized:
        if norm and norm == a:
            return ("exact", original)
    for original, norm in normalized:
        if norm and (norm in a or a in norm):
            return ("suspected", original)
    return ("none", None)


# ═══════════════════════════════════════════════════════
# 知识库隔离（防污染）
# ═══════════════════════════════════════════════════════

def assert_kb_isolation(tmp_kb, real_kb=REAL_KB) -> None:
    """启动断言：临时知识库解析后的路径绝不允许等于（或互为）真实知识库路径。"""
    tmp_resolved = os.path.realpath(str(tmp_kb))
    real_resolved = os.path.realpath(str(real_kb))
    if tmp_resolved == real_resolved:
        raise AssertionError(f"临时知识库路径与真实知识库相同，禁止继续: {tmp_kb}")
    if real_resolved.startswith(tmp_resolved + os.sep) or tmp_resolved.startswith(real_resolved + os.sep):
        raise AssertionError(f"临时知识库与真实知识库存在目录包含关系，禁止继续: {tmp_kb} vs {real_kb}")


def port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex((host, port)) == 0


def start_isolated_server(port: int = 8000):
    """复制真实知识库到临时目录，用 BIRD_KB_DIR 启动隔离后端。返回 (proc, tmp_kb)。"""
    if not VENV_PYTHON.exists():
        raise SystemExit(f"找不到 venv python: {VENV_PYTHON}（请先重建 backend/venv）")
    if not MAIN_PY.exists():
        raise SystemExit(f"找不到 {MAIN_PY}")
    if not REAL_KB.exists():
        raise SystemExit(f"找不到真实知识库: {REAL_KB}")

    tmp_kb = Path(tempfile.mkdtemp(prefix="bird_eval_kb_"))
    assert_kb_isolation(tmp_kb, REAL_KB)
    shutil.copytree(REAL_KB, tmp_kb, dirs_exist_ok=True)

    # 评测期冻结自动入库：防止隔离 KB 随运行增长导致 BioCLIP softmax 分数随运行顺序漂移
    # （2026-10-14 实证，污染阈值类指标测量，详见 eval_set/EVAL_NOTES.md）
    env = dict(os.environ, **{KB_ENV_VAR: str(tmp_kb), "BIRD_DISABLE_INGEST": "1"})
    # 每次运行独立时间戳日志：固定文件名会被下一次运行截断，评测证据（入库日志/token 用量）会丢
    log_path = BACKEND_DIR / f"eval_server_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    log_f = open(log_path, "w", encoding="utf-8")
    proc = subprocess.Popen(
        [str(VENV_PYTHON), "main.py"],
        cwd=str(BACKEND_DIR),
        env=env,
        stdout=log_f,
        stderr=subprocess.STDOUT,
    )
    deadline = time.time() + 40
    while time.time() < deadline:
        if proc.poll() is not None:
            log_f.close()
            raise SystemExit(f"隔离后端启动失败（退出码 {proc.returncode}），日志见 {SERVER_LOG}")
        try:
            r = requests.get(f"http://127.0.0.1:{port}/api/v1/birds", timeout=2)
            if r.status_code == 200:
                print(f"[隔离后端] 已启动 pid={proc.pid}；临时知识库: {tmp_kb}（真实库的副本）")
                log_f.close()
                return proc, tmp_kb
        except Exception:
            pass
        time.sleep(0.5)
    proc.terminate()
    log_f.close()
    raise SystemExit(f"隔离后端 40 秒内未就绪，日志见 {SERVER_LOG}")


def stop_isolated_server(proc, tmp_kb) -> None:
    try:
        proc.terminate()
        proc.wait(timeout=10)
    except Exception:
        proc.kill()
    shutil.rmtree(tmp_kb, ignore_errors=True)
    print(f"[隔离后端] 已停止；临时知识库已删除: {tmp_kb}")


# ═══════════════════════════════════════════════════════
# Excel 读写（按列名匹配，保留其他列与格式）
# ═══════════════════════════════════════════════════════

def cell_str(value) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    return str(value).strip()


def open_excel(path):
    wb = load_workbook(path)
    ws = wb.active
    header = {}
    for cell in ws[1]:
        if cell.value is not None:
            header[str(cell.value).strip()] = cell.column
    missing = [c for c in REQUIRED_COLS if c not in header]
    if missing:
        raise SystemExit(f"Excel 缺少必需列 {missing}；实际表头: {list(header.keys())}")
    return wb, ws, header


def ensure_columns(ws, header, new_cols):
    """缺失的新列（如 bioclip 两轮新增）自动补到表尾，并更新 header 映射。"""
    for name in new_cols:
        if name not in header:
            col = ws.max_column + 1
            ws.cell(1, col).value = name
            header[name] = col
            print(f"[批量评估] Excel 自动补列: {name}（第 {col} 列）")


# ═══════════════════════════════════════════════════════
# 识别请求与响应解析
# ═══════════════════════════════════════════════════════

def post_recognize(base_url: str, photo_path: Path, params: dict, timeout: int = 120):
    url = base_url.rstrip("/") + "/api/v1/recognize"
    mime = MIME_BY_SUFFIX.get(photo_path.suffix.lower(), "application/octet-stream")
    with open(photo_path, "rb") as f:
        return requests.post(url, files={"image": (photo_path.name, f, mime)}, data=params, timeout=timeout)


def extract_top3(data):
    """解析 top3 候选名，返回 (names, anomalies)。候选不足3个/缺字段记入格式异常。"""
    anomalies = []
    if not isinstance(data, dict):
        return [], ["响应不是 JSON 对象"]
    cands = data.get("top5_candidates")
    if not isinstance(cands, list):
        return [], ["缺 top5_candidates 字段"]
    names = []
    for c in cands[:3]:
        if isinstance(c, dict) and c.get("name"):
            names.append(str(c["name"]))
        else:
            anomalies.append("候选结构异常（缺 name）")
    if not data.get("certainty_level"):
        anomalies.append("缺 certainty_level 字段")
    if len(cands) < 3:
        anomalies.append(f"候选不足3个（实际 {len(cands)} 个）")
    return names, anomalies


def run_one_round(base_url, photo_path, params, mode, raw_dir, photo_name):
    """
    跑一轮识别，返回 (top3_names, anomalies, recognizer, clarification)。
    网络错误/非 200/非 JSON 自动重试（首次 + 最多 3 次，退避 1s/2s/4s），重试耗尽才记异常并落 raw 文件。
    """
    stem = Path(photo_name).stem
    raw_path = raw_dir / f"{stem}_{mode}.json"
    last_error = None
    last_body = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        if attempt > 1:
            wait = RETRY_BACKOFF_SECONDS[attempt - 2]
            print(f"    [{mode}] 第 {attempt}/{MAX_ATTEMPTS} 次尝试（退避 {wait}s）...")
            time.sleep(wait)
        try:
            r = post_recognize(base_url, photo_path, params)
        except Exception as e:
            last_error, last_body = f"网络错误: {e}", None
            continue
        if r.status_code != 200:
            last_error, last_body = f"HTTP {r.status_code}", r.text[:500]
            continue
        try:
            data = r.json()
        except Exception:
            last_error, last_body = "响应非 JSON", r.text[:500]
            continue
        raw_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        names, anomalies = extract_top3(data)
        return (names, anomalies,
                (data.get("recognizer") if isinstance(data, dict) else None),
                bool(isinstance(data, dict) and data.get("clarification")))

    detail = {"error": f"{last_error}（重试 {MAX_ATTEMPTS - 1} 次后仍失败）"}
    if last_body:
        detail["body"] = last_body
    raw_path.write_text(json.dumps(detail, ensure_ascii=False, indent=2), encoding="utf-8")
    return [], [detail["error"]], None, False


def hits_for(actual: str, names):
    """返回 (top1是否命中, top3是否命中, 匹配类型, 命中的候选原文)；无实际种时命中为 None。"""
    if not actual:
        return (None, None, "none", None)
    top1_kind, top1_matched = classify_match(actual, names[:1])
    top3_kind, top3_matched = classify_match(actual, names)
    return (top1_kind == "exact", top3_kind == "exact", top3_kind, top3_matched or top1_matched)


# ═══════════════════════════════════════════════════════
# 报告
# ═══════════════════════════════════════════════════════

def _fmt_hit(hit):
    if hit is None:
        return "—"
    return HIT_YES_VAL if hit else HIT_NO_VAL


def _fmt_top3(names, anomalies):
    if names:
        return "、".join(names)
    return "（异常）" if anomalies else ""


def _pct(part, whole):
    return f"{part / whole * 100:.1f}%" if whole else "—（无标注样本）"


def build_report(records, report_path: Path, excel_name: str) -> None:
    lines = [
        "# 识别接口批量 A/B 评估报告",
        "",
        f"- 数据表：`{excel_name}`",
        "- 模式对比：standard（自由识别+后验匹配，带时空软提示） vs free（极简 prompt） vs bioclip（BioCLIP 专用模型，"
        "低于阈值自动回退千问，记 recognizer=qwen_fallback）",
        "- 命中判定：去空格 + 全半角统一后做精确匹配；子串/模糊命中（如「斑鸠」vs「珠颈斑鸠」）单列为"
        "「疑似命中」，不计入命中率分子，需人工复核",
        "- Excel 中「top1 命中 / top3 命中」两列以 standard 轮结果为准；「bioclip 命中」为 bioclip 轮 top3 精确命中",
        "",
        "## 每张照片汇总",
        "",
        "| 照片 | 实际种 | standard top3 | top1命中 | top3命中 | free top3 | top1命中 | top3命中 | bioclip top3 | bioclip命中 | bioclip_tuned top3 | tuned命中 |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for rec in records:
        std, free, bio, tuned = rec["standard"], rec["free"], rec["bioclip"], rec["bioclip_tuned"]
        bio_top3 = _fmt_top3(bio["names"], bio["anomalies"])
        if bio.get("fallback") and bio["names"]:
            bio_top3 += "（千问兜底）"
        if tuned.get("skipped"):
            tuned_top3 = "（未启用）"
        else:
            tuned_top3 = _fmt_top3(tuned.get("names", []), tuned.get("anomalies", []))
            if tuned.get("fallback") and tuned.get("names"):
                tuned_top3 += "（千问兜底）"
        lines.append(
            f"| {rec['photo']} | {rec['actual'] or '—'} "
            f"| {_fmt_top3(std['names'], std['anomalies'])} | {_fmt_hit(std['top1_hit'])} | {_fmt_hit(std['top3_hit'])} "
            f"| {_fmt_top3(free['names'], free['anomalies'])} | {_fmt_hit(free['top1_hit'])} | {_fmt_hit(free['top3_hit'])} "
            f"| {bio_top3} | {_fmt_hit(bio['top3_hit'])} "
            f"| {tuned_top3} | {_fmt_hit(tuned['top3_hit'])} |"
        )
    lines.append("")

    for mode, label in (("standard", "standard（自由识别+后验匹配）"), ("free", "free（极简 prompt）"),
                        ("bioclip", "bioclip（BioCLIP 专用模型）"), ("bioclip_tuned", "bioclip_tuned（微调模型）")):
        subs_all = [dict(rec[mode], photo=rec["photo"], actual=rec["actual"]) for rec in records]
        subs = [s for s in subs_all if s["attempted"]]
        n_total = len(subs)
        n_actual = sum(1 for s in subs if s["has_actual"])
        t1 = sum(1 for s in subs if s["top1_hit"] is True)
        t3 = sum(1 for s in subs if s["top3_hit"] is True)
        lines += [
            f"## {label} 统计",
            "",
            f"- 照片总数：{n_total}；其中有实际种标注：{n_actual}",
            f"- top1 命中率：{t1}/{n_actual} = {_pct(t1, n_actual)}",
            f"- top3 命中率：{t3}/{n_actual} = {_pct(t3, n_actual)}",
            f"- 触发主动消歧（追问）：{sum(1 for s in subs if s.get('clarification'))} 张"
            f"（用户答复会产生额外重识别调用，计入成本）",
            "",
        ]
        if mode == "bioclip":
            fallbacks = [s for s in subs if s.get("fallback")]
            lines.append(f"- 低于阈值回退千问兜底：{len(fallbacks)} 张"
                         + (f"（{', '.join(s['photo'] for s in fallbacks)}）" if fallbacks else ""))
            lines.append("")
        suspected = [s for s in subs if s["kind"] == "suspected"]
        lines.append(f"### 疑似命中清单（{len(suspected)}，不计入命中率，人工复核）")
        if suspected:
            for s in suspected:
                lines.append(f"- `{s['photo']}`：实际「{s['actual']}」≈ 候选「{s['matched']}」")
        else:
            lines.append("- 无")
        lines.append("")
        anomalies = [s for s in subs_all if s["anomalies"]]
        lines.append(f"### 格式异常清单（{len(anomalies)}）")
        if anomalies:
            for s in anomalies:
                lines.append(f"- `{s['photo']}`：{'；'.join(s['anomalies'])}")
        else:
            lines.append("- 无")
        lines.append("")

    # 微调 vs 零样本对比（bioclip_tuned 是否真为微调模型，取决于服务端是否以 BIRD_CLIP_CHECKPOINT 启动）
    def _mode_stats(mode):
        subs = [dict(rec[mode], photo=rec["photo"]) for rec in records if mode in rec]
        subs = [s for s in subs if s["attempted"]]
        n_actual = sum(1 for s in subs if s["has_actual"])
        t1 = sum(1 for s in subs if s["top1_hit"] is True)
        t3 = sum(1 for s in subs if s["top3_hit"] is True)
        fb = sum(1 for s in subs if s.get("fallback"))
        return t1, t3, n_actual, fb

    lines += ["## 微调 vs 零样本（BioCLIP）", ""]
    if records and all(r.get("bioclip_tuned", {}).get("skipped") for r in records):
        lines += ["（未启用：BIRD_CLIP_CHECKPOINT 未设置或权重文件不存在，本轮仅评估零样本 BioCLIP）", ""]
    elif any("bioclip_tuned" in r for r in records):
        b1, b3, bn, bfb = _mode_stats("bioclip")
        t1_, t3_, tn, tfb = _mode_stats("bioclip_tuned")
        lines += [
            "| 指标 | 零样本 bioclip | 微调 bioclip_tuned |",
            "|---|---|---|",
            f"| top1 命中率 | {b1}/{bn} = {_pct(b1, bn)} | {t1_}/{tn} = {_pct(t1_, tn)} |",
            f"| top3 命中率 | {b3}/{bn} = {_pct(b3, bn)} | {t3_}/{tn} = {_pct(t3_, tn)} |",
            f"| 低于阈值兜底 | {bfb} 张 | {tfb} 张 |",
            "",
            "> 注：若服务端未设置 BIRD_CLIP_CHECKPOINT，两轮为同一模型，本表仅作一致性对照。",
            "",
        ]
    else:
        lines += ["（本轮未请求 recognizer=bioclip_tuned）", ""]

    lines += ["## 结论", "", "（待手写）", ""]
    report_path.write_text("\n".join(lines), encoding="utf-8")


# ═══════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(description="识别接口批量 A/B 评估（standard vs free prompt）")
    ap.add_argument("--excel", default=str(DEFAULT_EXCEL), help="评估 Excel 路径")
    ap.add_argument("--photos", default=str(DEFAULT_PHOTOS_DIR), help="照片目录")
    ap.add_argument("--limit", type=int, default=None, help="只跑前 N 张（调试）")
    ap.add_argument("--only", default=None,
                    help="只跑指定照片（文件名，逗号或空格分隔），避免增量照片全量重跑花 API 费")
    ap.add_argument("--base-url", default="http://127.0.0.1:8000", help="识别服务地址")
    ap.add_argument("--no-server", action="store_true",
                    help="不自动启动隔离后端（用于 mock 或自管服务；此时知识库隔离需自行保证）")
    ap.add_argument("--raw-dir", default=str(DEFAULT_RAW_DIR), help="原始响应 JSON 存放目录")
    ap.add_argument("--report", default=str(DEFAULT_REPORT), help="报告输出路径")
    args = ap.parse_args()

    excel_path = Path(args.excel)
    photos_dir = Path(args.photos)
    raw_dir = Path(args.raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)

    wb, ws, header = open_excel(excel_path)
    ensure_columns(ws, header, EXTRA_COLS)
    last_row = ws.max_row
    # 目标行预筛选：--only 按文件名过滤（增量补照片时只跑新行），--limit 在过滤后截断
    only_set = set()
    if args.only:
        for part in re.split(r"[,，\s]+", args.only.strip()):
            if part:
                only_set.add(part)
    target_rows = []
    for ridx in range(2, last_row + 1):
        photo_name = cell_str(ws.cell(ridx, header[COL_PHOTO]).value)
        if not photo_name:
            continue
        if only_set and photo_name not in only_set:
            continue
        target_rows.append((ridx, photo_name))
        if args.limit is not None and len(target_rows) >= args.limit:
            break
    if only_set:
        matched = {name for _, name in target_rows}
        missing = only_set - matched
        if missing:
            print(f"[批量评估] ⚠️ --only 中未在 Excel 找到的照片: {sorted(missing)}")
    total = len(target_rows)
    print(f"[批量评估] 共 {total} 张照片（Excel: {excel_path}，服务: {args.base_url}）")

    # 第 4 轮开关：仅当微调权重真实存在时才跑 bioclip_tuned（否则与第 3 轮同一模型，白跑）
    ckpt = os.environ.get("BIRD_CLIP_CHECKPOINT", "")
    tuned_enabled = bool(ckpt) and Path(ckpt).exists()
    if not tuned_enabled:
        print("[批量评估] 未检测到微调权重（BIRD_CLIP_CHECKPOINT 未设置或文件不存在），跳过 bioclip_tuned 轮")

    proc = None
    tmp_kb = None
    records = []
    try:
        if not args.no_server:
            if port_in_use(8000):
                raise SystemExit(
                    "端口 8000 已被占用：无法保证知识库隔离，识别测试可能污染真实 knowledge_base/。\n"
                    "请先停止现有后端再重试；如确认自担风险，请加 --no-server。"
                )
            proc, tmp_kb = start_isolated_server()

        idx = 0
        for ridx, photo_name in target_rows:
            idx += 1
            actual = cell_str(ws.cell(ridx, header[COL_ACTUAL]).value)
            location = cell_str(ws.cell(ridx, header[COL_LOCATION]).value) if COL_LOCATION in header else ""
            time_val = cell_str(ws.cell(ridx, header[COL_TIME]).value) if COL_TIME in header else ""
            photo_path = photos_dir / photo_name
            photo_exists = photo_path.exists()

            rec = {"photo": photo_name, "actual": actual}

            # 第 1 轮：standard，带时空（元数据里有的才传）
            std_params = {}
            if location:
                std_params["location"] = location
            if time_val:
                std_params["date"] = time_val
            if photo_exists:
                std_names, std_anomalies, _, std_clar = run_one_round(args.base_url, photo_path, std_params, "standard", raw_dir, photo_name)
            else:
                std_names, std_anomalies, _, std_clar = [], [f"照片文件不存在: {photo_path}"], None, False
            t1, t3, kind, matched = hits_for(actual, std_names)
            rec["standard"] = {
                "attempted": photo_exists, "has_actual": bool(actual),
                "names": std_names, "anomalies": std_anomalies,
                "top1_hit": t1, "top3_hit": t3, "kind": kind, "matched": matched,
                "clarification": std_clar,
            }
            if photo_exists:
                time.sleep(ROUND_PAUSE_SECONDS)  # 轮次间隔，降低限流概率

            # 第 2 轮：free，只传 prompt_mode=free
            if photo_exists:
                free_names, free_anomalies, _, free_clar = run_one_round(
                    args.base_url, photo_path, {"prompt_mode": "free"}, "free", raw_dir, photo_name)
            else:
                free_names, free_anomalies, _, free_clar = [], [f"照片文件不存在: {photo_path}"], None, False
            t1f, t3f, kindf, matchedf = hits_for(actual, free_names)
            rec["free"] = {
                "attempted": photo_exists, "has_actual": bool(actual),
                "names": free_names, "anomalies": free_anomalies,
                "top1_hit": t1f, "top3_hit": t3f, "kind": kindf, "matched": matchedf,
                "clarification": free_clar,
            }
            if photo_exists:
                time.sleep(ROUND_PAUSE_SECONDS)  # 轮次间隔，降低限流概率

            # 第 3 轮：bioclip 专用模型（BioCLIP 不可用时服务端自动回退千问，响应 recognizer=qwen_fallback）
            if photo_exists:
                bio_names, bio_anomalies, bio_recognizer, bio_clar = run_one_round(
                    args.base_url, photo_path, {"recognizer": "bioclip"}, "bioclip", raw_dir, photo_name)
            else:
                bio_names, bio_anomalies, bio_recognizer, bio_clar = [], [f"照片文件不存在: {photo_path}"], None, False
            t1b, t3b, kindb, matchedb = hits_for(actual, bio_names)
            rec["bioclip"] = {
                "attempted": photo_exists, "has_actual": bool(actual),
                "names": bio_names, "anomalies": bio_anomalies,
                "top1_hit": t1b, "top3_hit": t3b, "kind": kindb, "matched": matchedb,
                "fallback": bio_recognizer == "qwen_fallback",
                "clarification": bio_clar,
            }

            # 第 4 轮：bioclip_tuned（仅当微调权重存在时启用；否则与第 3 轮为同一模型，跳过避免白跑）
            if tuned_enabled:
                if photo_exists:
                    tuned_names, tuned_anomalies, tuned_recognizer, tuned_clar = run_one_round(
                        args.base_url, photo_path, {"recognizer": "bioclip_tuned"}, "bioclip_tuned", raw_dir, photo_name)
                else:
                    tuned_names, tuned_anomalies, tuned_recognizer, tuned_clar = [], [f"照片文件不存在: {photo_path}"], None, False
                t1t, t3t, kindt, matchedt = hits_for(actual, tuned_names)
                rec["bioclip_tuned"] = {
                    "attempted": photo_exists, "has_actual": bool(actual),
                    "names": tuned_names, "anomalies": tuned_anomalies,
                    "top1_hit": t1t, "top3_hit": t3t, "kind": kindt, "matched": matchedt,
                    "fallback": tuned_recognizer == "qwen_fallback",
                    "clarification": tuned_clar,
                }
            else:
                tuned_names, t1t, t3t = [], None, None
                rec["bioclip_tuned"] = {"attempted": False, "skipped": True,
                                        "top1_hit": None, "top3_hit": None, "anomalies": []}

            # 回填 Excel（top1/top3 命中列以 standard 轮为准；bioclip/bioclip_tuned 命中=top3 精确命中；无实际种时命中列留空）
            ws.cell(ridx, header[COL_TOP3_STD]).value = "、".join(std_names) if std_names else None
            ws.cell(ridx, header[COL_TOP3_FREE]).value = "、".join(free_names) if free_names else None
            ws.cell(ridx, header[COL_TOP3_BIOCLIP]).value = "、".join(bio_names) if bio_names else None
            ws.cell(ridx, header[COL_TOP3_TUNED]).value = "、".join(tuned_names) if tuned_names else None
            if actual:
                ws.cell(ridx, header[COL_TOP1_HIT]).value = HIT_YES_VAL if t1 else HIT_NO_VAL
                ws.cell(ridx, header[COL_TOP3_HIT]).value = HIT_YES_VAL if t3 else HIT_NO_VAL
                ws.cell(ridx, header[COL_BIOCLIP_HIT]).value = HIT_YES_VAL if t3b else HIT_NO_VAL
                ws.cell(ridx, header[COL_TUNED_HIT]).value = (
                    None if t3t is None else (HIT_YES_VAL if t3t else HIT_NO_VAL))
            records.append(rec)

            flag = "⚠️" if (std_anomalies or free_anomalies or bio_anomalies
                            or rec["bioclip_tuned"]["anomalies"]) else "✓"
            tuned_seg = (
                f"tuned: {'、'.join(tuned_names) or '（异常）'} "
                f"{'(兜底千问) ' if rec['bioclip_tuned'].get('fallback') else ''}top3:{_fmt_hit(t3t)}"
                if tuned_enabled else "tuned: （跳过，无微调权重）")
            print(f"[{idx}/{total}] {flag} {photo_name} | 实际: {actual or '—'} | "
                  f"std: {'、'.join(std_names) or '（异常）'} top1:{_fmt_hit(t1)} top3:{_fmt_hit(t3)} | "
                  f"free: {'、'.join(free_names) or '（异常）'} top1:{_fmt_hit(t1f)} top3:{_fmt_hit(t3f)} | "
                  f"bioclip: {'、'.join(bio_names) or '（异常）'} "
                  f"{'(兜底千问) ' if rec['bioclip']['fallback'] else ''}top3:{_fmt_hit(t3b)} | "
                  + tuned_seg)

        wb.save(excel_path)
        build_report(records, Path(args.report), excel_path.name)
        print(f"[批量评估] 完成：Excel 已回填 -> {excel_path}")
        print(f"[批量评估] 原始响应 -> {raw_dir}；报告 -> {args.report}")
    finally:
        if proc is not None:
            stop_isolated_server(proc, tmp_kb)


if __name__ == "__main__":
    main()
