"use client";

import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { MapPin, Crosshair, Loader2, CheckCircle2, AlertCircle, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useBirdStore, baseBirds } from "@/store/useBirdStore";
import { API_BASE_URL } from "@/lib/api";
import { openChatWithContext } from "@/lib/chatBus";

interface RecognizeCandidate {
  name: string;
  confidence: number;
  reason: string;
  // 预留：后端可返回的图鉴图片字段（当前未实现，卡片显示占位图）
  image_url?: string;
}

// 主动消歧追问卡片（后端可选下发：top1/top2 同属易混淆组且分差极小，或低置信+top1 属易混淆组）
interface Clarification {
  group: string;
  question: string;
  options: string[];
  candidates: string[];
  reason?: string;
}

interface RecognizeResponse {
  top5_candidates: RecognizeCandidate[];
  certainty_level: string;
  feature_description?: string;
  is_rare?: boolean;
  is_new_bird?: boolean;
  // 后端可选字段：识别度非「高」时说明最大不确定因素
  uncertainty_explanation?: string;
  // 后端可选字段：主动消歧追问卡片
  clarification?: Clarification;
}

interface BirdMetaSnapshot {
  englishName: string;
  latinName: string;
  officialImageUrl: string | null;
  funFact?: string;
}

interface SelectedBirdDetails {
  name: string;
  englishName: string;
  latinName: string;
  userImageUrl: string | null;
  appearance: string;
  distribution: string;
  habits: string;
  voice: string;
  funFact: string;
}

// 🔧 辅助函数：模糊匹配 baseBirds（处理括号、空格等格式差异）
function findBaseBird(name: string) {
  if (!name) return undefined;
  let bird = baseBirds.find((b) => b.name === name);
  if (bird) return bird;

  const cleanName = name.replace(/\s*\(.*?\)\s*/g, "").trim();
  bird = baseBirds.find((b) => b.name === cleanName);
  if (bird) return bird;

  bird = baseBirds.find(
    (b) =>
      b.name.includes(cleanName) ||
      cleanName.includes(b.name) ||
      (b.englishName && b.englishName.toLowerCase() === name.toLowerCase())
  );
  return bird;
}

// 🆕 关键修复：从 iNaturalist API 获取鸟种的官方元数据
// 必须用 autocomplete + locale=zh-CN 才能正确识别中文鸟名
// 彩带动画：放在模块级（不依赖组件状态），避免 react-hooks/purity 误判为渲染期调用
const triggerConfetti = () => {
  const duration = 3000;
  const end = Date.now() + duration;
  const frame = () => {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ["#10B981", "#F59E0B", "#84CC16", "#FCD34D"],
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ["#10B981", "#F59E0B", "#84CC16", "#FCD34D"],
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
};

async function fetchBirdMetaFromAPI(name: string): Promise<{
  englishName: string;
  latinName: string;
  officialImageUrl: string | null;
}> {
  try {
    // 1. 用 autocomplete + zh-CN locale 查中文名（普通 taxa?q= 对中文支持极差，会返回蚂蚁/植物）
    const autoRes = await fetch(
      `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(
        name
      )}&per_page=1&locale=zh-CN`
    );
    const autoData = await autoRes.json();
    if (!autoData.results?.[0]) {
      return { englishName: "", latinName: "", officialImageUrl: null };
    }

    const taxon = autoData.results[0];
    const latinName = taxon.name || "";
    const officialImageUrl = taxon.default_photo?.medium_url || null;

    // 2. 用拉丁名再查一次（不带 locale），获取英文名
    let englishName = "";
    if (latinName) {
      try {
        const enRes = await fetch(
          `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(
            latinName
          )}&per_page=1`
        );
        const enData = await enRes.json();
        if (enData.results?.[0]) {
          const enCommonName = enData.results[0].preferred_common_name;
          // 确保是英文名（不含中文字符）
          if (enCommonName && !/[\u4e00-\u9fa5]/.test(enCommonName)) {
            englishName = enCommonName;
          }
        }
      } catch {}
    }

    return { englishName, latinName, officialImageUrl };
  } catch (e) {
    console.error("从 iNaturalist 获取鸟种元数据失败:", e);
    return { englishName: "", latinName: "", officialImageUrl: null };
  }
}

// 🔧 修复：WikiBirdImage 也改用正确的查询逻辑
function WikiBirdImage({
  name,
  englishName,
  latinName,
}: {
  name: string;
  englishName?: string;
  latinName?: string;
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchImage = async () => {
      // 1. 优先用拉丁名查 iNaturalist（最准）
      const queries = [latinName, englishName, name].filter(
        Boolean
      ) as string[];
      for (const query of queries) {
        if (!query) continue;
        try {
          const res = await fetch(
            `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(
              query
            )}&per_page=1`
          );
          const data = await res.json();
          if (data.results?.[0]?.default_photo?.medium_url) {
            const url = data.results[0].default_photo.medium_url;
            if (url.includes("inaturalist")) {
              if (active) setImgSrc(url);
              return;
            }
          }
        } catch {
          continue;
        }
      }

      // 2. 如果拉丁名/英文名都查不到，用中文名走 autocomplete（兜底）
      if (!latinName && !englishName) {
        try {
          const res = await fetch(
            `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(
              name
            )}&per_page=1&locale=zh-CN`
          );
          const data = await res.json();
          if (data.results?.[0]?.default_photo?.medium_url) {
            const url = data.results[0].default_photo.medium_url;
            if (active) setImgSrc(url);
            return;
          }
        } catch {}
      }

      // 3. Wikipedia fallback（只用英文名查，且校验标题相关性）
      for (const query of [englishName].filter(Boolean)) {
        if (!query) continue;
        try {
          const res = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
              query
            )}`
          );
          const data = await res.json();
          if (
            data.thumbnail?.source &&
            data.title &&
            (data.title
              .toLowerCase()
              .includes(query.toLowerCase().slice(0, 6)) ||
              query
                .toLowerCase()
                .includes(data.title.toLowerCase().slice(0, 6)))
          ) {
            if (active) setImgSrc(data.thumbnail.source);
            return;
          }
        } catch {
          continue;
        }
      }
    };
    fetchImage();
    return () => {
      active = false;
    };
  }, [name, englishName, latinName]);

  if (!imgSrc) {
    return (
      <div className="w-full h-full bg-emerald-950 flex items-center justify-center">
        <span className="text-6xl animate-pulse">🦅</span>
      </div>
    );
  }
  return <img src={imgSrc} alt={name} className="w-full h-full object-cover" />;
}

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [location, setLocation] = useState<string>("");
  // 观察日期默认当天（本地时区），识别时会结合季节约束候选鸟种
  const [observationDate, setObservationDate] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationWarning, setLocationWarning] = useState(false);
  const [usingIpLocation, setUsingIpLocation] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecognizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBird, setSelectedBird] = useState<SelectedBirdDetails | null>(null);
  const [birdMetaCache, setBirdMetaCache] = useState<Record<string, BirdMetaSnapshot>>({});
  const unlockBird = useBirdStore((state) => state.unlockBird);
  // top3 对比卡片：用户选中的候选索引（默认 top1）与已确认收录的鸟名
  const [selectedCandidate, setSelectedCandidate] = useState<number>(0);
  const [confirmedName, setConfirmedName] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let processedFile = file;

    const isHeic =
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif");
    if (isHeic) {
      try {
        const heic2any = (await import("heic2any")).default;
        const blob = (await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.85,
        })) as Blob;
        processedFile = new File(
          [blob],
          file.name.replace(/\.(heic|heif)$/i, ".jpg"),
          { type: "image/jpeg" }
        );
      } catch {
        setError("HEIC 图片转换失败，请尝试在相册里导出为 JPG 后再上传。");
        return;
      }
    }

    setImage(processedFile);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(processedFile);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError("哎呀，您的设备好像不支持定位功能。");
      return;
    }
    setIsLocating(true);
    setUsingIpLocation(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationWarning(false);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        setError("定位失败，请检查浏览器是否允许了位置权限哦！");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // IP 粗定位兜底
  const getIpFallbackLocation = async (): Promise<{
    lat: number;
    lng: number;
  } | null> => {
    try {
      const res = await fetch(
        "http://ip-api.com/json/?fields=lat,lon,city,status"
      );
      const data = await res.json();
      if (data.status === "success") return { lat: data.lat, lng: data.lon };
    } catch {}
    return null;
  };

  // extraHint：追问卡片用户点选后携带的观察者补充线索（最多触发一次重识别）
  const handleRecognize = async (extraHint?: string) => {
    if (!image) {
      setError("哎呀，背包里好像还没有装入照片哦！📸");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setLocationWarning(false);

    // 没有精确坐标也没有文字地点，尝试 IP 粗定位
    let finalCoords = coords;
    if (!coords && !location.trim()) {
      const ipCoords = await getIpFallbackLocation();
      if (ipCoords) {
        finalCoords = ipCoords;
        setCoords(ipCoords);
        setUsingIpLocation(true);
        setLocationWarning(true);
      } else {
        setLocationWarning(true);
      }
    }

    const formData = new FormData();
    formData.append("image", image);
    if (location) formData.append("location", location);
    formData.append("date", observationDate);
    if (extraHint) formData.append("extra_hint", extraHint);
    if (finalCoords) {
      formData.append("lat", finalCoords.lat.toString());
      formData.append("lng", finalCoords.lng.toString());
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/recognize`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok)
        throw new Error("自然电波好像有点弱，请检查后端魔法是否开启📡");
      const data: RecognizeResponse = await response.json();
      setResult(data);
      setSelectedCandidate(0); // 默认选中 top1；解锁改为用户确认后触发
      setConfirmedName(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发生未知错误啦");
    } finally {
      setLoading(false);
    }
  };

  // 从 reason 中提取「识别依据：」之后的文本；没有该标记时退回全文
  const extractIdentificationBasis = (reason: string): string => {
    const marker = "识别依据：";
    const idx = reason.indexOf(marker);
    return (idx >= 0 ? reason.slice(idx + marker.length) : reason).trim();
  };

  // 用户点选确认后才解锁：补全元数据 → 写识别记录 → 彩带 → 新鸟延迟刷新
  const confirmCandidate = async (candidate: RecognizeCandidate) => {
    if (confirming) return;
    const cleanName = candidate.name.replace(/\s*\(.*?\)\s*/g, "").trim();
    setConfirming(true);
    try {
      // 先从 baseBirds 里模糊匹配（兜底）
      const baseMatch = findBaseBird(cleanName);

      const birdMeta = {
        englishName: baseMatch?.englishName || "",
        latinName: baseMatch?.latinName || "",
        category: baseMatch?.category || "林鸟",
        rarity: baseMatch?.rarity || "常见",
        location: baseMatch?.location || "公园绿地",
        funFact: baseMatch?.funFact || "",
        officialImageUrl: null as string | null,
      };

      // baseBirds 里没有的鸟（新鸟，如红尾水鸲），用 autocomplete API 补英文名/拉丁名/官方图
      if (!baseMatch) {
        const apiMeta = await fetchBirdMetaFromAPI(cleanName);
        birdMeta.englishName = apiMeta.englishName || birdMeta.englishName;
        birdMeta.latinName = apiMeta.latinName || birdMeta.latinName;
        birdMeta.officialImageUrl = apiMeta.officialImageUrl;
      }

      // 再尝试从后端详情接口补全（如果后端有数据就覆盖）
      try {
        const detailRes = await fetch(
          `${API_BASE_URL}/api/v1/birds/${encodeURIComponent(
            cleanName
          )}/details`
        );
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          birdMeta.englishName =
            detailData.englishName || birdMeta.englishName;
          birdMeta.latinName = detailData.latinName || birdMeta.latinName;
          birdMeta.category = detailData.category || birdMeta.category;
          birdMeta.rarity = detailData.rarity || birdMeta.rarity;
          birdMeta.location = detailData.location || birdMeta.location;
          birdMeta.funFact = detailData.funFact || birdMeta.funFact;
          setBirdMetaCache((prev) => ({ ...prev, [cleanName]: birdMeta }));
        }
      } catch (e) {
        console.error("获取鸟种详情失败:", e);
      }

      // 🔧 确保 unlockBird 传入完整的英文/拉丁名和官方图片
      unlockBird(cleanName, {
        reason: candidate.reason,
        imageUrl: imagePreview, // 用户实拍
        officialImageUrl: birdMeta.officialImageUrl, // 官方图片
        location: location || birdMeta.location || "探索中发现",
        lat: coords?.lat,
        lng: coords?.lng,
        englishName: birdMeta.englishName,
        latinName: birdMeta.latinName,
        category: birdMeta.category,
        rarity: birdMeta.rarity,
      });

      setConfirmedName(cleanName);
      triggerConfetti();

      // 识别出新鸟种时，延迟刷新让图鉴列表自动更新
      if (result?.is_new_bird) {
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (e) {
      console.error("确认收录失败:", e);
    } finally {
      setConfirming(false);
    }
  };

  const getBirdDetails = (birdName: string, userImageUrl: string | null) => {
    const baseBird = findBaseBird(birdName);
    const cachedMeta = birdMetaCache[birdName];

    return {
      name: birdName,
      englishName: baseBird?.englishName ?? cachedMeta?.englishName ?? "",
      latinName: baseBird?.latinName ?? cachedMeta?.latinName ?? "",
      userImageUrl,
      // 注：baseBirds 元数据不含 details 章节，这里直接使用兜底文案
      appearance: "羽色极具环境适应性，拥有与其生活习性相符的体型特征。",
      distribution: "广泛分布于适宜其生存的地区，在城市公园、林地或湿地均可见到。",
      habits: "性格活泼且机警，主食植物浆果与小型昆虫，具有较强的领地意识。",
      voice: "鸣声多变，多用于宣示领地或同伴联络。",
      funFact:
        baseBird?.funFact ??
        cachedMeta?.funFact ??
        "这种鸟类拥有独特的生存技巧和行为特征，是大自然中的奇妙存在。",
    };
  };

  // 💬 问 AI：把 top3 候选打包发给全局聊天窗，进入后端「识别结果对比」模式
  const handleAskAI = () => {
    if (!result?.top5_candidates?.length) return;
    const candidates = result.top5_candidates.slice(0, 3).map((c) => ({
      name: c.name,
      confidence: c.confidence,
    }));
    openChatWithContext({ type: "recognize_result", candidates });
  };

  const certaintyBadge = (level: string) => {
    if (level === "高")
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
          识别度：高 ✓
        </span>
      );
    if (level === "中")
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-yellow-100 text-yellow-700 border border-yellow-200">
          识别度：中 ~
        </span>
      );
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-600 border border-red-200">
        识别度：低 ✗
      </span>
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-50 via-lime-100 to-emerald-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-4 pt-8">
          <div className="inline-block bg-white/70 backdrop-blur-md px-8 py-4 rounded-full border-4 border-emerald-100 shadow-xl transform rotate-1 hover:rotate-0 transition-transform duration-300">
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-yellow-500 tracking-wide">
              🌿 自然小鸟探索识别 🌻
            </h1>
          </div>
          <p className="text-lg text-emerald-700/80 font-bold tracking-widest drop-shadow-sm">
            带上相机，走向户外，去大自然中结交新伙伴吧！🍃
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 relative">
          {/* 左侧：上传区 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-[2rem] border-4 border-emerald-200 p-6 md:p-8 shadow-2xl relative">
            <div className="absolute -top-6 -left-6 text-5xl animate-bounce drop-shadow-md">
              🏕️
            </div>
            <div className="space-y-2 mb-8">
              <h2 className="text-2xl font-black text-emerald-600">
                记录小鸟足迹
              </h2>
              <p className="text-zinc-500 font-medium text-sm">
                上传你在户外拍到的照片，AI向导帮你辨认！
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-yellow-50/80 rounded-2xl p-4 border-2 border-yellow-200 hover:shadow-md transition-shadow">
                <label className="block text-yellow-700 font-bold mb-3 flex items-center gap-2">
                  <span className="text-xl">📸</span> 捕捉到的掠影 (照片)
                </label>
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  onChange={handleImageChange}
                  className="w-full text-sm text-yellow-700 file:mr-4 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-yellow-200 file:text-yellow-800 hover:file:bg-yellow-300 transition-colors cursor-pointer"
                />
                {imagePreview && (
                  <div className="mt-4 p-2 bg-white rounded-xl transform -rotate-1 border-2 border-yellow-100 shadow-sm">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div className="bg-blue-50/80 rounded-2xl p-4 border-2 border-blue-200 hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-200 text-blue-800 text-[10px] font-black px-2 py-1 rounded-bl-lg">
                  结合生境提升准确率
                </div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-blue-800 font-bold flex items-center gap-2">
                    <MapPin className="w-5 h-5" /> 生境与位置描述
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLocation("不确定");
                        setCoords(null);
                        setUsingIpLocation(false);
                      }}
                      className="text-xs font-bold px-3 py-1.5 bg-white/70 hover:bg-blue-100 text-blue-700 rounded-full transition-colors shadow-sm border border-blue-200"
                    >
                      不确定
                    </button>
                    <button
                      onClick={handleGetLocation}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors shadow-sm"
                    >
                      {isLocating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Crosshair className="w-3.5 h-3.5" />
                      )}
                      {isLocating ? "搜索卫星..." : "获取精准坐标"}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="手动输入城市/公园名，例如：新加坡植物园..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-sm font-bold text-blue-950 placeholder:text-blue-300 bg-white/60 backdrop-blur-sm"
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="text-blue-800 font-bold flex items-center gap-1.5 text-xs whitespace-nowrap">
                    🗓️ 观察日期
                  </label>
                  <input
                    type="date"
                    value={observationDate}
                    onChange={(e) => setObservationDate(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border-2 border-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-xs font-bold text-blue-950 bg-white/60 backdrop-blur-sm"
                  />
                  <span className="text-[10px] text-blue-500/80 font-medium">
                    识别时会结合当地季节约束候选鸟种
                  </span>
                </div>

                {coords && !usingIpLocation && (
                  <div className="mt-3 flex items-center gap-1.5 text-emerald-600 text-xs font-black bg-emerald-100/50 px-2 py-1 rounded-md w-fit border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    已锚定精确坐标: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </div>
                )}
                {coords && usingIpLocation && (
                  <div className="mt-3 flex items-center gap-1.5 text-amber-600 text-xs font-black bg-amber-100/50 px-2 py-1 rounded-md w-fit border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                    已用 IP 粗定位兜底，精度仅到城市级别
                  </div>
                )}

                <p className="mt-2 text-[11px] text-blue-600/80 font-medium">
                  💡 填写具体生境或点击获取精准坐标，可提升识别率并点亮观鸟地图。
                </p>
              </div>

              {locationWarning && !usingIpLocation && (
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold border border-blue-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    没有获取到位置信息，这次发现将无法标记到地图上。建议点击「获取精准坐标」！
                  </span>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold animate-pulse">
                  {error}
                </div>
              )}

              <button
                className={`w-full py-4 rounded-full text-xl font-black text-white shadow-xl transform transition-all duration-300 ${
                  loading
                    ? "bg-zinc-300 cursor-not-allowed scale-95"
                    : "bg-gradient-to-r from-emerald-500 to-lime-500 hover:from-emerald-600 hover:to-lime-600 hover:-translate-y-2 hover:shadow-emerald-300/50 active:scale-95"
                }`}
                onClick={() => handleRecognize()}
                disabled={loading}
              >
                {loading ? "🔍 结合环境推理中..." : "🍃 呼叫 AI 自然向导 🍃"}
              </button>
            </div>
          </div>

          {/* 右侧：结果区 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-[2rem] border-4 border-lime-200 p-6 md:p-8 shadow-2xl relative">
            <div className="absolute -top-6 -right-6 text-5xl transform rotate-12 drop-shadow-md">
              🗺️
            </div>
            <div className="space-y-2 mb-8">
              <h2 className="text-2xl font-black text-lime-600">
                小鸟发现报告
              </h2>
              <p className="text-zinc-500 font-medium text-sm">
                来看看是哪位大自然的小精灵被你发现了！
              </p>
            </div>

            <div className="min-h-[400px]">
              {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-emerald-300 space-y-4 pt-10">
                  <div className="text-6xl animate-bounce">🌱</div>
                  <p className="font-bold text-lg">
                    图鉴还是空空的，去户外的绿地走走吧！
                  </p>
                </div>
              )}
              {loading && (
                <div className="h-full flex flex-col items-center justify-center text-emerald-500 space-y-4 pt-10">
                  <div className="text-6xl animate-spin">🍂</div>
                  <p className="font-bold text-lg animate-pulse">
                    向导正在比对生态特征，请稍候...
                  </p>
                </div>
              )}

              {result && (
                <>
                  {/* 主动消歧追问卡片：用户点选后带线索重识别一次；跳过则维持原结果 */}
                  {result.clarification && (
                    <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-indigo-800 font-black text-sm">
                          🔎 帮我再确认一下（{result.clarification.group}类太难分了）
                        </p>
                        <span className="text-[10px] text-indigo-400 font-bold whitespace-nowrap">
                          {result.clarification.reason}
                        </span>
                      </div>
                      <p className="text-xs text-indigo-600 font-bold leading-relaxed">
                        向导在「
                        {result.clarification.candidates.filter(Boolean).join("」和「")}
                        」之间犹豫不决，观察一下再告诉我：
                      </p>
                      <p className="text-sm font-black text-indigo-900">
                        {result.clarification.question}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {result.clarification.options.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              const c = result.clarification;
                              if (c) {
                                handleRecognize(
                                  `观察者补充：${c.question}——我观察到：${opt}`
                                );
                              }
                            }}
                            className="w-full sm:w-auto px-3 py-2 bg-white border-2 border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl text-left leading-relaxed hover:bg-indigo-100 hover:border-indigo-400 disabled:opacity-50 transition-colors"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          setResult({ ...result, clarification: undefined })
                        }
                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-600 underline underline-offset-2 disabled:opacity-50"
                      >
                        跳过，维持原结果 →
                      </button>
                    </div>
                  )}
                  {result.certainty_level === "低" ? (
                    <div className="flex flex-col items-center justify-center space-y-5 pt-6 text-center">
                      <div className="text-5xl">🔍</div>
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 space-y-3">
                        <p className="text-amber-700 font-black text-base">
                          识别不确定，换个角度重拍试试？
                        </p>
                        {result.feature_description && (
                          <p className="text-zinc-600 font-medium text-sm leading-relaxed">
                            我看到了
                            <span className="text-emerald-700 font-bold">
                              「{result.feature_description}」
                            </span>
                            ，但我不确定它的具体种类。
                          </p>
                        )}
                        <p className="text-amber-500 text-xs font-medium">
                          💡 建议：靠近拍摄、保持画面清晰、多角度尝试
                        </p>
                      </div>
                      {certaintyBadge(result.certainty_level)}
                    </div>
                  ) : (
                    result.top5_candidates && (
                      <div className="space-y-5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="flex justify-end">
                          {certaintyBadge(result.certainty_level)}
                        </div>
                        {result.uncertainty_explanation &&
                          result.certainty_level !== "高" && (
                            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-2">
                              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-amber-700 font-black text-sm">
                                  ⚠️ 识别存疑，建议复核
                                </p>
                                <p className="text-amber-600 text-xs font-medium leading-relaxed">
                                  {result.uncertainty_explanation}
                                </p>
                              </div>
                            </div>
                          )}

                        {/* TOP3 对比卡片：默认选中 top1，点击切换选中 */}
                        {(() => {
                          const top3 = result.top5_candidates.slice(0, 3);
                          if (top3.length === 0) {
                            return (
                              <p className="text-center text-zinc-400 font-bold text-sm py-6">
                                没能形成候选名单，换张照片再试试吧 🍃
                              </p>
                            );
                          }
                          const activeIdx = Math.min(
                            selectedCandidate,
                            top3.length - 1
                          );
                          const active = top3[activeIdx];
                          return (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {top3.map((bird, index) => {
                                  const isSelected = index === activeIdx;
                                  const isConfirmed =
                                    confirmedName ===
                                    bird.name
                                      .replace(/\s*\(.*?\)\s*/g, "")
                                      .trim();
                                  const meta = findBaseBird(bird.name);
                                  return (
                                    <button
                                      type="button"
                                      key={index}
                                      onClick={() => setSelectedCandidate(index)}
                                      className={`text-left p-4 rounded-2xl border-2 shadow-sm relative transition-all flex flex-col ${
                                        isSelected
                                          ? "border-emerald-500 bg-emerald-50/60 ring-4 ring-emerald-100 scale-[1.02]"
                                          : "border-emerald-100 bg-white hover:border-emerald-300"
                                      }`}
                                    >
                                      {/* 图片区：后端暂未返回图鉴图片字段（image_url），有则展示，无则占位 */}
                                      {bird.image_url ? (
                                        <img
                                          src={bird.image_url}
                                          alt={bird.name}
                                          className="w-full h-24 object-cover rounded-xl mb-3"
                                        />
                                      ) : (
                                        <div className="w-full h-24 rounded-xl mb-3 bg-gradient-to-br from-emerald-100 to-lime-50 border border-emerald-100 flex items-center justify-center text-3xl">
                                          {index === 0 ? "🦉" : "🐦"}
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                            index === 0
                                              ? "bg-emerald-600 text-white"
                                              : "bg-emerald-100 text-emerald-700"
                                          }`}
                                        >
                                          TOP {index + 1}
                                        </span>
                                        {bird.confidence < 0.7 && (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200">
                                            低置信·需复核
                                          </span>
                                        )}
                                        {isSelected && (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-lime-200 text-emerald-800">
                                            ✓ 当前选中
                                          </span>
                                        )}
                                        {isConfirmed && (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-700 text-white">
                                            已收录
                                          </span>
                                        )}
                                      </div>
                                      <h3 className="font-black text-lg text-zinc-800 mt-2">
                                        {bird.name}
                                      </h3>
                                      <p className="text-[11px] font-bold text-emerald-600 italic truncate">
                                        {meta?.englishName ||
                                          "English name unavailable"}
                                      </p>
                                      <div className="w-full bg-zinc-100 rounded-full h-2.5 mt-3 mb-1 overflow-hidden border border-zinc-200">
                                        <div
                                          className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-emerald-500 transition-all duration-1000 ease-out"
                                          style={{
                                            width: `${bird.confidence * 100}%`,
                                          }}
                                        ></div>
                                      </div>
                                      <p className="text-[11px] text-zinc-400 font-bold">
                                        置信度 {(bird.confidence * 100).toFixed(1)}%
                                      </p>
                                      <div className="bg-emerald-50/80 text-emerald-800 p-3 rounded-xl text-xs font-medium leading-relaxed border border-emerald-100 mt-3 line-clamp-4">
                                        {extractIdentificationBasis(bird.reason)}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* 确认操作条：点击确认后才触发解锁与详情拉取 */}
                              <div className="bg-white rounded-2xl border-2 border-emerald-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <p className="text-sm font-bold text-zinc-600">
                                  {confirmedName ? (
                                    <>
                                      已收录{" "}
                                      <span className="text-emerald-700">
                                        「{confirmedName}」
                                      </span>{" "}
                                      进你的图鉴 ✓
                                    </>
                                  ) : (
                                    <>
                                      当前选中：
                                      <span className="text-emerald-700">
                                        {active.name}
                                      </span>
                                      ，确认后才会收录进图鉴
                                    </>
                                  )}
                                </p>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={handleAskAI}
                                    className="px-4 py-2.5 bg-white text-emerald-700 border-2 border-emerald-200 font-bold rounded-full text-sm hover:bg-emerald-50 hover:border-emerald-400 transition-colors whitespace-nowrap flex items-center gap-1.5"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                    问 AI
                                  </button>
                                  {confirmedName ? (
                                    <button
                                      onClick={() =>
                                        setSelectedBird(
                                          getBirdDetails(confirmedName, imagePreview)
                                        )
                                      }
                                      className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-full text-sm hover:bg-emerald-700 transition-colors whitespace-nowrap"
                                    >
                                      📖 查看物种百科 &rarr;
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => confirmCandidate(active)}
                                      disabled={confirming}
                                      className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-full text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                                    >
                                      {confirming ? "正在收录..." : "✅ 确认这就是它"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={!!selectedBird}
        onOpenChange={() => setSelectedBird(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-[90vw] md:max-w-[70vw] lg:max-w-[1400px] p-0 overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-lime-950 border-2 border-lime-800 shadow-[0_0_80px_rgba(20,83,45,0.8)] rounded-[2.5rem]">
          <DialogTitle className="sr-only">
            小鸟物种百科：{selectedBird?.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            为您展示关于该物种的外貌、习性及分布的详细科普信息。
          </DialogDescription>

          {selectedBird && (
            <div className="flex flex-col lg:flex-row max-h-[90vh] overflow-y-auto lg:overflow-hidden custom-scrollbar-dark">
              <div className="relative h-72 lg:h-auto lg:w-2/5 flex-shrink-0">
                <WikiBirdImage
                  name={selectedBird.name}
                  englishName={selectedBird.englishName}
                  latinName={selectedBird.latinName}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/20 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-emerald-950 flex flex-col justify-end p-8 lg:p-10">
                  <div className="space-y-1">
                    <h2 className="text-5xl lg:text-6xl font-black text-lime-50 drop-shadow-2xl tracking-wide leading-tight">
                      {selectedBird.name}
                    </h2>
                    {selectedBird.englishName && (
                      <p className="text-lime-300 font-bold text-lg drop-shadow-md">
                        {selectedBird.englishName}
                      </p>
                    )}
                    {selectedBird.latinName && (
                      <p className="text-emerald-400 font-medium italic text-sm opacity-90">
                        {selectedBird.latinName}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 lg:p-10 lg:w-3/5 lg:overflow-y-auto custom-scrollbar-dark space-y-6">
                {selectedBird.userImageUrl && (
                  <div className="flex items-start gap-4 bg-emerald-900/40 p-4 rounded-2xl border border-emerald-700/50">
                    <img
                      src={selectedBird.userImageUrl}
                      alt="我的实拍"
                      className="w-28 h-28 object-cover rounded-xl border-2 border-lime-600/50 shadow-lg flex-shrink-0"
                    />
                    <div className="flex flex-col justify-center gap-1">
                      <span className="text-lime-400 text-xs font-black tracking-widest uppercase">
                        📸 我的实拍
                      </span>
                      <p className="text-emerald-200 text-xs font-medium leading-relaxed">
                        这是你今天在野外拍到的照片，与左侧维基百科官方图对比，看看能找到哪些相同特征？
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-emerald-900/40 p-6 rounded-3xl shadow-inner border border-emerald-700/50 relative transform hover:scale-[1.01] transition-transform">
                  <div className="absolute -top-4 left-8 bg-emerald-600 text-lime-50 px-5 py-1.5 rounded-full text-sm font-black shadow-lg flex items-center gap-2">
                    <span>🔍</span> 外貌特征
                  </div>
                  <p className="text-emerald-100 mt-2 text-base leading-relaxed tracking-wide font-medium">
                    {selectedBird.appearance}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-lime-950/40 p-6 rounded-3xl shadow-inner border border-lime-800/50 relative hover:bg-lime-900/40 transition-colors">
                    <div className="absolute -top-4 left-6 bg-lime-600 text-lime-50 px-4 py-1.5 rounded-full text-sm font-black shadow-lg">
                      🏕️ 生活习性
                    </div>
                    <p className="text-lime-100 mt-2 text-base leading-relaxed tracking-wide">
                      {selectedBird.habits}
                    </p>
                  </div>
                  <div className="bg-emerald-900/30 p-6 rounded-3xl shadow-inner border border-emerald-700/50 relative hover:bg-emerald-800/30 transition-colors">
                    <div className="absolute -top-4 left-6 bg-emerald-500 text-emerald-50 px-4 py-1.5 rounded-full text-sm font-black shadow-lg">
                      🗺️ 分布地区
                    </div>
                    <p className="text-emerald-100 mt-2 text-base leading-relaxed tracking-wide">
                      {selectedBird.distribution}
                    </p>
                  </div>
                  <div className="bg-teal-950/40 p-6 rounded-3xl shadow-inner border border-teal-800/50 relative hover:bg-teal-900/40 transition-colors">
                    <div className="absolute -top-4 left-6 bg-teal-600 text-teal-50 px-4 py-1.5 rounded-full text-sm font-black shadow-lg">
                      🎵 叫声特征
                    </div>
                    <p className="text-teal-100 mt-2 text-base leading-relaxed tracking-wide">
                      {selectedBird.voice}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-900/40 to-lime-900/40 p-6 rounded-3xl shadow-inner border border-yellow-700/50 relative hover:from-yellow-800/40 transition-colors">
                    <div className="absolute -top-4 left-6 bg-yellow-600 text-yellow-50 px-4 py-1.5 rounded-full text-sm font-black shadow-lg">
                      ✨ 趣味冷知识
                    </div>
                    <p className="text-yellow-100/90 mt-2 text-base leading-relaxed font-bold tracking-wide">
                      {selectedBird.funFact}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}