"use client";

import dynamic from 'next/dynamic';
import { Map, Compass } from 'lucide-react';

// 🌟 使用 dynamic 动态引入地图组件，彻底规避 Next.js 服务端渲染错误
const BirdMap = dynamic(() => import('@/components/BirdMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[650px] bg-emerald-50 rounded-[2.5rem] flex flex-col items-center justify-center animate-pulse border-4 border-emerald-100">
      <Compass className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
      <p className="text-emerald-600 font-bold tracking-widest">正在展开秘密航海图...</p>
    </div>
  )
});

export default function MapPage() {
  return (
    <main className="min-h-screen bg-zinc-50 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 标题栏 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-emerald-950 flex items-center gap-3">
              <Map className="w-10 h-10 text-emerald-600" />
              秘密足迹地图
            </h1>
            <p className="text-emerald-700 font-medium mt-2">
              放大地图，看看你的“好朋友们”都藏在哪些角落吧！📍
            </p>
          </div>
          
          {/* 数据总览徽章 */}
          <div className="bg-white px-5 py-2.5 rounded-full border-2 border-emerald-100 shadow-sm flex items-center gap-2">
            <span className="text-xl">🐦</span>
            <span className="text-sm font-bold text-zinc-500">点亮了</span>
            <span className="text-lg font-black text-emerald-600">属于你的生态坐标</span>
          </div>
        </div>

        {/* 渲染地图组件 */}
        <BirdMap />
        
      </div>
    </main>
  );
}