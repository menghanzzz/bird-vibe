"use client";

import { useState, useRef } from "react";
import ReactECharts from "echarts-for-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, X, Sparkles } from "lucide-react";
import * as htmlToImage from "html-to-image";

export default function Dashboard() {
  const [isPosterOpen, setIsPosterOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  const todayDate = "2026年06月12日";

  // 🚀 核心海报生成魔法：完美兼容现代 CSS 颜色格式
  const handleDownloadPoster = async () => {
    if (!posterRef.current) return;
    setIsDownloading(true);

    try {
      const dataUrl = await htmlToImage.toPng(posterRef.current, {
        pixelRatio: 2,
        backgroundColor: "transparent",
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `BirdVibe-成就海报-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      
      setIsPosterOpen(false);
    } catch (error) {
      console.error("海报魔法施展失败:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  // --- ECharts 配置保持不变 ---
  const activityOption = {
    tooltip: { trigger: "axis" },
    grid: { left: "5%", right: "5%", bottom: "10%", containLabel: true },
    xAxis: {
      type: "category",
      data: ["1月", "2月", "3月", "4月", "5月", "6月"],
      axisLabel: { color: "#065F46", fontWeight: "bold" }
    },
    yAxis: { type: "value", splitLine: { lineStyle: { type: "dashed", color: "#D1FAE5" } } },
    series: [{
      name: "观测记录数", data: [12, 19, 15, 28, 42, 35], type: "line", smooth: true, itemStyle: { color: "#10B981" },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(16, 185, 129, 0.4)" }, { offset: 1, color: "rgba(16, 185, 129, 0)" }] } }
    }]
  };

  const familyOption = {
    tooltip: { trigger: "item" },
    series: [{
      name: "科属分布", type: "pie", radius: ["20%", "70%"], roseType: "area", itemStyle: { borderRadius: 8 },
      data: [
        { value: 18, name: "雀科/鹟科", itemStyle: { color: "#34D399" } },
        { value: 12, name: "鸭科/鹭科", itemStyle: { color: "#60A5FA" } },
        { value: 8, name: "鹰科/隼科", itemStyle: { color: "#FBBF24" } },
        { value: 6, name: "翠鸟科", itemStyle: { color: "#F472B6" } },
        { value: 4, name: "太阳鸟科", itemStyle: { color: "#A78BFA" } }
      ]
    }]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-lime-100 to-emerald-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* 头部欢迎语 + 按钮 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-emerald-900 drop-shadow-sm">
              🪵 小鸟观察手札
            </h1>
            <p className="mt-2 text-emerald-700 font-bold tracking-wide">
              欢迎回来！这里珍藏着你所有的数据里程碑。
            </p>
          </div>
          {/* 将生成海报按钮挪移到看板头部右侧，极具全局掌控感 */}
          <button 
            onClick={() => setIsPosterOpen(true)}
            className="self-start md:self-end bg-gradient-to-r from-yellow-500 to-emerald-600 text-white hover:from-yellow-600 hover:to-emerald-700 px-6 py-3 rounded-full font-black text-sm transition-all shadow-xl hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-yellow-200 animate-pulse" />
            <span>生成荣誉探索海报</span>
          </button>
        </div>

        {/* 核心指标卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border-2 border-emerald-100 shadow-xl relative overflow-hidden">
            <p className="text-emerald-600 font-bold text-sm">个人总加新 (Lifers)</p>
            <h2 className="text-5xl font-black text-emerald-800 mt-2">128 <span className="text-xl text-emerald-500 font-bold">种</span></h2>
          </div>
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border-2 border-lime-100 shadow-xl relative overflow-hidden">
            <p className="text-lime-700 font-bold text-sm">已点亮科属</p>
            <h2 className="text-5xl font-black text-lime-800 mt-2">34 <span className="text-xl text-lime-600 font-bold">科</span></h2>
          </div>
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border-2 border-yellow-100 shadow-xl relative overflow-hidden">
            <p className="text-yellow-700 font-bold text-sm">累计观察记录</p>
            <h2 className="text-5xl font-black text-yellow-800 mt-2">452 <span className="text-xl text-yellow-600 font-bold">次</span></h2>
          </div>
        </div>

        {/* 图表区 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border-2 border-emerald-100 shadow-xl">
            <h3 className="text-xl font-black text-emerald-800 mb-4">📈 年度出野外活跃度</h3>
            <ReactECharts option={activityOption} style={{ height: "300px" }} />
          </div>
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border-2 border-lime-100 shadow-xl">
            <h3 className="text-xl font-black text-lime-800 mb-4">🧬 鸟种科属解锁图鉴</h3>
            <ReactECharts option={familyOption} style={{ height: "300px" }} />
          </div>
        </div>

      </div>

      {/* 📥 弹出层：全面升级的数据荣誉海报 */}
      <Dialog open={isPosterOpen} onOpenChange={() => setIsPosterOpen(false)}>
        <DialogContent className="w-[95vw] sm:max-w-[500px] p-0 overflow-hidden bg-emerald-950 border-2 border-lime-800 shadow-2xl rounded-[2.5rem] flex flex-col items-center justify-center">
          <DialogTitle className="sr-only">我的全量观鸟探索明信片</DialogTitle>
          <DialogDescription className="sr-only">为您整合全量统计数据，生成极具收藏价值的野外考察荣誉海报。</DialogDescription>

          <div className="p-6 w-full flex flex-col items-center space-y-6">
            
            {/* 实体海报内容 */}
            <div 
            ref={posterRef}
            className="w-[380px] h-[630px] bg-gradient-to-b from-yellow-50 via-lime-50 to-emerald-100 p-6 rounded-[2rem] border-8 border-white shadow-inner flex flex-col justify-between relative overflow-hidden text-emerald-950 select-none"
            >
              <div className="absolute -right-16 -bottom-16 text-[15rem] opacity-5 pointer-events-none">🌿</div>
              
              <div className="space-y-1 text-center border-b-2 border-emerald-800/20 pb-4">
                <div className="text-xs font-black tracking-widest text-emerald-700 bg-emerald-200/60 px-3 py-1 rounded-full inline-block">
                  BIRDVIBE ADVENTURE LEDGER
                </div>
                <h3 className="text-3xl font-black tracking-wide mt-2 text-emerald-900">自然考察年度手账</h3>
                <p className="text-xs text-emerald-600 font-bold italic">“用数据记录对飞羽的热爱”</p>
              </div>

              {/* 看板数据完美映射到海报中 */}
              <div className="my-auto space-y-5">
                <div className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-emerald-200/50 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-emerald-600 flex items-center justify-center font-black text-emerald-950 text-lg shadow-md border-2 border-white">Me</div>
                  <div>
                    <h4 className="text-base font-black text-emerald-900">高级情报员</h4>
                    <p className="text-[10px] font-bold text-emerald-600 bg-lime-200/60 px-2 py-0.5 rounded mt-1 inline-block whitespace-nowrap">🏷️ LV.1 初识</p>
                  </div>
                </div>

                {/* 豪华四宫格数据面板 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-900 text-yellow-50 p-3.5 rounded-xl text-center shadow-sm">
                    <span className="text-[10px] font-bold opacity-70 block">累计加新 (Lifer)</span>
                    <span className="text-2xl font-black mt-0.5 block">128 <span className="text-xs">种</span></span>
                  </div>
                  <div className="bg-lime-800 text-lime-50 p-3.5 rounded-xl text-center shadow-sm">
                    <span className="text-[10px] font-bold opacity-70 block">解锁鸟类科属</span>
                    <span className="text-2xl font-black mt-0.5 block">34 <span className="text-xs">科</span></span>
                  </div>
                  <div className="bg-yellow-500 text-yellow-950 p-3.5 rounded-xl text-center shadow-sm">
                    <span className="text-[10px] font-bold opacity-80 block">总观测记录</span>
                    <span className="text-2xl font-black mt-0.5 block">452 <span className="text-xs">次</span></span>
                  </div>
                  <div className="bg-white text-emerald-900 p-3.5 rounded-xl text-center shadow-sm border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-600 block">全站荣誉排行</span>
                    <span className="text-2xl font-black mt-0.5 block">Top 18%</span>
                  </div>
                </div>

                {/* 精美手账徽章 */}
                <div className="bg-emerald-900/5 p-4 rounded-xl border border-dashed border-emerald-700/30 text-xs font-bold text-emerald-900/90 space-y-1">
                  <p className="text-emerald-800 font-black mb-1">🌲 近期野外考察成就：</p>
                  <p>• 解锁稀有度极高物种 “黄腰柳莺” 🌟</p>
                  <p>• 连续 5 个月保持高频户外探索活跃度 📈</p>
                </div>
              </div>

              <div className="flex items-end justify-between border-t border-emerald-800/20 pt-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">冲印时间</p>
                  <p className="text-sm font-black text-emerald-900">{todayDate}</p>
                </div>
                <div className="w-14 h-14 rounded-full border-4 border-dashed border-emerald-600/50 flex flex-col items-center justify-center transform rotate-12 text-emerald-600/80 font-black text-[9px] bg-emerald-50 shadow-sm">
                  <span>BIRDVIBE</span>
                  <span className="border-t border-b border-emerald-600/30 my-0.5 scale-90">CERTIFIED</span>
                  <span>考察成功</span>
                </div>
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="flex gap-4 w-full">
              <button
                onClick={() => setIsPosterOpen(false)}
                className="flex-1 py-3 bg-emerald-900 hover:bg-emerald-800 text-emerald-100 font-bold rounded-full text-sm transition-colors flex items-center justify-center gap-1"
              >
                <X className="w-4 h-4" /> 取消
              </button>
              <button
                onClick={handleDownloadPoster}
                disabled={isDownloading}
                className="flex-1 py-3 bg-gradient-to-r from-yellow-500 to-lime-500 hover:from-yellow-600 hover:to-lime-600 text-emerald-950 font-black rounded-full text-sm shadow-xl transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:scale-95 disabled:bg-zinc-300"
              >
                {isDownloading ? <>🪄 正在冲印...</> : <><Download className="w-4 h-4" /> 导出荣誉图片</>}
              </button>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}