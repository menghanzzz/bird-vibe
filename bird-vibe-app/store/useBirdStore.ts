import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const baseBirds = [
  {
    id: 1, name: "树麻雀", englishName: "Eurasian Tree Sparrow", latinName: "Passer montanus",
    category: "城市鸟", rarity: "极度常见", location: "街头巷尾", funFact: "脸颊上有明显的黑斑。"
  },
  {
    id: 2, name: "爪哇八哥", englishName: "Javan Myna", latinName: "Acridotheres javanicus",
    category: "城市鸟", rarity: "极度常见", location: "小贩中心", funFact: "极度聪明，擅长模仿。"
  },
  {
    id: 3, name: "珠颈斑鸠", englishName: "Spotted Dove", latinName: "Spilopelia chinensis",
    category: "城市鸟", rarity: "常见", location: "公园", funFact: "后颈有黑底白点的珍珠项链。"
  },
  {
    id: 4, name: "黑枕黄鹂", englishName: "Black-naped Oriole", latinName: "Oriolus chinensis",
    category: "林鸟", rarity: "常见", location: "高大乔木", funFact: "叫声极其婉转悦耳。"
  },
  {
    id: 5, name: "白领翡翠", englishName: "Collared Kingfisher", latinName: "Todiramphus chloris",
    category: "水鸟", rarity: "常见", location: "红树林", funFact: "脾气火爆的捕鱼高手。"
  },
  {
    id: 6, name: "苍鹭", englishName: "Grey Heron", latinName: "Ardea cinerea",
    category: "水鸟", rarity: "常见", location: "水库边缘", funFact: "捕鱼时可以一动不动站立数小时。"
  },
  {
    id: 7, name: "小白鹭", englishName: "Little Egret", latinName: "Egretta garzetta",
    category: "水鸟", rarity: "常见", location: "浅水区", funFact: "繁殖期头部会长出两根细长的装饰羽。"
  },
  {
    id: 8, name: "红原鸡", englishName: "Red Junglefowl", latinName: "Gallus gallus",
    category: "林鸟", rarity: "罕见", location: "林下", funFact: "现代家鸡的纯正野生祖先。"
  },
  {
    id: 9, name: "普通喜鹊", englishName: "Eurasian Magpie", latinName: "Pica pica",
    category: "城市鸟", rarity: "常见", location: "小区树木", funFact: "唯一能通过镜子自我认知测试的鸟类。"
  },
  {
    id: 10, name: "乌鸫", englishName: "Common Blackbird", latinName: "Turdus merula",
    category: "城市鸟", rarity: "常见", location: "绿地", funFact: "雄鸟全身纯黑，喙和眼圈鲜黄色，极具辨识度。"
  },
  {
    id: 11, name: "白鹡鸰", englishName: "White Wagtail", latinName: "Motacilla alba",
    category: "城市鸟", rarity: "常见", location: "广场水边", funFact: "尾巴会不停地上下摆动，像在点头。"
  },
  {
    id: 12, name: "普通翠鸟", englishName: "Common Kingfisher", latinName: "Alcedo atthis",
    category: "水鸟", rarity: "罕见", location: "溪流", funFact: "背部蓝色在阳光下会闪耀蓝宝石般的光芒。"
  },
  {
    id: 13, name: "戴胜", englishName: "Eurasian Hoopoe", latinName: "Upupa epops",
    category: "林鸟", rarity: "罕见", location: "开阔草地", funFact: "头顶的扇形羽冠是它最标志性的特征。"
  },
  {
    id: 14, name: "绿头鸭", englishName: "Mallard", latinName: "Anas platyrhynchos",
    category: "水鸟", rarity: "极度常见", location: "人工湖", funFact: "雄鸟头部在阳光下会呈现金属绿色光泽。"
  },
  {
    id: 15, name: "夜鹭", englishName: "Black-crowned Night Heron", latinName: "Nycticorax nycticorax",
    category: "水鸟", rarity: "常见", location: "河边树冠", funFact: "红色的眼睛是其夜行性生活的重要适应。"
  },
  {
    id: 16, name: "大山雀", englishName: "Great Tit", latinName: "Parus major",
    category: "林鸟", rarity: "常见", location: "公园", funFact: "胸前有一条显眼的黑色纵纹，像打了领带。"
  },
  {
    id: 17, name: "画眉", englishName: "Chinese Hwamei", latinName: "Garrulax canorus",
    category: "林鸟", rarity: "罕见", location: "灌木丛", funFact: "眼周有白色延伸纹，像画了眉毛，名字由此而来。"
  },
  {
    id: 18, name: "鸳鸯", englishName: "Mandarin Duck", latinName: "Aix galericulata",
    category: "水鸟", rarity: "稀有", location: "林间池塘", funFact: "被誉为世界上最美丽的鸭子。"
  },
  {
    id: 19, name: "丹顶鹤", englishName: "Red-crowned Crane", latinName: "Grus japonensis",
    category: "水鸟", rarity: "稀有", location: "湿地", funFact: "头顶红色裸皮是其名字的由来，象征长寿与吉祥。"
  },
  {
    id: 20, name: "红腹锦鸡", englishName: "Golden Pheasant", latinName: "Chrysolophus pictus",
    category: "林鸟", rarity: "稀有", location: "山区", funFact: "被称为中国最美丽的鸟类之一。"
  },
  {
    id: 21, name: "黑天鹅", englishName: "Black Swan", latinName: "Cygnus atratus",
    category: "水鸟", rarity: "常见", location: "湖泊", funFact: "飞行时会露出白色的飞羽，与黑色身体形成强烈对比。"
  },
  {
    id: 22, name: "游隼", englishName: "Peregrine Falcon", latinName: "Falco peregrinus",
    category: "猛禽", rarity: "稀有", location: "高处", funFact: "俯冲速度可超过320公里/时，是地球上速度最快的动物。"
  },
  {
    id: 23, name: "红嘴鸥", englishName: "Black-headed Gull", latinName: "Chroicocephalus ridibundus",
    category: "水鸟", rarity: "常见", location: "沿海", funFact: "繁殖期头部变为深褐色，非繁殖期头部变为白色。"
  },
  {
    id: 24, name: "家燕", englishName: "Barn Swallow", latinName: "Hirundo rustica",
    category: "城市鸟", rarity: "常见", location: "屋檐", funFact: "剪刀形的尾羽是识别家燕的标志性特征。"
  },
  {
    id: 25, name: "黄腹花蜜鸟", englishName: "Olive-backed Sunbird", latinName: "Cinnyris jugularis",
    category: "林鸟", rarity: "常见", location: "花园", funFact: "能像蜂鸟一样悬停在花前吸取花蜜。"
  },
  {
    id: 26, name: "冠斑犀鸟", englishName: "Oriental Pied Hornbill", latinName: "Anthracoceros albirostris",
    category: "林鸟", rarity: "罕见", location: "热带林", funFact: "雄鸟会用泥土将雌鸟封在树洞中孵卵，只留一条缝喂食。"
  },
  {
    id: 27, name: "太平鸟", englishName: "Bohemian Waxwing", latinName: "Bombycilla garrulus",
    category: "林鸟", rarity: "稀有", location: "果园", funFact: "翅膀上有红色蜡质翅尖，像用蜡烛点过一样。"
  },
  {
    id: 28, name: "领雀嘴鹎", englishName: "Collared Finchbill", latinName: "Spizixos semitorques",
    category: "林鸟", rarity: "常见", location: "灌木丛", funFact: "象牙白色的粗短厚喙是其最显眼的特征。"
  },
  {
    id: 29, name: "灰喜鹊", englishName: "Azure-winged Magpie", latinName: "Cyanopica cyanus",
    category: "城市鸟", rarity: "常见", location: "松林", funFact: "天蓝色的翅膀和长尾是其最美丽的特征。"
  },
  {
    id: 30, name: "红头长尾山雀", englishName: "Black-throated Bushtit", latinName: "Aegithalos concinnus",
    category: "林鸟", rarity: "常见", location: "林间", funFact: "体型极小，是中国最小的鸟类之一，常被亲切称为「小肥啾」。"
  },
  {
    id: 31, name: "白头鹎", englishName: "Light-vented Bulbul", latinName: "Pycnonotus sinensis",
    category: "城市鸟", rarity: "常见", location: "公园灌丛", funFact: "头顶有一撮醒目的白色羽毛，像戴了一顶小白帽。"
  },
  {
    id: 32, name: "鹊鸲", englishName: "Oriental Magpie-Robin", latinName: "Copsychus saularis",
    category: "城市鸟", rarity: "常见", location: "花园草地", funFact: "雄鸟黑白配色像极了小号的喜鹊，但体型只有麻雀大小。"
  },
  {
    id: 33, name: "池鹭", englishName: "Chinese Pond Heron", latinName: "Ardeola bacchus",
    category: "水鸟", rarity: "常见", location: "池塘稻田", funFact: "繁殖期羽毛会变成漂亮的红褐色，非繁殖期则是朴素的灰褐色。"
  },
  {
    id: 34, name: "黑领椋鸟", englishName: "Black-collared Starling", latinName: "Gracupica nigricollis",
    category: "城市鸟", rarity: "常见", location: "开阔草地", funFact: "眼睛周围有一圈明显的黄色裸皮，像戴了黄色眼镜。"
  },
  {
    id: 35, name: "棕背伯劳", englishName: "Long-tailed Shrike", latinName: "Lanius schach",
    category: "猛禽", rarity: "常见", location: "灌丛枝头", funFact: "会把猎物挂在荆棘上，像经营一家「肉铺」，因此被称为「屠夫鸟」。"
  },
  {
    id: 36, name: "黄鹡鸰", englishName: "Eastern Yellow Wagtail", latinName: "Motacilla tschutschensis",
    category: "水鸟", rarity: "常见", location: "湿地水边", funFact: "尾巴上下摆动的频率比白鹡鸰更快，像在打拍子。"
  },
  {
    id: 37, name: "斑文鸟", englishName: "Scaly-breasted Munia", latinName: "Lonchura punctulata",
    category: "城市鸟", rarity: "常见", location: "草地灌丛", funFact: "胸腹部有独特的鳞片状斑纹，像穿了一件鳞甲。"
  },
  {
    id: 38, name: "白胸翡翠", englishName: "White-throated Kingfisher", latinName: "Halcyon smyrnensis",
    category: "水鸟", rarity: "常见", location: "河岸枝头", funFact: "虽然名字带「翡翠」，但羽毛主要是棕红色，只有翅膀和背部是蓝色。"
  },
  {
    id: 39, name: "黑卷尾", englishName: "Black Drongo", latinName: "Dicrurus macrocercus",
    category: "城市鸟", rarity: "常见", location: "开阔枝头", funFact: "尾巴末端像鱼叉一样深深分叉，飞行时像一把黑色的剪刀。"
  },
  {
    id: 40, name: "红耳鹎", englishName: "Red-whiskered Bulbul", latinName: "Pycnonotus jocosus",
    category: "城市鸟", rarity: "极度常见", location: "小区花园", funFact: "眼睛后方有一块醒目的红色斑块，像贴了一块红色「耳贴」。"
  }
];

export interface BirdRecord {
  firstDate: string;
  firstLocation: string;
  lat?: number;
  lng?: number;
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
            lat: aiResultData.lat,
            lng: aiResultData.lng,
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