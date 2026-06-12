"use client";

import { useState, useEffect } from "react";
import { Heart, MessageCircle, Share2, MapPin, Sparkles, Send } from "lucide-react";
import { baseBirds } from "@/store/useBirdStore"; // 🌟 引入你的图鉴字典！

// 🌟 核心：直接复用图鉴的 API 逻辑，根据鸟名动态、合法地抓取维基百科照片！
function DynamicBirdImage({ birdName }: { birdName: string }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchBirdImage = async () => {
      // 从你的本地图鉴库里找到这只鸟，提取出中、英、拉丁名作为搜索关键词
      const birdInfo = baseBirds.find(b => b.name === birdName);
      const queries = birdInfo ? [birdInfo.name, birdInfo.englishName, birdInfo.latinName] : [birdName];

      for (const query of queries) {
        if (!query) continue;
        try {
          // 调用官方摘要 API，这个接口绝对不会触发 403 拦截！
          const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
          const data = await response.json();
          if (data.thumbnail?.source) {
            if (active) setImgSrc(data.thumbnail.source);
            return; // 只要拿到一张合法的就立刻退出循环
          }
        } catch (e) { continue; }
      }
    };
    fetchBirdImage();
    return () => { active = false; };
  }, [birdName]);

  // 加载中的优雅骨架屏
  if (!imgSrc) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 text-emerald-600/50">
        <span className="text-3xl mb-2 animate-bounce">🍃</span>
        <span className="text-xs font-bold tracking-widest uppercase animate-pulse">正在从图鉴档案室调取影像...</span>
      </div>
    );
  }

  return (
    <img 
      src={imgSrc} 
      alt={birdName} 
      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" 
    />
  );
}

// 模拟社区动态数据（现在连 image 字段都不需要写了，直接靠名字匹配图鉴！）
const mockPosts = [
  {
    id: 1,
    user: { name: "自然观察员_阿布", avatar: "🏕️" },
    time: "2小时前",
    content: "今天在 NTU 的 Nanyang Lake 旁边蹲守了半个小时，终于抓拍到了这只漂亮的白领翡翠！它的叫声真的好大，脾气看起来很火爆哈哈！",
    birdName: "白领翡翠",
    location: "NTU Nanyang Lake",
    likes: 24,
    comments: 5,
    isLiked: false,
  },
  {
    id: 2,
    user: { name: "城市漫步者", avatar: "🚶" },
    time: "5小时前",
    content: "下楼买杯咖啡的功夫，发现一只爪哇八哥在偷吃小贩中心桌上的薯条🍟... 真的太聪明了，AI 识别说是极其常见，看来是老熟人了。",
    birdName: "爪哇八哥",
    location: "金文泰小贩中心",
    likes: 12,
    comments: 2,
    isLiked: true,
  },
  {
    id: 3,
    user: { name: "早起找鸟的Momo", avatar: "🦉" },
    time: "昨天 07:30",
    content: "解锁新图鉴！清晨的植物园简直是观鸟天堂，这只珠颈斑鸠脖子上的“珍珠”在晨光下太漂亮了，BirdVibe 的 AI 向导一秒就认出来了！",
    birdName: "珠颈斑鸠",
    location: "新加坡植物园",
    likes: 56,
    comments: 12,
    isLiked: false,
  }
];

export default function CommunityPage() {
  const [posts, setPosts] = useState(mockPosts);
  const [newPostText, setNewPostText] = useState("");

  const handleLike = (id: number) => {
    setPosts(posts.map(post => {
      if (post.id === id) {
        return { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 };
      }
      return post;
    }));
  };

  return (
    <main className="min-h-screen bg-zinc-50 p-4 md:p-8 font-sans pb-24">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* 头部标题区 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-4">
          <div>
            <h1 className="text-4xl font-black text-emerald-950 flex items-center gap-3">
              <Sparkles className="w-10 h-10 text-emerald-500" />
              鸟友情报局
            </h1>
            <p className="text-emerald-700 font-medium mt-2">
              看看其他自然探险家们今天又邂逅了哪些神奇的朋友。
            </p>
          </div>
        </div>

        {/* 发帖/发布动态区 */}
        <div className="bg-white rounded-3xl p-5 border-2 border-emerald-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center text-2xl flex-shrink-0">
              😎
            </div>
            <textarea 
              value={newPostText}
              onChange={(e) => setNewPostText(e.target.value)}
              placeholder="分享你刚刚在自然里的新发现..."
              className="w-full bg-zinc-50 rounded-2xl p-4 border border-zinc-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none resize-none h-24 text-sm font-medium text-zinc-700 transition-all placeholder:text-zinc-400"
            />
          </div>
          <div className="flex justify-between items-center pl-16">
            <button className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> 附加当前生境定位
            </button>
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-full text-sm font-black flex items-center gap-2 transition-all shadow-md active:scale-95">
              <Send className="w-4 h-4" /> 发送情报
            </button>
          </div>
        </div>

        {/* 动态信息流 */}
        <div className="space-y-6">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-3xl border-2 border-zinc-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* 用户信息与时间 */}
              <div className="p-5 flex items-center justify-between border-b border-zinc-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-lime-100 border border-lime-200 flex items-center justify-center text-xl">
                    {post.user.avatar}
                  </div>
                  <div>
                    <h3 className="font-black text-zinc-800 text-sm">{post.user.name}</h3>
                    <p className="text-[10px] text-zinc-400 font-bold mt-0.5">{post.time}</p>
                  </div>
                </div>
                {/* 鸟类标签 */}
                <div className="bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full text-xs font-black text-emerald-700 flex items-center gap-1.5">
                  🐦 {post.birdName}
                </div>
              </div>

              {/* 帖子正文与照片 */}
              <div className="p-5 space-y-4">
                <p className="text-zinc-700 text-sm leading-relaxed font-medium">
                  {post.content}
                </p>
                <div className="w-full h-64 rounded-2xl overflow-hidden bg-zinc-100 relative group">
                  {/* 🌟 核心：直接使用动态组件，传入鸟名即可 */}
                  <DynamicBirdImage birdName={post.birdName} />
                  
                  <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1.5 border border-white/20">
                    <MapPin className="w-3 h-3 text-lime-400" /> {post.location}
                  </div>
                </div>
              </div>

              {/* 互动数据栏 */}
              <div className="px-5 py-4 bg-zinc-50 flex items-center gap-6 border-t border-zinc-100">
                <button 
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-2 text-sm font-bold transition-colors ${post.isLiked ? 'text-red-500' : 'text-zinc-500 hover:text-red-500'}`}
                >
                  <Heart className={`w-5 h-5 ${post.isLiked ? 'fill-current' : ''}`} /> 
                  {post.likes}
                </button>
                <button className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-emerald-600 transition-colors">
                  <MessageCircle className="w-5 h-5" /> 
                  {post.comments}
                </button>
                <button className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-emerald-600 transition-colors ml-auto">
                  <Share2 className="w-4 h-4" /> 
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 触底提示 */}
        <div className="text-center py-8">
          <p className="text-xs font-bold text-emerald-600/50 flex items-center justify-center gap-2">
            <span>🍃</span> 暂无更多新情报啦，快去户外走走吧 <span>🍃</span>
          </p>
        </div>

      </div>
    </main>
  );
}