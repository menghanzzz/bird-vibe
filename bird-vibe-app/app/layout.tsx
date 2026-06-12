import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Home, Camera, Map, BookOpen, Users } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BirdVibe 观鸟探索图鉴",
  description: "AI驱动的多模态观鸟图鉴与社区",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.className} flex h-screen bg-zinc-50 overflow-hidden`}>
        
        {/* 左侧边栏：深邃森林绿沉浸式设计 */}
        <aside className="w-64 bg-emerald-950 text-emerald-50 flex flex-col shadow-2xl z-20 flex-shrink-0">
          
          {/* Logo 区域 */}
          <div className="h-20 flex items-center px-6 border-b border-emerald-800/50">
            <div className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-lime-300 to-emerald-400">
              🌿 BirdVibe
            </div>
          </div>

          {/* 萌化版导航菜单 */}
          <nav className="flex-1 py-6 px-4 space-y-2">
            <p className="px-2 text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4">
              探索指南
            </p>
            
            <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-900 transition-colors group">
              <Home className="w-5 h-5 text-emerald-400 group-hover:text-lime-300 transition-colors" />
              <span className="font-bold tracking-wide group-hover:text-lime-50">🪵 小鸟观察手札</span>
            </Link>

            <Link href="/recognize" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-900 transition-colors group">
              <Camera className="w-5 h-5 text-emerald-400 group-hover:text-lime-300 transition-colors" />
              <span className="font-bold tracking-wide group-hover:text-lime-50">📸 小鸟智能识别</span>
            </Link>

            <Link href="/map" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-900 transition-colors group">
              <Map className="w-5 h-5 text-emerald-400 group-hover:text-lime-300 transition-colors" />
              <span className="font-bold tracking-wide group-hover:text-lime-50">📍 小鸟足迹地图</span>
            </Link>

            <Link href="/pokedex" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-900 transition-colors group">
              <BookOpen className="w-5 h-5 text-emerald-400 group-hover:text-lime-300 transition-colors" />
              <span className="font-bold tracking-wide group-hover:text-lime-50">📖 小鸟图鉴</span>
            </Link>

            <Link href="/community" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-900 transition-colors group">
              <Users className="w-5 h-5 text-emerald-400 group-hover:text-lime-300 transition-colors" />
              <span className="font-bold tracking-wide group-hover:text-lime-50">🍃 鸟友情报局</span>
            </Link>
          </nav>

          {/* 底部用户信息栏 */}
          <div className="p-4 border-t border-emerald-800/50">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-emerald-600 flex items-center justify-center font-black text-emerald-950 shadow-inner">
                Me
              </div>
              <div>
                <p className="text-sm font-bold text-lime-50">超级情报员</p>
                <p className="text-xs text-emerald-400 font-medium">LV.1 初识</p>
              </div>
            </div>
          </div>
        </aside>

        {/* 右侧主内容区 */}
        <main className="flex-1 h-full overflow-y-auto bg-zinc-50 relative">
          {children}
        </main>

      </body>
    </html>
  );
}