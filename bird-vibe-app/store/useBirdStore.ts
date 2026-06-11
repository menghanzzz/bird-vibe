import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const baseBirds = [
  { id: 1, name: "树麻雀", englishName: "Eurasian Tree Sparrow", latinName: "Passer montanus", category: "城市鸟", rarity: "极度常见", location: "街头巷尾", funFact: "脸颊上有明显的黑斑。" },
  { id: 2, name: "爪哇八哥", englishName: "Javan Myna", latinName: "Acridotheres javanicus", category: "城市鸟", rarity: "极度常见", location: "小贩中心", funFact: "极度聪明，擅长模仿。" },
  { id: 3, name: "珠颈斑鸠", englishName: "Spotted Dove", latinName: "Spilopelia chinensis", category: "城市鸟", rarity: "常见", location: "公园", funFact: "后颈有黑底白点的珍珠项链。" },
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
  { id: 30, name: "红头长尾山雀", englishName: "Black-throated Bushtit", latinName: "Aegithalos concinnus", category: "林鸟", rarity: "常见", location: "林间", funFact: "小肥啾。" }
];

export interface BirdRecord {
  firstDate: string;
  firstLocation: string;
  lat?: number; // 🌟 新增：精确纬度
  lng?: number; // 🌟 新增：精确经度
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
        
        // --- 1. 记录个人照片与地点 ---
        const newRecords = { ...state.birdRecords };
        if (!newRecords[aiResultName]) {
          newRecords[aiResultName] = {
            firstDate: new Date().toLocaleDateString('zh-CN'),
            firstLocation: aiResultData.location || "探索中发现",
            lat: aiResultData.lat, // 🌟 存入纬度
            lng: aiResultData.lng, // 🌟 存入经度
            photos: []
          };
        }
        
        if (aiResultData.imageUrl && !newRecords[aiResultName].photos.includes(aiResultData.imageUrl)) {
          newRecords[aiResultName].photos.push(aiResultData.imageUrl);
        }

        // --- 2. 正常解锁逻辑 ---
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