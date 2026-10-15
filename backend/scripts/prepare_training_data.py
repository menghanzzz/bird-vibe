#!/usr/bin/env python3
"""
从 iNaturalist 开放 API 批量下载授权鸟类照片，为 BioCLIP 微调准备数据集。

合规与数据质量原则：
- 仅取 CC0 / CC-BY 授权照片（CC-BY-NC 等非商用协议不取，避免非商用限制）；
- 仅取 research grade（社区已审定，标签可信）；官方公开 v1 API；
- photo 级二次校验 license_code（照片许可可能与观察记录不同）；
- 遵守 ≥1.5s 请求间隔，429/5xx 指数退避重试；失败物种记录后继续，不中断；
- manifest.json 记录授权码、来源 observation 链接与作者，供版权署名。

用法（backend/venv 的 python，从 backend/ 目录跑）：
  venv/bin/python scripts/prepare_training_data.py --species 树麻雀 --limit 3   # 单物种全流程调试
  venv/bin/python scripts/prepare_training_data.py --species 大白鹭,中白鹭       # 指定物种（逗号/空格分隔）
  venv/bin/python scripts/prepare_training_data.py                               # 全量（物种清单 = KB 全部 + 补充清单）

产出：backend/training_data/{鸟名}/train/*.jpg、val/*.jpg、training_data/manifest.json（增量合并，可分批跑）
切分规则：正式跑按候选数比例切分（val = max(8, 候选数 × 20%)，train 拿剩余）；
合规候选 < 10 张的物种整组标记 insufficient 跳过（manifest 有 warning）；--limit 调试模式全进 train。
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from datetime import datetime, timezone
from pathlib import Path

import requests

BACKEND_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = BACKEND_DIR / "training_data"
MANIFEST_PATH = OUT_DIR / "manifest.json"

# 物种清单 = knowledge_base 全部鸟名 + 下方补充清单（三个易混淆组优先保障，排前面）
SUPPLEMENTARY_SPECIES = ["大白鹭", "中白鹭", "小白鹭", "牛背鹭",
                         "红嘴鸥", "蒙古银鸥", "黑嘴鸥",
                         "欧亚鸲", "北红尾鸲"]

TRAIN_COUNT = 50
VAL_COUNT = 10
MIN_SPECIES_PHOTOS = 10     # 正式跑时合规候选低于此数 → 整个物种 insufficient 跳过（写 manifest 警告）
REQUEST_INTERVAL = 1.5       # 秒，所有请求（API 与图片）统一限速
RETRY_MAX = 3                # 429/5xx/网络错 的退避重试次数
RETRY_BACKOFF = (5, 15, 30)  # 退避秒数
MAX_PAGES = 5                # 每个物种最多翻页数（per_page=100，正常 1-2 页够 60 张）
ALLOWED_LICENSES = {"cc0", "cc-by"}
DOWNLOAD_HARD_TIMEOUT = 60   # 单图下载 wall-clock 硬上限（requests 的 read timeout 挡不住慢速滴流连接）
TAXA_API = "https://api.inaturalist.org/v1/taxa"
OBS_API = "https://api.inaturalist.org/v1/observations"
USER_AGENT = "birdvibe-training-data-prep/1.0 (research use; CC0/CC-BY only; respects rate limits)"


class RateLimiter:
    """所有出站请求统一走这里：保证间隔 ≥ REQUEST_INTERVAL，429/5xx/网络错退避重试。"""

    def __init__(self):
        self._last = 0.0
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})

    def _pace(self):
        """请求间隔限速（≥ REQUEST_INTERVAL 秒）。"""
        idle = REQUEST_INTERVAL - (time.time() - self._last)
        if idle > 0:
            time.sleep(idle)

    def get(self, url: str, **kwargs) -> requests.Response:
        last_err = None
        for attempt in range(RETRY_MAX + 1):
            if attempt > 0:
                wait = RETRY_BACKOFF[attempt - 1]
                print(f"    ⏳ 第 {attempt}/{RETRY_MAX} 次重试（退避 {wait}s）: {url[:80]}")
                time.sleep(wait)
            self._pace()
            try:
                resp = self.session.get(url, timeout=15, **kwargs)
                self._last = time.time()
            except requests.RequestException as e:
                self._last = time.time()
                last_err = f"网络错误: {type(e).__name__}: {e}"
                continue
            if resp.status_code == 429 or resp.status_code >= 500:
                last_err = f"HTTP {resp.status_code}"
                continue
            if resp.status_code != 200:
                raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")
            return resp
        raise RuntimeError(f"重试 {RETRY_MAX} 次后仍失败: {last_err}")

    def download(self, url: str, dest: Path, hard_timeout: int = DOWNLOAD_HARD_TIMEOUT) -> None:
        """带 wall-clock 硬上限的单文件下载（worker 线程 + future 超时）。
        防服务器慢速滴流绕过 read timeout 把进程挂死（已在补跑中实际触发）；
        超时的线程无法强杀会自行收尾，调用方删除半成品文件后继续。"""
        def _work():
            resp = self.session.get(url, stream=True, timeout=15)
            resp.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=65536):
                    f.write(chunk)
            resp.close()
        self._pace()
        ex = ThreadPoolExecutor(max_workers=1)
        fut = ex.submit(_work)
        try:
            fut.result(timeout=hard_timeout)
        finally:
            ex.shutdown(wait=False)


def load_species_list(only: list[str] | None) -> list[tuple[str, str]]:
    """物种清单 = KB 全部鸟名（附拉丁名）+ 补充清单（排前、去重）。返回 [(中文名, 拉丁名), ...]。
    KB 路径锚定脚本位置（backend/knowledge_base 绝对路径），与当前工作目录无关；
    清单为空说明知识库读取失败，直接抛错退出，绝不带着残缺清单下载。"""
    sys.path.insert(0, str(BACKEND_DIR))
    import rag_service
    rag_service.KB_DIR = str(BACKEND_DIR / "knowledge_base")
    kb_latin = {m["name"]: (m.get("latinName") or "").strip() for m in rag_service.get_bird_metadata()}
    if not kb_latin:
        raise SystemExit(f"✗ knowledge_base 物种清单为空（已尝试读取: {rag_service.KB_DIR}），"
                         f"拒绝带着残缺清单下载。请检查知识库目录是否存在。")
    combined = list(dict.fromkeys(SUPPLEMENTARY_SPECIES + list(kb_latin)))
    print(f"物种清单：KB {len(kb_latin)} 只 + 补充 {len(combined) - len(kb_latin)} 只"
          f"（去重后共 {len(combined)} 只）")
    if not only:
        picked = combined
    else:
        known = set(combined)
        picked, unknown = [], []
        for name in only:
            (picked.append(name) if name in known else unknown.append(name))
        if unknown:
            print(f"⚠️ --species 中不在清单内的名字: {unknown}（已跳过；清单见 manifest 或 knowledge_base/）")
        picked = list(dict.fromkeys(picked))
    return [(n, kb_latin.get(n, "")) for n in picked]


def resolve_taxon(limiter: RateLimiter, species: str, latin: str = "") -> dict:
    """把鸟名解析到物种级 taxon_id。

    注意（已实测）：/v1/taxa 全文检索不支持中文（q=树麻雀 会退回 6281 条热门分类列表），
    所以：有拉丁名（KB 元数据）时优先 q=拉丁名精确解析；否则中文名走 /autocomplete
    （识别页同款接口，支持中文）。候选打分择优 + 强制物种级，避免标签挂到目/科。"""
    candidates: list[dict] = []
    if latin:
        try:
            r = limiter.get(TAXA_API, params={"q": latin, "per_page": 5})
            candidates += (r.json() or {}).get("results") or []
        except Exception:
            pass
    if not any((t.get("rank") or "") in ("species", "subspecies") for t in candidates):
        try:
            r = limiter.get(f"{TAXA_API}/autocomplete",
                            params={"q": species, "per_page": 8, "locale": "zh-CN"})
            candidates += (r.json() or {}).get("results") or []
        except Exception:
            pass
    if not candidates:
        raise RuntimeError("iNaturalist 查无此分类单元")

    def score(t: dict) -> int:
        cn = (t.get("preferred_common_name") or "").strip()
        sci = (t.get("name") or "").strip()
        s = 0
        if latin and sci.lower() == latin.lower():
            s += 120
        if cn == species:
            s += 100
        elif sci.lower() == species.lower():
            s += 90
        elif cn and (species in cn or cn in species):
            s += 60
        if (t.get("rank") or "") in ("species", "subspecies"):
            s += 30
        elif (t.get("rank") or "") == "genus":
            s += 10
        else:
            s -= 20  # 目/科/纲等高阶单元尽量避开
        return s

    taxon = max(candidates, key=score)
    if (taxon.get("rank") or "") not in ("species", "subspecies"):
        raise RuntimeError(f"最佳匹配仍是高阶分类单元 {taxon.get('name')}（{taxon.get('rank')}），"
                           f"「{species}」在 iNat 无物种级条目，请改用学名")
    return {"id": taxon["id"], "name": taxon.get("name"), "common": taxon.get("preferred_common_name"),
            "rank": taxon.get("rank")}


def collect_photos(limiter: RateLimiter, taxon_id: int, needed: int) -> list[dict]:
    """按页拉取 research grade + CC0/CC-BY 的观察记录，抽取合规照片（每观察取首张）。"""
    collected = []
    seen_obs = set()
    for page in range(1, MAX_PAGES + 1):
        resp = limiter.get(OBS_API, params={
            "taxon_id": taxon_id,
            "quality_grade": "research",
            "license": "cc0,cc-by",
            "photos": "true",
            "per_page": 100,
            "page": page,
        })
        results = (resp.json() or {}).get("results") or []
        if not results:
            break
        for obs in results:
            obs_id = obs.get("id")
            if obs_id in seen_obs:
                continue
            photos = obs.get("photos") or []
            if not photos:
                continue
            photo = photos[0]
            license_code = (photo.get("license_code") or "").lower()
            if license_code not in ALLOWED_LICENSES:
                continue  # photo 级二次校验：照片许可与观察记录可能不同
            url = (photo.get("url") or "").strip()
            if not url:
                continue
            # observations API 默认给 75×75 的 square 缩略图，换成 medium（500px）再下载
            if "square." in url:
                url = url.replace("square.", "medium.")
            seen_obs.add(obs_id)
            collected.append({
                "observation_id": obs_id,
                "photo_url": url,
                "license_code": license_code,
                "observation_url": obs.get("uri") or f"https://www.inaturalist.org/observations/{obs_id}",
                "observer": (obs.get("user") or {}).get("login") or "",
            })
            if len(collected) >= needed:
                return collected
        if len(results) < 100:
            break
    return collected


def verify_image(path: Path) -> bool:
    """PIL 验证下载文件确实是完整可开的图片。"""
    try:
        from PIL import Image
        with Image.open(path) as img:
            img.verify()
        return True
    except Exception:
        return False


# ── val 观察者分散选样 ──
VAL_OBSERVER_CAP_RATIO = 0.3  # 单一观察者在 val 中的占比上限（向上取整）


def _obs_of(entry: dict) -> str:
    return (entry.get("observer") or "").strip() or "unknown"


def select_val_indices(entries: list[dict], n_val: int) -> tuple[set[int], bool]:
    """
    按观察者分散规则选出 val 下标（其余归 train）：
    - 任一观察者在 val 中占比 ≤ ceil(n_val × 30%)；
    - val 缺额按现有顺序从其他观察者的图片补齐；
    - 观察者太少补不齐时按实际能分散的程度切，返回 skewed=True（调用方打 observer_skew_warning）。
    """
    if n_val <= 0 or not entries:
        return set(), False
    cap = max(1, math.ceil(n_val * VAL_OBSERVER_CAP_RATIO))
    val_idx: list[int] = []
    per_obs: Counter = Counter()
    for i, e in enumerate(entries):
        obs = _obs_of(e)
        if per_obs[obs] >= cap:
            continue  # 该观察者在 val 里已满额，留给 train
        val_idx.append(i)
        per_obs[obs] += 1
        if len(val_idx) >= n_val:
            break
    return set(val_idx), len(val_idx) < n_val


def verify_manifest(out_dir: Path = OUT_DIR, manifest_path: Path = MANIFEST_PATH) -> tuple[int, int]:
    """
    完整性自检（与下载逻辑分离，可 --verify-only 单独运行）：
    核对 manifest 记录与磁盘实际文件，三种异常分别报告——
      1. 磁盘文件数 < manifest 记录（文件丢失）
      2. 目录不存在（整物种缺失）
      3. 图片打不开（PIL 验证失败）
    下载时失败/insufficient 的物种无目录属预期，自动跳过。
    返回 (异常物种数, 总物种数)。
    """
    if not manifest_path.exists():
        print(f"✗ manifest 不存在: {manifest_path}")
        return 1, 0
    species = (json.loads(manifest_path.read_text(encoding="utf-8")) or {}).get("species") or {}
    problems: list[tuple[str, list[str]]] = []

    for name, rec in species.items():
        if rec.get("error") or rec.get("insufficient"):
            continue  # 下载时已知失败/跳过，无目录属预期
        issues = []
        for split, expected in (("train", rec.get("train_count", 0)), ("val", rec.get("val_count", 0))):
            d = out_dir / name / split
            if not d.exists():
                issues.append(f"{split}/ 目录不存在（整物种缺失）")
                continue
            files = sorted(d.iterdir())
            if len(files) < expected:
                issues.append(f"{split}/ 文件丢失：磁盘 {len(files)} < manifest {expected}")
            for p in files:
                if not verify_image(p):
                    issues.append(f"{split}/{p.name} 图片打不开（PIL 验证失败）")
        if issues:
            problems.append((name, issues))

    if problems:
        print(f"\n✗ 完整性自检：{len(problems)}/{len(species)} 个物种异常")
        for name, issues in problems:
            print(f"  - {name}:")
            for issue in issues:
                print(f"      · {issue}")
        print("\n修复方式：请删除该物种目录和 manifest 条目后重跑 --species <鸟名>")
        return len(problems), len(species)

    print(f"✓ 完整性自检通过：{len(species)} 个物种全部一致")
    return 0, len(species)


def resplit_all(out_dir: Path = OUT_DIR, manifest_path: Path = MANIFEST_PATH) -> None:
    """
    按观察者分散规则对已有数据重切 train/val：文件只在目录间移动，不重新下载、不删除。
    以 manifest 的图片顺序为准重算选样，总数不变；打印每个物种 val 的观察者分布前后对比。
    """
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    species = manifest.get("species") or {}
    moved_total = 0

    for name, rec in species.items():
        if rec.get("error") or rec.get("insufficient"):
            continue
        images = rec.get("images") or []
        if len(images) < 2:
            continue
        n = len(images)
        n_val = min(max(8, round(n * 0.2)), n - 1)
        before = Counter(_obs_of(e) for e in images if "/val/" in e["file"])
        val_idx, skewed = select_val_indices(images, n_val)
        moved = 0
        for i, e in enumerate(images):
            want = "val" if i in val_idx else "train"
            cur = "val" if "/val/" in e["file"] else "train"
            if want != cur:
                src = out_dir / e["file"]
                dst = out_dir / name / want / src.name
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src), str(dst))
                e["file"] = f"{name}/{want}/{src.name}"
                moved += 1
        rec["train_count"] = sum(1 for e in images if "/train/" in e["file"])
        rec["val_count"] = sum(1 for e in images if "/val/" in e["file"])
        if skewed:
            rec["observer_skew_warning"] = True
        else:
            rec.pop("observer_skew_warning", None)
        moved_total += moved
        after = Counter(_obs_of(e) for e in images if "/val/" in e["file"])
        flag = " ⚠️observer_skew_warning" if skewed else ""
        print(f"  {name}: val {dict(before)} → {dict(after)}"
              + (f"（移动 {moved} 张）" if moved else "（无需移动）") + flag)

    manifest["generated_at"] = datetime.now(timezone.utc).isoformat()
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n重切完成：共移动 {moved_total} 个文件（train/val 总数不变，未下载未删除）")


def download_species(limiter: RateLimiter, species: str, latin: str, limit: int | None) -> dict:
    taxon = resolve_taxon(limiter, species, latin)
    print(f"  taxon: {taxon['name']} (id={taxon['id']}, common={taxon['common']})")

    total = TRAIN_COUNT + VAL_COUNT if limit is None else min(limit, TRAIN_COUNT + VAL_COUNT)
    photos = collect_photos(limiter, taxon["id"], total)
    n = len(photos)

    if limit is None:
        # 正式跑：候选不足下限 → 整个物种标记 insufficient，跳过下载（写 manifest 警告）
        if n < MIN_SPECIES_PHOTOS:
            print(f"  ⚠️ insufficient：合规候选仅 {n} 张（<{MIN_SPECIES_PHOTOS} 下限），跳过下载")
            return {
                "taxon_id": taxon["id"], "taxon_name": taxon["name"], "queried_latin": latin,
                "insufficient": True, "candidate_count": n,
                "warning": f"合规候选仅 {n} 张（<{MIN_SPECIES_PHOTOS} 下限），未下载",
                "requested": total, "train_count": 0, "val_count": 0,
                "licenses": [], "images": [], "error": None,
            }
        # 无论候选多少张都按比例切分：val = max(8, 候选数 × 20%)，train 拿剩下的
        n_val = min(max(8, round(n * 0.2)), n - 1)
        n_train = n - n_val
    else:
        n_train, n_val = min(total, n), 0  # --limit 调试模式：全进 train，便于快速验证流程

    print(f"  合规照片候选: {n} 张（下载 {min(total, n)}：train {n_train} + val {n_val}）")
    if n < total:
        print(f"  ⚠️ 合规候选不足请求数，按实际数量下载并按比例切分")

    species_dir = OUT_DIR / species
    # val 按观察者分散规则选样：单一观察者 ≤30%，缺额按顺序从其他观察者补齐
    val_idx, skewed = select_val_indices(photos, n_val)
    if skewed:
        print(f"  ⚠️ 观察者不足：val 只能分散选 {len(val_idx)}/{n_val} 张（observer_skew_warning）")
    entries = []
    for idx, item in enumerate(photos):
        split = "val" if idx in val_idx else "train"
        ext = Path(item["photo_url"].split("?")[0]).suffix or ".jpg"
        dest = species_dir / split / f"{item['observation_id']}{ext}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            limiter.download(item["photo_url"], dest)
        except Exception as e:
            print(f"    ✗ 下载失败 obs={item['observation_id']}: {type(e).__name__}: {e}")
            dest.unlink(missing_ok=True)
            continue
        if not verify_image(dest):
            print(f"    ✗ 图片校验失败 obs={item['observation_id']}（已删除）")
            dest.unlink(missing_ok=True)
            continue
        # 老照片（多为早年观察）可能没有 500px 档，实际只有 300px——保留可用，但 manifest 打标记
        try:
            from PIL import Image
            with Image.open(dest) as _im:
                if max(_im.size) < 400:
                    item = {**item, "below_medium": True}
        except Exception:
            pass
        rel = f"{species}/{split}/{dest.name}"
        entries.append({**item, "file": rel})
        print(f"    ✓ [{split}] obs={item['observation_id']} {item['license_code']} <- {item['observer']}")

    n_below = sum(1 for e in entries if e.get("below_medium"))
    return {
        "taxon_id": taxon["id"],
        "taxon_name": taxon["name"],
        "queried_latin": latin,
        "requested": total,
        "train_count": sum(1 for e in entries if "/train/" in e["file"]),
        "val_count": sum(1 for e in entries if "/val/" in e["file"]),
        "below_medium_count": n_below,
        "observer_skew_warning": skewed,
        "licenses": sorted({e["license_code"] for e in entries}),
        "images": entries,
        "error": None,
    }


def main():
    ap = argparse.ArgumentParser(description="iNaturalist 授权照片批量下载（BioCLIP 微调数据集）")
    ap.add_argument("--species", default=None, help="只下指定物种（逗号/空格分隔的中文名）")
    ap.add_argument("--limit", type=int, default=None, help="每个物种只下 N 张（调试）")
    ap.add_argument("--verify-only", action="store_true",
                    help="只跑完整性自检（manifest vs 磁盘），不下载；异常时退出码非 0")
    ap.add_argument("--resplit", action="store_true",
                    help="按观察者分散规则对已有数据重切 train/val（只移动文件，不下载不删除）")
    args = ap.parse_args()

    only = None
    if args.species:
        import re
        only = [p for p in re.split(r"[,，\s]+", args.species.strip()) if p]

    if args.verify_only:
        problems, total = verify_manifest()
        print(f"（verify-only 模式，未执行下载）")
        sys.exit(1 if problems else 0)

    if args.resplit:
        resplit_all()
        problems, _ = verify_manifest()
        sys.exit(1 if problems else 0)

    species_list = load_species_list(only)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # manifest 增量合并：分批/断点重跑只更新本次物种
    manifest = {"source": "iNaturalist open API (research grade, CC0/CC-BY only)",
                "generated_at": None, "species": {}}
    if MANIFEST_PATH.exists():
        try:
            old = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
            manifest["species"] = old.get("species") or {}
        except Exception:
            print("⚠️ 现有 manifest.json 解析失败，将重建")

    limiter = RateLimiter()
    ok, failed = 0, 0
    for species, latin in species_list:
        # 增量跳过：manifest 记录完整且磁盘文件数达标，直接跳过（重跑只补缺失物种）
        prev = manifest["species"].get(species)
        if prev and not prev.get("error") and not prev.get("insufficient") and prev.get("train_count", 0) > 0:
            tr_dir, va_dir = OUT_DIR / species / "train", OUT_DIR / species / "val"
            tr_n = len(list(tr_dir.iterdir())) if tr_dir.is_dir() else -1
            va_n = len(list(va_dir.iterdir())) if va_dir.is_dir() else -1
            if tr_n >= prev.get("train_count", 0) and va_n >= prev.get("val_count", 0):
                print(f"\n═══ {species} ═══\n  ⏭ 已完整（train {prev['train_count']}+val {prev['val_count']}），跳过")
                ok += 1
                continue
        print(f"\n═══ {species} ═══")
        try:
            manifest["species"][species] = download_species(limiter, species, latin, args.limit)
            ok += 1
            done = manifest["species"][species]
            print(f"  ✅ {species}: train {done['train_count']} + val {done['val_count']}"
                  f"（licenses: {done['licenses']}）")
        except Exception as e:
            manifest["species"][species] = {"error": str(e), "images": []}
            failed += 1
            print(f"  ❌ {species}: {e}（记录后继续）")
        manifest["generated_at"] = datetime.now(timezone.utc).isoformat()
        MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n完成：{ok} 个物种成功，{failed} 个失败。manifest -> {MANIFEST_PATH}")
    print(f"限速：所有请求间隔 ≥{REQUEST_INTERVAL}s；429/5xx 退避重试最多 {RETRY_MAX} 次。")

    # 下载完成后完整性自检（manifest vs 磁盘），异常时以非 0 退出码上报
    problems, total = verify_manifest()
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
