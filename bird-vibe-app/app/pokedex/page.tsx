"use client";

import React, { useState, useEffect } from "react";
import { Bird, Lock, RotateCcw, Camera, MapPin, Calendar, X } from "lucide-react";
import { baseBirds, useBirdStore } from "@/store/useBirdStore";

// 根据经纬度反查地名
function LocationDisplay({ lat, lng, fallback }: { lat?: number; lng?: number; fallback: string }) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!lat || !lng) return;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-CN`, {
      headers: { "Accept-Language": "zh-CN" }
    })
      .then(r => r.json())
      .then(data => {
        const a = data.address;
        const resolved = a.city || a.town || a.suburb || a.county || a.state_district || a.state || data.display_name;
        if (resolved) setName(resolved);
      })
      .catch(() => {});
  }, [lat, lng]);

  return <span>{name || fallback}</span>;
}

// 从 Wikipedia 拉取官方图片
function BirdImage({ name, englishName, latinName, isUnlocked }: { name?: string; englishName?: string; latinName?: string; isUnlocked: boolean }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchBirdImage = async () => {
      // 1. iNaturalist API（优先根据拉丁文名抓取）
      const queries = [latinName, englishName, name].filter(Boolean) as string[];
      for (const query of queries) {
        try {
          const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&per_page=1`);
          const data = await res.json();
          if (data.results?.[0]?.default_photo?.medium_url) {
            const url = data.results[0].default_photo.medium_url;
            if (url.includes('inaturalist')) {
              if (active) setImgSrc(url);
              return;
            }
          }
        } catch { continue; }
      }

      // 2. Wikipedia fallback
      for (const query of queries) {
        if (!query) continue;
        try {
          const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
          const data = await response.json();
          if (data.thumbnail?.source) { if (active) setImgSrc(data.thumbnail.source); return; }
        } catch { continue; }
      }
      if (active) setIsError(true);
    };
    fetchBirdImage();
    return () => { active = false; };
  }, [name, englishName, latinName]);

  if (isError || !imgSrc) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100 text-zinc-400 p-4 text-center">
        <Bird className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-[10px] font-bold">害羞的小鸟，<br/>暂无官方照 🍃</p>
      </div>
    );
  }
  return <img src={imgSrc} className={`w-full h-full object-cover transition-all duration-700 ${!isUnlocked ? 'brightness-[0.7] saturate-[0.5] contrast-[0.8]' : 'saturate-[1.1]'}`} alt={name || "鸟类图片"} />;
}

export default function App() {
  const [activeCategory, setActiveCategory] = useState("全部");
  const [flippedId, setFlippedId] = useState<number | null>(null);
  const [detailBird, setDetailBird] = useState<any | null>(null);
  const [birdRagDetails, setBirdRagDetails] = useState<Record<string, any>>({});

  const unlockedIds = useBirdStore((state) => state.unlockedIds);
  const customBirds = useBirdStore((state) => state.customBirds);
  const birdRecords = useBirdStore((state) => state.birdRecords);

  const allBirds = [...baseBirds,...customBirds];
  const filteredBirds = allBirds.filter((b) => activeCategory === "全部" || b.category === activeCategory);

  const handleCardClick = async (id: number, isUnlocked: boolean) => {
    if (!isUnlocked) return;

    const bird = allBirds.find(b => b.id === id);
    if (bird && !birdRagDetails[bird.name]) {
      try {
        const res = await fetch(`http://localhost:8000/api/v1/birds/${encodeURIComponent(bird.name)}/details`);
        if (res.ok) {
          const data = await res.json();
          setBirdRagDetails(prev => ({ ...prev, [bird.name]: data }));
        }
      } catch (e) {
        console.error("拉取鸟类详情失败:", e);
      }
    }

    setFlippedId(flippedId === id ? null : id);
  };

  return (
    <main className="min-h-screen bg-zinc-50 p-6 md:p-10 font-sans relative">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-4xl font-black text-emerald-950">📖 小鸟图鉴</h1>

        <div className="flex flex-wrap gap-2">
          {["全部", "林鸟", "水鸟", "猛禽", "城市鸟"].map((c) => (
            <button key={c} onClick={() => setActiveCategory(c)}
              className={`px-4 py-2 rounded-full font-bold text-xs border-2 transition-all ${activeCategory === c ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400'}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredBirds.map((bird) => {
            const isUnlocked = unlockedIds.includes(bird.id) || customBirds.some(b => b.id === bird.id);
            const isFlipped = flippedId === bird.id;
            const myRecord = birdRecords[bird.name];

            return (
              <div key={bird.id} className="relative h-[440px] w-full [perspective:1000px]">
                <div
                  className={`w-full h-full transition-all duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
                  onClick={() => handleCardClick(bird.id, isUnlocked)}
                >
                  {/* 正面 */}
                  <div className="absolute inset-0 [backface-visibility:hidden] bg-white p-5 rounded-3xl border-2 border-zinc-100 shadow-sm flex flex-col">
                    <div className="h-40 w-full rounded-2xl overflow-hidden relative mb-4 bg-zinc-100 flex-shrink-0">
                      <BirdImage name={bird.name} englishName={bird.englishName} latinName={bird.latinName} isUnlocked={isUnlocked} />
                      {!isUnlocked && <div className="absolute inset-0 bg-black/5 flex items-center justify-center"><Lock className="w-8 h-8 text-white/90 drop-shadow" /></div>}
                      {isUnlocked && <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm text-white p-1.5 rounded-full"><RotateCcw className="w-3.5 h-3.5" /></div>}
                    </div>
                    <div className="flex-1 flex flex-col items-center text-center">
                      <h2 className={`text-xl font-black ${isUnlocked ? 'text-emerald-950' : 'text-emerald-900/60'}`}>{bird.name}</h2>
                      <div className="text-[11px] font-bold mt-1 space-y-0.5 flex flex-col items-center text-emerald-600">
                        <p>{bird.englishName}</p>
                        <p className="italic text-emerald-500/70">{bird.latinName}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-zinc-100">
                      {isUnlocked ? (
                        <p className="text-[10px] font-bold text-zinc-500 text-center line-clamp-2">{bird.funFact}</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="bg-emerald-50 text-emerald-700 text-[9px] font-black py-1 px-2 rounded-md border border-emerald-100 text-center uppercase tracking-widest">等待一次自然相遇</div>
                          <button onClick={(e) => { e.stopPropagation(); window.location.href = '/recognize'; }} className="w-full py-2 bg-emerald-600 text-white text-[10px] font-black rounded-lg hover:bg-emerald-700 transition-colors">去识别</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 背面 */}
                  <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-emerald-900 p-5 rounded-3xl border-2 border-emerald-800 shadow-lg flex flex-col text-white">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-black">{bird.name}</h3>
                      <span className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-full">{bird.latinName}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
                      <div className="bg-white/10 p-3 rounded-xl">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-200 mb-1"><Calendar className="w-3 h-3" />首次相遇</div>
                        <p className="text-sm font-bold">{myRecord?.firstDate || "未记录"}</p>
                      </div>
                      <div className="bg-white/10 p-3 rounded-xl">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-200 mb-1"><MapPin className="w-3 h-3" />发现地</div>
                        <p className="text-sm font-bold"><LocationDisplay lat={myRecord?.lat} lng={myRecord?.lng} fallback={myRecord?.firstLocation || bird.location} /></p>
                      </div>
                      <div className="bg-white/10 p-3 rounded-xl">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-200 mb-2"><Camera className="w-3 h-3" />我的实拍相册</div>
                        {myRecord?.photos && myRecord.photos.length > 0 ? (
                          <div className="grid grid-cols-3 gap-1.5">
                            {myRecord.photos.map((url, idx) => (
                              <img key={idx} src={url} className="w-full h-14 object-cover rounded-lg border border-white/20" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-emerald-200/60 italic">暂无实拍照片</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDetailBird(bird); }}
                      className="mt-3 w-full py-2.5 bg-white text-emerald-900 rounded-xl text-xs font-black hover:bg-emerald-50 transition-colors"
                    >
                      查看完整自然笔记
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {detailBird && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setDetailBird(null)}>
          <div className="bg-[#fdfbf7] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-[#e6dcd0] p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setDetailBird(null)} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm border border-[#e6dcd0] hover:bg-[#f5f0e8] transition-colors">
              <X className="w-4 h-4 text-[#5c5044]" />
            </button>
            <div className="w-20 h-1 bg-[#e6dcd0] rounded-full mx-auto mb-6" />
            <div className="text-center mb-6">
              <p className="text-[10px] font-black text-amber-700/50 tracking-[0.2em] uppercase mb-2">NATURAL NOTE</p>
              <h2 className="text-2xl font-black text-[#2c221a] mb-1">{detailBird.name}</h2>
              <p className="text-sm font-bold text-[#8c7f70] italic">{detailBird.englishName}</p>
              <p className="text-xs text-[#b0a396] font-bold mt-1">{detailBird.latinName}</p>
              <div className="flex justify-center gap-3 mt-3">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full">🌿 {detailBird.category}</span>
                <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full">💎 {detailBird.rarity}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white/60 p-4 rounded-2xl border border-[#e6dcd0]/80 shadow-sm">
                <h4 className="font-black text-base text-[#2c221a] mb-2">🔍 外貌特征</h4>
                <p className="text-[#5c5044] text-[13px]">{(() => { const rag = birdRagDetails[detailBird.name]; if (!rag) return "🍃 正在从自然文库检索资料..."; return rag.details?.appearance || `${detailBird.name}的羽色和体态独特，拥有极具辨识度的外形特征。`; })()}</p>
              </div>
              <div className="bg-white/60 p-4 rounded-2xl border border-[#e6dcd0]/80 shadow-sm">
                <h4 className="font-black text-base text-[#2c221a] mb-2">🏡 生活习性</h4>
                <p className="text-[#5c5044] text-[13px]">{(() => { const rag = birdRagDetails[detailBird.name]; if (!rag) return "🍃 正在从自然文库检索资料..."; return rag.details?.habitatAndHabits || `主要在${detailBird.location || "特定生态区域"}活动。`; })()}</p>
              </div>
              <div className="bg-white/60 p-4 rounded-2xl border border-[#e6dcd0]/80 shadow-sm">
                <h4 className="font-black text-base text-[#2c221a] mb-2">🎵 鸣叫特点</h4>
                <p className="text-[#5c5044] text-[13px]">{(() => { const rag = birdRagDetails[detailBird.name]; if (!rag) return "🍃 正在从自然文库检索资料..."; return rag.details?.callCharacteristics || `鸣声多用于宣示领地或同伴联络。`; })()}</p>
              </div>
              <div className="bg-white/60 p-4 rounded-2xl border border-[#e6dcd0]/80 shadow-sm">
                <h4 className="font-black text-base text-[#2c221a] mb-2">🗺️ 分布区域</h4>
                <p className="text-[#5c5044] text-[13px]">{(() => { const rag = birdRagDetails[detailBird.name]; if (!rag) return "🍃 正在从自然文库检索资料..."; return rag.details?.distribution || `广泛分布于适宜其生存的特定海拔或气候带中。`; })()}</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-dashed border-[#e6dcd0] text-center text-[10px] text-amber-800/40 font-bold tracking-widest">
              —— 🍃 BIRD VIBE NATURE JOURNAL 🍃 ——
            </div>
          </div>
        </div>
      )}
    </main>
  );
}