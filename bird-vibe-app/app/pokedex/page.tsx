"use client";

import React, { useState, useEffect } from "react";
// 🌟 引入了 X 图标用于关闭详情弹窗
import { Search, Bird, Lock, RotateCcw, Camera, MapPin, Calendar, X } from "lucide-react";
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ==========================================
// 🌟 状态与数据管理 (原 store/useBirdStore.ts 内容)
// ==========================================
export const baseBirds = [
    { 
      id: 1, 
      name: "树麻雀", 
      englishName: "Eurasian Tree Sparrow", 
      latinName: "Passer montanus", 
      category: "城市鸟", 
      rarity: "极度常见", 
      location: "街头巷尾", 
      funFact: "脸颊上有明显的黑斑。",
      details: {
        appearance: "【新手辨识指南】\n虽然长得灰溜溜的，但树麻雀有一个绝对不会认错的标志：它们纯白色的脸颊正中央，各有一块非常明显的黑色圆斑，就像贴了黑色的圆脸蛋贴纸。\n\n它们的头顶是温暖的栗褐色，背部有黑色的纵向条纹。体型娇小，只有14厘米左右，看起来圆滚滚的。",
        habitatAndHabits: "【观察小贴士】\n它们是人类的终极铁粉，几乎不会在远离人类建筑的地方生活。\n\n在地面上移动时，它们不会走路，而是用双脚并拢‘蹦蹦跳跳’地前进。它们特别喜欢成群结队地在草丛或灌木丛里叽叽喳喳开会。如果你在沙地或干燥的泥土边看到它们趴在地上扑腾，那是在进行‘沙浴’——用沙子来清理羽毛里的寄生虫呢！",
        callCharacteristics: "【声音密码】\n声音是短促、清脆且没有太多旋律的‘喳、喳、喳’（tsip-tsip）。如果是很大一群聚在一起，声音会变得非常密集嘈杂，像是在热烈地吵架。",
        distribution: "全球分布极广。在我们的城市里，无论是组屋楼下的草地、小贩中心外围的灌木，还是校园的角落，只要有食物碎屑和绿化带，就能看到它们蹦跳的身影。"
      }
    },
    { 
      id: 2, 
      name: "爪哇八哥", 
      englishName: "Javan Myna", 
      latinName: "Acridotheres javanicus", 
      category: "城市鸟", 
      rarity: "极度常见", 
      location: "小贩中心", 
      funFact: "极度聪明，擅长模仿。",
      details: {
        appearance: "【新手辨识指南】\n远看是一只黑鸟，但凑近看大有玄机。它们全身羽毛呈深黑色或暗深灰色，最亮眼的是那张明黄色的尖嘴和同样黄色的双腿。\n\n额头上方有一小撮竖起来的羽毛，看起来像梳了个‘朋克头’（羽冠）。当它们飞起来的时候，翅膀上会突然闪现出两块非常醒目的白色斑块，这是飞行时的重要辨识特征。",
        habitatAndHabits: "【观察小贴士】\n性格极其大胆、自信，可以说是小贩中心和露天餐厅的‘霸主’。和麻雀不同，八哥在地上是迈着步子大摇大摆地‘走路’，而不是蹦跳。\n\n它们智商极高，属于杂食性，不仅会翻找薯条、米饭等人类食物残渣，还会跟着除草机后面吃被惊飞的昆虫。傍晚时分，它们会成百上千只地聚集在特定的大树上（称为夜栖树），场面极其壮观。",
        callCharacteristics: "【声音密码】\n出了名的大嗓门和‘语言大师’。叫声粗厉、沙哑且多变。作为椋鸟科的一员，它们非常擅长模仿环境里的声音，有时你会听到它们发出类似口哨声、警报声甚至其他鸟类的叫声。",
        distribution: "原产于印尼爪哇岛等地。但在引入后，凭借超强的适应能力，它们现在已经成为本地数量最多、最强势的鸟种之一。"
      }
    },
    { 
      id: 3, 
      name: "珠颈斑鸠", 
      englishName: "Spotted Dove", 
      latinName: "Spilopelia chinensis", 
      category: "城市鸟", 
      rarity: "常见", 
      location: "公园", 
      funFact: "后颈有黑底白点的珍珠项链。",
      details: {
        appearance: "【新手辨识指南】\n体型比麻雀和八哥都要大一圈（约30厘米），体态优雅。整体是柔和的灰褐色，胸腹部透着一点温柔的粉红色。\n\n最标志性的特征在它的脖子后面：有一大块黑色的羽毛，上面点缀着密密麻麻的白色小圆点，就像戴了一条华丽的‘珍珠项链’，‘珠颈’的名字正是由此而来。",
        habitatAndHabits: "【观察小贴士】\n性格比较温和、胆小，常常一公一母成对出现。它们喜欢在开阔的草地或小径上觅食掉落的种子。\n\n走路时，它们的头部会像上了发条一样，非常有节奏地前后点动。如果有人靠近，它们会突然受惊起飞，起飞的瞬间翅膀会用力拍打空气，发出明显的‘扑扑扑’声响。",
        callCharacteristics: "【声音密码】\n这是城市里最催眠的声音之一。叫声是低沉、缓慢、极具节奏感的‘咕——咕——咕’，或者‘咕咕——咕’。如果在慵懒的午后听到这种声音，多半是它们在附近的树枝上休息。",
        distribution: "广泛分布于亚洲的热带和亚热带地区。在公园、小区绿化带、自然保护区边缘非常容易见到，是完全融入城市生态的野生鸟类。"
      }
    },
  { id: 4, name: "黑枕黄鹂", englishName: "Black-naped Oriole", latinName: "Oriolus chinensis", category: "林鸟", rarity: "常见", location: "高大乔木", funFact: "叫声极其婉转。" },
  { id: 5, name: "白领翡翠", englishName: "Collared Kingfisher", latinName: "Todiramphus chloris", category: "水鸟", rarity: "常见", location: "红树林", funFact: "脾气火爆的捕鱼高手。" },
  { id: 6, name: "苍鹭", englishName: "Grey Heron", latinName: "Ardea cinerea", category: "水鸟", rarity: "常见", location: "水库边缘", funFact: "捕鱼时稳如泰山。" },
  { id: 7, name: "小白鹭", englishName: "Little Egret", latinName: "Egretta garzetta", category: "水鸟", rarity: "常见", location: "浅水区", funFact: "繁殖期饰羽优雅。" },
  { id: 8, name: "红原鸡", englishName: "Red Junglefowl", latinName: "Gallus gallus", category: "林鸟", rarity: "罕见", location: "林下", funFact: "家鸡的纯正野生祖先。" },
  { id: 9, name: "普通喜鹊", englishName: "Eurasian magpie", latinName: "Pica pica", category: "城市鸟", rarity: "常见", location: "小区树木", funFact: "唯一能通过镜子测试的鸟类。" },
  { id: 10, name: "乌鸫", englishName: "Common Blackbird", latinName: "Turdus merula", category: "城市鸟", rarity: "常见", location: "绿地", funFact: "雄鸟全身黑，嘴鲜黄。" },
  { id: 11, name: "白鹡鸰", englishName: "White Wagtail", latinName: "Motacilla alba", category: "城市鸟", rarity: "常见", location: "广场水边", funFact: "尾巴不停上下摆动。" },
  { id: 12, name: "普通翠鸟", englishName: "Common Kingfisher", latinName: "Alcedo atthis", category: "水鸟", rarity: "罕见", location: "溪流", funFact: "背部闪耀蓝宝石光泽。" },
  { id: 13, name: "戴胜", englishName: "Eurasian Hoopoe", latinName: "Upupa epops", category: "林鸟", rarity: "罕见", location: "开阔草地", funFact: "头顶有扇形羽冠。" },
  { id: 14, name: "绿头鸭", englishName: "Mallard", latinName: "Anas platyrhynchos", category: "水鸟", rarity: "极度常见", location: "人工湖", funFact: "雄性头部金属绿色。" },
  { id: 15, name: "夜鹭", englishName: "Black-crowned Night Heron", latinName: "Nycticorax nycticorax", category: "水鸟", rarity: "常见", location: "河边树冠", funFact: "红眼睛的夜行者。" },
  { id: 16, name: "大山雀", englishName: "Great Tit", latinName: "Parus major", category: "林鸟", rarity: "常见", location: "公园", funFact: "胸前有黑领带。" },
  { id: 17, name: "画眉", englishName: "Chinese Hwamei", latinName: "Garrulax canorus", category: "林鸟", rarity: "罕见", location: "灌木丛", funFact: "眼周有白色延伸纹。" },
  { id: 18, name: "鸳鸯", englishName: "Mandarin Duck", latinName: "Aix galericulata", category: "水鸟", rarity: "稀有", location: "林间池塘", funFact: "羽色绚丽。" },
  { id: 19, name: "丹顶鹤", englishName: "Red-crowned Crane", latinName: "Grus japonensis", category: "水鸟", rarity: "稀有", location: "湿地", funFact: "象征长寿。" },
  { id: 20, name: "红腹锦鸡", englishName: "Golden Pheasant", latinName: "Chrysolophus pictus", category: "林鸟", rarity: "稀有", location: "山区", funFact: "金黄羽冠。" },
  { id: 21, name: "黑天鹅", englishName: "Black Swan", latinName: "Cygnus atratus", category: "水鸟", rarity: "常见", location: "湖泊", funFact: "飞行可见白色飞羽。" },
  { id: 22, name: "游隼", englishName: "Peregrine Falcon", latinName: "Falco peregrinus", category: "猛禽", rarity: "稀有", location: "高处", funFact: "俯冲之王。" },
  { id: 23, name: "红嘴鸥", englishName: "Black-headed Gull", latinName: "Chroicocephalus ridibundus", category: "水鸟", rarity: "常见", location: "沿海", funFact: "冬候鸟。" },
  { id: 24, name: "家燕", englishName: "Barn Swallow", latinName: "Hirundo rustica", category: "城市鸟", rarity: "常见", location: "屋檐", funFact: "剪刀尾。" },
  { id: 25, name: "黄腹花蜜鸟", englishName: "Olive-backed Sunbird", latinName: "Cinnyris jugularis", category: "林鸟", rarity: "常见", location: "花园", funFact: "悬停吸蜜。" },
  { id: 26, name: "冠斑犀鸟", englishName: "Oriental Pied Hornbill", latinName: "Anthracoceros albirostris", category: "林鸟", rarity: "罕见", location: "热带林", funFact: "巨型盔突。" },
  { id: 27, name: "太平鸟", englishName: "Bohemian Waxwing", latinName: "Bombycilla garrulus", category: "林鸟", rarity: "稀有", location: "果园", funFact: "红蜡质翅尖。" },
  { id: 28, name: "领雀嘴鹎", englishName: "Collared Finchbill", latinName: "Spizixos semitorques", category: "林鸟", rarity: "常见", location: "灌木丛", funFact: "象牙色厚嘴。" },
  { id: 29, name: "灰喜鹊", englishName: "Azure-winged Magpie", latinName: "Cyanopica cyanus", category: "城市鸟", rarity: "常见", location: "松林", funFact: "天蓝色长尾。" },
  { id: 30, name: "红头长尾山雀", englishName: "Black-throat Bushtit", latinName: "Aegithalos concinnus", category: "林鸟", rarity: "常见", location: "林间", funFact: "小肥啾。" }
];

export interface BirdRecord {
  firstDate: string;
  firstLocation: string;
  photos: string[];
}

interface BirdStore {
  unlockedIds: number[];
  customBirds: any[];
  birdRecords: Record<string, BirdRecord>;
  unlockBird: (aiResultName: string, aiResultData: any) => void;
}

export const useBirdStore = create<BirdStore>()(
  persist(
    (set, get) => ({
      unlockedIds: [],
      customBirds: [],
      birdRecords: {},
      unlockBird: (aiResultName, aiResultData) => {
        const state = get();
        
        const newRecords = { ...state.birdRecords };
        if (!newRecords[aiResultName]) {
          newRecords[aiResultName] = {
            firstDate: new Date().toLocaleDateString('zh-CN'),
            firstLocation: aiResultData.location || "探索中发现",
            photos: []
          };
        }
        if (aiResultData.imageUrl && !newRecords[aiResultName].photos.includes(aiResultData.imageUrl)) {
          newRecords[aiResultName].photos.push(aiResultData.imageUrl);
        }

        const baseBirdIndex = baseBirds.findIndex(b => b.name === aiResultName);
        if (baseBirdIndex !== -1) {
          const birdId = baseBirds[baseBirdIndex].id;
          if (!state.unlockedIds.includes(birdId)) {
            set({ unlockedIds: [...state.unlockedIds, birdId], birdRecords: newRecords });
          } else {
            set({ birdRecords: newRecords });
          }
        } else {
          const exists = state.customBirds.find(b => b.name === aiResultName);
          if (!exists) {
            set({ customBirds: [...state.customBirds, { id: Date.now(), ...aiResultData, name: aiResultName }], birdRecords: newRecords });
          } else {
            set({ birdRecords: newRecords });
          }
        }
      }
    }),
    { name: 'birdvibe-pokedex' }
  )
);

// ==========================================
// 🌟 智能图片渲染组件
// ==========================================
function BirdImage({ name, englishName, latinName, isUnlocked }: { name?: string, englishName?: string; latinName?: string; isUnlocked: boolean }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchBirdImage = async () => {
      const queries = [name, englishName, latinName];
      for (const query of queries) {
        if (!query) continue;
        try {
          const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
          const data = await response.json();
          if (data.thumbnail?.source) {
            if (active) setImgSrc(data.thumbnail.source);
            return;
          }
        } catch (e) { continue; }
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

  return (
    <img 
      src={imgSrc} 
      className={`w-full h-full object-cover transition-all duration-700 ${!isUnlocked ? 'brightness-[0.7] saturate-[0.5] contrast-[0.8]' : 'saturate-[1.1]'}`} 
      alt={name || "鸟类图片"}
    />
  );
}

// ==========================================
// 🌟 主页面组件 (默认导出App)
// ==========================================
export default function App() {
  const [activeCategory, setActiveCategory] = useState("全部");
  const [flippedId, setFlippedId] = useState<number | null>(null); 
  // 🌟 新增状态：控制详情弹窗显示哪只鸟
  const [detailBird, setDetailBird] = useState<any | null>(null);
  
  const unlockedIds = useBirdStore((state) => state.unlockedIds);
  const customBirds = useBirdStore((state) => state.customBirds);
  const birdRecords = useBirdStore((state) => state.birdRecords);
  
  const allBirds = [...baseBirds, ...customBirds];
  const filteredBirds = allBirds.filter((b) => activeCategory === "全部" || b.category === activeCategory);

  const handleCardClick = (id: number, isUnlocked: boolean) => {
    if (!isUnlocked) return; 
    setFlippedId(flippedId === id ? null : id);
  };

  return (
    <main className="min-h-screen bg-zinc-50 p-6 md:p-10 font-sans relative">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-4xl font-black text-emerald-950">📖 好朋友通讯录</h1>
        
        <div className="flex flex-wrap gap-2">
          {["全部", "林鸟", "水鸟", "猛禽", "城市鸟"].map((c) => (
            <button 
              key={c} 
              onClick={() => setActiveCategory(c)} 
              className={`px-4 py-2 rounded-full font-bold text-xs border-2 transition-all ${activeCategory === c ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-emerald-700 border-emerald-100"}`}
            >
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
                  className={`w-full h-full transition-all duration-700 [transform-style:preserve-3d] ${isUnlocked ? 'cursor-pointer hover:shadow-xl' : ''} ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
                  onClick={() => handleCardClick(bird.id, isUnlocked)}
                >
                  
                  {/* ================= 正面 (图鉴) ================= */}
                  <div className="absolute inset-0 [backface-visibility:hidden] bg-white p-5 rounded-3xl border-2 border-zinc-100 shadow-sm flex flex-col">
                    <div className="h-40 w-full rounded-2xl overflow-hidden relative mb-4 bg-zinc-100 flex-shrink-0">
                      <BirdImage name={bird.name} englishName={bird.englishName} latinName={bird.latinName} isUnlocked={isUnlocked} />
                      {!isUnlocked && <div className="absolute inset-0 bg-black/5 flex items-center justify-center"><Lock className="w-8 h-8 text-white/90 drop-shadow" /></div>}
                      
                      {isUnlocked && (
                        <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm text-white p-1.5 rounded-full">
                           <RotateCcw className="w-3.5 h-3.5" />
                        </div>
                      )}
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
                          <button onClick={(e) => { e.stopPropagation(); window.location.href = '/recognize'; }} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-1">
                            <Bird className="w-3 h-3" /> 前往记录邂逅
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ================= 背面 (专属日记与相册) ================= */}
                  <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-gradient-to-br from-emerald-950 via-emerald-900 to-lime-950 p-5 rounded-3xl border-2 border-lime-800 shadow-2xl flex flex-col text-lime-50 overflow-hidden">
                    
                    <div className="flex justify-between items-start mb-3 flex-shrink-0">
                      <div>
                        <h3 className="text-2xl font-black text-lime-100">{bird.name}</h3>
                        <p className="text-[10px] font-medium text-emerald-300/80 italic mt-0.5">{bird.latinName}</p>
                      </div>
                      <button className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                        <RotateCcw className="w-4 h-4 text-lime-200" />
                      </button>
                    </div>

                    <div className="space-y-1.5 mb-3 flex-shrink-0">
                      <div className="bg-black/30 backdrop-blur-sm border border-emerald-500/30 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" /> 首次相遇：{myRecord?.firstDate || "未记录"}
                      </div>
                      <div className="bg-black/30 backdrop-blur-sm border border-lime-500/30 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-lime-400" /> 发现地：{myRecord?.firstLocation || "神秘的自然角落"}
                      </div>
                    </div>

                    {/* 用户照片集容器 */}
                    <div className="flex-1 flex flex-col min-h-0 bg-black/20 rounded-2xl p-2.5 border border-white/5">
                      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
                        <Camera className="w-3.5 h-3.5 text-lime-400" />
                        <span className="text-[9px] font-black tracking-widest text-lime-400 uppercase">我的实拍相册</span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar-dark pr-1">
                        {myRecord?.photos && myRecord.photos.length > 0 ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            {myRecord.photos.map((url, idx) => (
                              <img 
                                key={idx} 
                                src={url} 
                                alt="My shot" 
                                className="w-full h-16 object-cover rounded-xl border border-white/10 shadow-sm"
                                onError={(e) => e.currentTarget.style.display = 'none'} 
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="w-full h-full border-2 border-dashed border-emerald-700/50 rounded-xl flex flex-col items-center justify-center text-emerald-600 space-y-1 py-4">
                            <Camera className="w-5 h-5 opacity-50" />
                            <span className="text-[9px] font-bold">暂无实拍照片</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 🌟 新增：了解详情按钮（可爱纸胶带/手账风格） */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); // 关键：防止触发卡片翻面组件
                        setDetailBird(bird);
                      }}
                      className="mt-3 w-full bg-amber-100 hover:bg-amber-200 text-amber-950 text-[11px] font-black py-2 px-3 rounded-xl shadow-md transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-1 border-2 border-dashed border-amber-400/70 rotate-[-0.5deg]"
                    >
                      ✨ 翻看详细笔记
                    </button>

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==========================================
          🌟 新增：手账风深度科普弹窗 (Detail Modal)
         ========================================== */}
      {detailBird && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          {/* 点击背景关闭 */}
          <div className="absolute inset-0" onClick={() => setDetailBird(null)} />
          
          {/* 弹窗主体：复古暖卡纸色 `#fbf5eb`，加粗深色双边框 */}
          <div className="relative bg-[#fbf5eb] border-4 border-[#e6dcd0] text-[#4a4036] rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 md:p-8 shadow-2xl relative z-10 transform transition-all duration-300 scale-100">
            
            {/* 右上角关闭按钮 */}
            <button 
              onClick={() => setDetailBird(null)}
              className="absolute top-4 right-4 bg-[#e6dcd0]/60 hover:bg-[#e6dcd0] p-2 rounded-full transition-colors text-[#4a4036]"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 顶部：经典手账拍立得风格布局 */}
            <div className="flex flex-col sm:flex-row gap-6 items-center border-b-2 border-dashed border-[#e6dcd0] pb-6 mb-6">
              {/* 拍立得相框 */}
              <div className="w-36 h-36 bg-white p-3 pb-7 shadow-md transform -rotate-2 border border-zinc-200/60 flex-shrink-0 relative">
                <div className="w-full h-full relative overflow-hidden bg-zinc-100 rounded-sm">
                  <BirdImage name={detailBird.name} englishName={detailBird.englishName} latinName={detailBird.latinName} isUnlocked={true} />
                </div>
                <div className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-bold text-zinc-400 tracking-wider">NATURAL NOTE</div>
              </div>

              {/* 鸟类基本名称 */}
              <div className="text-center sm:text-left space-y-1">
                <h2 className="text-3xl font-black text-[#2c221a] flex items-center justify-center sm:justify-start gap-2">
                  {detailBird.name}
                </h2>
                <p className="text-sm font-bold text-emerald-700">{detailBird.englishName}</p>
                <p className="text-xs italic text-emerald-600/70 font-semibold">{detailBird.latinName}</p>
                
                <div className="flex flex-wrap gap-1.5 mt-3 justify-center sm:justify-start">
                  <span className="bg-emerald-100/80 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200/40">🌿 {detailBird.category}</span>
                  <span className="bg-amber-100/80 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200/40">💎 {detailBird.rarity}</span>
                </div>
              </div>
            </div>

            {/* 中间核心内容板块：具备智能动态兜底模板 */}
            <div className="space-y-5 leading-relaxed text-sm font-medium">
              
              <div className="bg-white/60 p-4 rounded-2xl border border-[#e6dcd0]/80 shadow-sm">
                <h4 className="font-black text-base text-[#2c221a] mb-2 flex items-center gap-1.5">🔍 外貌特征</h4>
                <p className="text-[#5c5044] text-[13px]">
                  {detailBird.details?.appearance || `${detailBird.name}的羽色和体态独特，拥有极具辨识度的外形特征。通常拥有符合其生活习性的体型与特化喙部结构。`}
                </p>
              </div>

              <div className="bg-white/60 p-4 rounded-2xl border border-[#e6dcd0]/80 shadow-sm">
                <h4 className="font-black text-base text-[#2c221a] mb-2 flex items-center gap-1.5">🏡 生活习性</h4>
                <p className="text-[#5c5044] text-[13px]">
                  {detailBird.details?.habitatAndHabits || `主要在${detailBird.location || "特定生态区域"}活动。主要以植物种子、果实或季节性昆虫为食，生性或机警或亲人，筑巢与繁殖极具规律性。`}
                </p>
              </div>

              <div className="bg-white/60 p-4 rounded-2xl border border-[#e6dcd0]/80 shadow-sm">
                <h4 className="font-black text-base text-[#2c221a] mb-2 flex items-center gap-1.5">🎵 鸣叫特点</h4>
                <p className="text-[#5c5044] text-[13px]">
                  {detailBird.details?.callCharacteristics || `鸣声或婉转悠长，或清脆短促，多用于宣示领地或同伴联络，常作为野外或城市环境中辨识该物种的重要音符。`}
                </p>
              </div>

              <div className="bg-white/60 p-4 rounded-2xl border border-[#e6dcd0]/80 shadow-sm">
                <h4 className="font-black text-base text-[#2c221a] mb-2 flex items-center gap-1.5">🗺️ 分布区域</h4>
                <p className="text-[#5c5044] text-[13px]">
                  {detailBird.details?.distribution || `广泛分布于适宜其生存的特定海拔或气候带中，在城市公园、开阔林区或湿地保护区常能观测到其稳定种群。`}
                </p>
              </div>

            </div>

            {/* 底部装饰线 */}
            <div className="mt-6 pt-4 border-t border-dashed border-[#e6dcd0] text-center text-[10px] text-amber-800/40 font-bold tracking-widest">
              —— 🍃 BIRD VIBE NATURE JOURNAL 🍃 ——
            </div>

          </div>
        </div>
      )}
    </main>
  );
}