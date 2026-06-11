"use client";

import { useState } from "react";
import confetti from "canvas-confetti";
import { MapPin, Crosshair, Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,         
  DialogDescription,   
} from "@/components/ui/dialog";
import { useBirdStore } from "@/store/useBirdStore";

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [location, setLocation] = useState<string>(""); 
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedBird, setSelectedBird] = useState<any>(null);
  const unlockBird = useBirdStore((state) => state.unlockBird);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError("哎呀，您的设备好像不支持定位功能。");
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        setError("定位失败，请检查浏览器是否允许了位置权限哦！");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#10B981', '#F59E0B', '#84CC16', '#FCD34D'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#10B981', '#F59E0B', '#84CC16', '#FCD34D'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  const handleRecognize = async () => {
    if (!image) {
      setError("哎呀，背包里好像还没有装入照片哦！📸");
      return;
    }
    
    setLoading(true); setError(null); setResult(null);

    const formData = new FormData();
    formData.append("image", image);
    if (location) formData.append("location", location); 
    if (coords) {
      formData.append("lat", coords.lat.toString());
      formData.append("lng", coords.lng.toString());
    }

    try {
      const response = await fetch("http://localhost:8000/api/v1/recognize", {
        method: "POST", body: formData,
      });

      if (!response.ok) throw new Error("自然电波好像有点弱，请检查后端魔法是否开启📡");

      const data = await response.json();
      setResult(data);
      
      // 只有置信度"高"或"中"才解锁图鉴，"低"不解锁
      const certainty = data.certainty_level;
      if (certainty === "高" || certainty === "中") {
        if (data.top5_candidates && data.top5_candidates.length > 0) {
          const topBird = data.top5_candidates[0];
          unlockBird(topBird.name, { 
            reason: topBird.reason, 
            imageUrl: imagePreview, 
            location: location || "探索中发现",
            lat: coords?.lat,
            lng: coords?.lng
          });
          triggerConfetti();
        }
      }
    } catch (err: any) {
      setError(err.message || "发生未知错误啦");
    } finally {
      setLoading(false);
    }
  };

  const getMockBirdDetails = (birdName: string, userImageUrl: string | null) => ({
    name: birdName,
    englishName: `${birdName} Bird`,
    latinName: `Aves ${birdName.substring(0,4)}us`,
    family: "雀形目 (Passeriformes) · 鸣禽科",
    imageUrl: userImageUrl || "https://images.unsplash.com/photo-1605092676920-8ac5ae40c7c8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80", 
    firstObservedDate: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
    appearance: "羽色极具环境适应性。雄鸟常伴有显眼的金属光泽以吸引配偶；雌鸟多为保护色，便于在复杂的自然植被中隐蔽孵卵；幼鸟喙部常带有明显的明黄色特征。",
    distribution: "广泛分布于热带及亚热带地区。适应力极强，从深山密林到开阔的湿地，乃至城市中的绿地生态系统，都能见到它们灵动的身影。",
    habits: "性格活泼且机警。主食植物浆果与小型昆虫，偶尔会在清晨或雨后飞到开阔地段觅食。具有较强的领地意识和群聚交流特性。",
    voice: "鸣声多变。繁殖期多会站在高处发出清脆连续的连音以宣示领地，而在觅食或受惊时，则会发出短促的单音节警告声。",
    funFact: "它们是大自然中的\"语言大师\"！拥有极强的学习和记忆能力，甚至能模仿周围环境中其他鸟类乃至哺乳动物的声音来迷惑天敌。"
  });

  const certaintyBadge = (level: string) => {
    if (level === "高") return <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 border border-emerald-200">识别度：高 ✓</span>;
    if (level === "中") return <span className="px-2 py-0.5 rounded-full text-xs font-black bg-yellow-100 text-yellow-700 border border-yellow-200">识别度：中 ~</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-600 border border-red-200">识别度：低 ✗</span>;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-50 via-lime-100 to-emerald-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-10">
        
        <div className="text-center space-y-4 pt-8">
          <div className="inline-block bg-white/70 backdrop-blur-md px-8 py-4 rounded-full border-4 border-emerald-100 shadow-xl transform rotate-1 hover:rotate-0 transition-transform duration-300">
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-yellow-500 tracking-wide">
              🌿 自然小鸟探索图鉴 🌻
            </h1>
          </div>
          <p className="text-lg text-emerald-700/80 font-bold tracking-widest drop-shadow-sm">带上相机，走向户外，去大自然中结交新伙伴吧！🍃</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 relative">
          <div className="bg-white/80 backdrop-blur-sm rounded-[2rem] border-4 border-emerald-200 p-6 md:p-8 shadow-2xl relative">
            <div className="absolute -top-6 -left-6 text-5xl animate-bounce drop-shadow-md">🏕️</div>
            <div className="space-y-2 mb-8">
              <h2 className="text-2xl font-black text-emerald-600 flex items-center gap-2"><span>记录自然足迹</span></h2>
              <p className="text-zinc-500 font-medium text-sm">上传你在户外拍到的照片，AI向导帮你辨认！</p>
            </div>

            <div className="space-y-6">
              <div className="bg-yellow-50/80 rounded-2xl p-4 border-2 border-yellow-200 hover:shadow-md transition-shadow">
                <label className="block text-yellow-700 font-bold mb-3 flex items-center gap-2"><span className="text-xl">📸</span> 捕捉到的掠影 (照片)</label>
                <input type="file" accept="image/*" onChange={handleImageChange} className="w-full text-sm text-yellow-700 file:mr-4 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-yellow-200 file:text-yellow-800 hover:file:bg-yellow-300 transition-colors cursor-pointer" />
                {imagePreview && (
                  <div className="mt-4 p-2 bg-white rounded-xl transform -rotate-1 border-2 border-yellow-100 shadow-sm relative"><img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" /></div>
                )}
              </div>

              <div className="bg-blue-50/80 rounded-2xl p-4 border-2 border-blue-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-blue-200 text-blue-800 text-[10px] font-black px-2 py-1 rounded-bl-lg">结合生境提升准确率</div>
                
                <div className="flex justify-between items-center mb-3">
                  <label className="text-blue-800 font-bold flex items-center gap-2">
                    <MapPin className="w-5 h-5" /> 生境与位置描述
                  </label>
                  <button 
                    onClick={handleGetLocation}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors shadow-sm"
                  >
                    {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
                    {isLocating ? "搜索卫星..." : "获取精准坐标"}
                  </button>
                </div>

                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="例如：NTU Nanyang Lake 旁边的树上..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-sm font-bold text-blue-950 placeholder:text-blue-300 bg-white/60 backdrop-blur-sm"
                />
                
                {coords && (
                  <div className="mt-3 flex items-center gap-1.5 text-emerald-600 text-xs font-black bg-emerald-100/50 px-2 py-1 rounded-md w-fit border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    已锚定坐标: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)} (将在地图点亮)
                  </div>
                )}
                
                <p className="mt-2 text-[11px] text-blue-600/80 font-medium">💡 填写具体生境（如：靠近水源、高大乔木），能帮助大模型提升识别率。获取精确坐标则用于点亮您的专属观鸟地图。</p>
              </div>

              {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold animate-pulse">{error}</div>}

              <button 
                className={`w-full py-4 rounded-full text-xl font-black text-white shadow-xl transform transition-all duration-300 ${loading ? 'bg-zinc-300 cursor-not-allowed scale-95' : 'bg-gradient-to-r from-emerald-500 to-lime-500 hover:from-emerald-600 hover:to-lime-600 hover:-translate-y-2 hover:shadow-emerald-300/50 active:scale-95'}`}
                onClick={handleRecognize} disabled={loading}
              >
                {loading ? "🔍 结合环境推理中..." : "🍃 呼叫 AI 自然向导 🍃"}
              </button>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-[2rem] border-4 border-lime-200 p-6 md:p-8 shadow-2xl relative">
            <div className="absolute -top-6 -right-6 text-5xl transform rotate-12 drop-shadow-md">🗺️</div>
            <div className="space-y-2 mb-8">
              <h2 className="text-2xl font-black text-lime-600 flex items-center gap-2"><span>生态发现报告</span></h2>
              <p className="text-zinc-500 font-medium text-sm">来看看是哪位大自然的小精灵被你发现了！</p>
            </div>

            <div className="min-h-[400px]">
              {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-emerald-300 space-y-4 pt-10"><div className="text-6xl animate-bounce">🌱</div><p className="font-bold text-lg">图鉴还是空空的，去户外的绿地走走吧！</p></div>
              )}
              {loading && (
                <div className="h-full flex flex-col items-center justify-center text-emerald-500 space-y-4 pt-10"><div className="text-6xl animate-spin">🍂</div><p className="font-bold text-lg animate-pulse">向导正在比对生态特征，请稍候...</p></div>
              )}

              {result && (
                <>
                  {/* 置信度低：不展示候选列表，只展示特征描述和提示 */}
                  {result.certainty_level === "低" ? (
                    <div className="flex flex-col items-center justify-center space-y-5 pt-6 text-center">
                      <div className="text-5xl">🔍</div>
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 space-y-3">
                        <p className="text-amber-700 font-black text-base">识别不确定，换个角度重拍试试？</p>
                        {result.feature_description && (
                          <p className="text-zinc-600 font-medium text-sm leading-relaxed">
                            我看到了<span className="text-emerald-700 font-bold">「{result.feature_description}」</span>，但我不确定它的具体种类。
                          </p>
                        )}
                        <p className="text-amber-500 text-xs font-medium">💡 建议：靠近拍摄、保持画面清晰、多角度尝试</p>
                      </div>
                      {certaintyBadge(result.certainty_level)}
                    </div>
                  ) : (
                    /* 置信度高/中：正常展示候选列表 */
                    result.top5_candidates && (
                      <div className="space-y-5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="flex justify-end">{certaintyBadge(result.certainty_level)}</div>
                        {result.top5_candidates.map((bird: any, index: number) => (
                          <div key={index} className="bg-white p-5 rounded-2xl border-2 border-emerald-100 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors flex flex-col">
                            {index === 0 && <div className="absolute top-0 right-0 bg-gradient-to-bl from-emerald-500 to-lime-400 text-white text-xs px-3 py-1.5 rounded-bl-xl font-bold shadow-sm">🌲 最佳匹配</div>}
                            <h3 className="font-black text-xl text-zinc-800 flex items-center gap-2">{index === 0 ? '🦉' : '🐦'} {bird.name}</h3>
                            <div className="w-full bg-zinc-100 rounded-full h-3 mt-3 mb-1 overflow-hidden border border-zinc-200">
                              <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-emerald-500 transition-all duration-1000 ease-out" style={{ width: `${bird.confidence * 100}%` }}></div>
                            </div>
                            <p className="text-xs text-zinc-400 font-bold mb-3">相似度: {(bird.confidence * 100).toFixed(1)}%</p>
                            <div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl text-sm font-medium leading-relaxed border border-emerald-100 mb-4">{bird.reason}</div>
                            <button 
                              onClick={() => setSelectedBird(getMockBirdDetails(bird.name, imagePreview))}
                              className="self-end px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800 font-bold rounded-full text-sm transition-colors flex items-center gap-1"
                            >
                              📖 查看物种百科 &rarr;
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!selectedBird} onOpenChange={() => setSelectedBird(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[90vw] md:max-w-[70vw] lg:max-w-[1400px] p-0 overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-lime-950 border-2 border-lime-800 shadow-[0_0_80px_rgba(20,83,45,0.8)] rounded-[2.5rem]">
          <DialogTitle className="sr-only">小鸟物种百科：{selectedBird?.name}</DialogTitle>
          <DialogDescription className="sr-only">为您展示关于该物种的外貌、习性及分布的详细科普信息。</DialogDescription>
          
          {selectedBird && (
            <div className="flex flex-col lg:flex-row max-h-[90vh] overflow-y-auto lg:overflow-hidden custom-scrollbar-dark">
              <div className="relative h-72 lg:h-auto lg:w-2/5 flex-shrink-0">
                <img src={selectedBird.imageUrl} alt={selectedBird.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/20 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-emerald-950 flex flex-col justify-end p-8 lg:p-10">
                  <h2 className="text-5xl lg:text-7xl font-black text-lime-50 drop-shadow-2xl tracking-wide leading-tight">{selectedBird.name}</h2>
                  <p className="text-lime-400 font-bold italic mt-3 text-xl drop-shadow-md">{selectedBird.englishName}</p>
                  <p className="text-emerald-300 font-medium mt-1 text-sm opacity-80">{selectedBird.latinName}</p>
                </div>
                <div className="absolute top-6 right-6 lg:left-6 lg:right-auto bg-black/40 backdrop-blur-md border border-lime-500/30 text-lime-100 px-5 py-2 rounded-full text-sm font-black shadow-xl">{selectedBird.family}</div>
                <div className="absolute top-6 left-6 lg:top-20 lg:left-6 bg-emerald-600/80 backdrop-blur-md border border-emerald-400/50 text-emerald-50 px-4 py-2 rounded-full text-sm font-bold shadow-xl flex items-center gap-2">
                  <span className="text-lg">🗓️</span> 
                  <span>首次观测：{selectedBird.firstObservedDate}</span>
                </div>
              </div>

              <div className="p-8 lg:p-12 lg:w-3/5 lg:overflow-y-auto custom-scrollbar-dark space-y-8">
                <div className="bg-emerald-900/40 p-6 md:p-8 rounded-3xl shadow-inner border border-emerald-700/50 relative transform hover:scale-[1.01] transition-transform">
                  <div className="absolute -top-4 left-8 bg-emerald-600 text-lime-50 px-5 py-1.5 rounded-full text-sm font-black shadow-lg flex items-center gap-2"><span>🔍</span> 外貌特征</div>
                  <p className="text-emerald-100 mt-2 text-base md:text-lg leading-relaxed tracking-wide font-medium">{selectedBird.appearance}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-lime-950/40 p-6 md:p-8 rounded-3xl shadow-inner border border-lime-800/50 relative hover:bg-lime-900/40 transition-colors">
                    <div className="absolute -top-4 left-6 bg-lime-600 text-lime-50 px-4 py-1.5 rounded-full text-sm font-black shadow-lg">🏕️ 生活习性</div>
                    <p className="text-lime-100 mt-2 text-base leading-relaxed tracking-wide">{selectedBird.habits}</p>
                  </div>
                  <div className="bg-emerald-900/30 p-6 md:p-8 rounded-3xl shadow-inner border border-emerald-700/50 relative hover:bg-emerald-800/30 transition-colors">
                    <div className="absolute -top-4 left-6 bg-emerald-500 text-emerald-50 px-4 py-1.5 rounded-full text-sm font-black shadow-lg">🗺️ 分布地区</div>
                    <p className="text-emerald-100 mt-2 text-base leading-relaxed tracking-wide">{selectedBird.distribution}</p>
                  </div>
                  <div className="bg-teal-950/40 p-6 md:p-8 rounded-3xl shadow-inner border border-teal-800/50 relative hover:bg-teal-900/40 transition-colors">
                    <div className="absolute -top-4 left-6 bg-teal-600 text-teal-50 px-4 py-1.5 rounded-full text-sm font-black shadow-lg">🎵 叫声特征</div>
                    <p className="text-teal-100 mt-2 text-base leading-relaxed tracking-wide">{selectedBird.voice}</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-900/40 to-lime-900/40 p-6 md:p-8 rounded-3xl shadow-inner border border-yellow-700/50 relative hover:from-yellow-800/40 transition-colors">
                    <div className="absolute -top-4 left-6 bg-yellow-600 text-yellow-50 px-4 py-1.5 rounded-full text-sm font-black shadow-lg">✨ 趣味冷知识</div>
                    <p className="text-yellow-100/90 mt-2 text-base md:text-lg leading-relaxed font-bold tracking-wide">{selectedBird.funFact}</p>
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