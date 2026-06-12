"use client";

import dynamic from 'next/dynamic';
import { Map, Compass, Sparkles, ArrowRight, TreePine } from 'lucide-react';
import { useBirdStore } from '@/store/useBirdStore'; // 🌟 引入状态仓库来做防御性检查

// 🌟 使用 dynamic 动态引入地图组件，彻底规避 Next.js 服务端渲染错误
const BirdMap = dynamic(() => import('@/components/BirdMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[650px] bg-emerald-50 rounded-[2.5rem] flex flex-col items-center justify-center animate-pulse border-4 border-emerald-100">
      <Compass className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
      <p className="text-emerald-600 font-bold tracking-widest">正在展开小鸟足迹图...</p>
    </div>
  )
});

export default function MapPage() {
  const birdRecords = useBirdStore((state) => state.birdRecords);

  // 🌟 核心防御：计算用户手机里到底存了多少个包含“有效经纬度”的记录
  const validPinsCount = Object.values(birdRecords).filter(
    (record) => record.lat && record.lng
  ).length;

  const hasCoordinates = validPinsCount > 0;

  return (
    <main className="min-h-screen bg-zinc-50 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 标题栏 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-emerald-950 flex items-center gap-3">
              <Map className="w-10 h-10 text-emerald-600" />
              小鸟足迹地图
            </h1>
            <p className="text-emerald-700 font-medium mt-2">
              {hasCoordinates 
                ? "放大地图，看看你的“好朋友们”都藏在哪些角落吧！📍" 
                : "小鸟足迹图已准备就绪，正在等待你的第一次户外邂逅。🍃"}
            </p>
          </div>
          
          {/* 数据总览徽章 - 🌟 变成动态计数了！ */}
          <div className="bg-white px-5 py-2.5 rounded-full border-2 border-emerald-100 shadow-sm flex items-center gap-2 w-fit">
            <span className="text-xl">🌟</span>
            <span className="text-sm font-bold text-zinc-500">已成功点亮</span>
            <span className="text-xl font-black text-emerald-600 px-1">{validPinsCount}</span>
            <span className="text-sm font-bold text-zinc-500">个生态坐标</span>
          </div>
        </div>

        {/* 🌟 条件渲染的核心：根据有没有坐标，决定给用户展示什么 */}
        {hasCoordinates ? (
          // 情况 A：用户拥有至少一个地图坐标，完美展现高清大图钉地图！
          <BirdMap />
        ) : (
          // 情况 B：极限边界情况！用户一个坐标都没有（不给定位权限或没填地址）
          <div className="grid md:grid-cols-3 gap-8">
            
            {/* 左侧 2/3 区域：依然保留地图，但上面蒙一层非常精美、带毛玻璃效果的提示框，不让界面显得空洞 */}
            <div className="md:col-span-2 relative h-[550px] rounded-[2.5rem] overflow-hidden border-4 border-dashed border-zinc-200 bg-zinc-100/50 flex flex-col items-center justify-center p-6 text-center">
              <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-70"></div>
              
              <div className="relative z-10 bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-zinc-200 max-w-md shadow-xl space-y-4">
                <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center text-3xl mx-auto border border-yellow-200 animate-bounce">
                  🧭
                </div>
                <h3 className="text-xl font-black text-zinc-800">小鸟的踪迹被迷雾笼罩了</h3>
                <p className="text-zinc-500 text-xs font-medium leading-relaxed">
                  由于当前还没有记录任何带有地理坐标的小鸟，地图暂时无法为你引航。下次偶遇小鸟时，记得在识别页面开启<span className="text-blue-600 font-bold">【获取精准坐标】</span>或填写具体地址哦！
                </p>
                <button 
                  onClick={() => window.location.href = '/recognize'}
                  className="mx-auto mt-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-lime-600 text-white font-black text-xs rounded-full shadow-lg hover:shadow-emerald-200 transition-all flex items-center gap-2 group active:scale-95"
                >
                  前往记录第一只鸟 <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* 右侧 1/3 区域：观鸟探险新手指引，填充视觉空白，让页面看起来非常有设计感 */}
            <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 rounded-[2.5rem] p-8 text-emerald-50 flex flex-col justify-between shadow-2xl relative overflow-hidden min-h-[550px]">
              <div className="absolute -top-10 -right-10 text-9xl opacity-10 transform rotate-12"><TreePine /></div>
              
              <div className="space-y-6">
                <div className="inline-block bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest text-lime-400">
                  🗺️ 探险指南
                </div>
                <h2 className="text-2xl font-black leading-tight">如何点亮<br />你的专属观鸟地图？</h2>
                
                <div className="space-y-4 pt-4">
                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-black text-lime-400 flex-shrink-0">1</span>
                    <p className="text-xs text-emerald-100/90 font-medium leading-relaxed">走向户外，在小贩中心、植物园或南大校园寻找鸟类的身影。</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-black text-lime-400 flex-shrink-0">2</span>
                    <p className="text-xs text-emerald-100/90 font-medium leading-relaxed">拍下照片后，在识别页面点击蓝色的<span className="text-white font-black underline decoration-lime-400">【获取精准坐标】</span>纽扣，锚定GPS卫星信号。</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-black text-lime-400 flex-shrink-0">3</span>
                    <p className="text-xs text-emerald-100/90 font-medium leading-relaxed">呼叫 AI 向导，匹配成功后，地图上就会“咚”地扎下一枚带有你实拍原图的超级图钉！</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3 mt-6">
                <div className="text-2xl">💡</div>
                <p className="text-[11px] text-emerald-200/90 leading-relaxed font-medium">
                  即使拒绝了浏览器的精确定位权限，在输入框里手写输入类似<span className="text-white font-bold">“新加坡植物园”</span>，AI 也会根据模糊地址智能分配一个地图中心点哦！
                </p>
              </div>

            </div>

          </div>
        )}
        
      </div>
    </main>
  );
}