import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const baseBirds = [
  {
    id: 1, name: "树麻雀", englishName: "Eurasian Tree Sparrow", latinName: "Passer montanus",
    category: "城市鸟", rarity: "极度常见", location: "街头巷尾", funFact: "脸颊上有明显的黑斑。",
    details: {
      appearance: "体长约14厘米，体型圆润娇小。头顶栗褐色，最显著的特征是纯白色脸颊上各有一块清晰的黑色圆斑，如同贴了贴纸。背部褐色带黑色纵纹，腹部污白色。雌雄羽色相似，是少数雌雄难以区分的雀类之一。",
      habitatAndHabits: "与人类共生的典型城市鸟，几乎不在远离建筑的地方生活。地面移动时双脚并拢蹦跳，不会单脚交替走路。喜欢成群在草丛或灌木中叽喳，会在干燥沙土上进行沙浴以去除羽毛寄生虫。杂食性，以草籽、谷物和昆虫为食。",
      callCharacteristics: "叫声短促清脆，为单调的「喳、喳、喳」（tsip-tsip），没有复杂旋律。大群聚集时声音嘈杂密集，繁殖期雄鸟会发出更为连续的鸣唱以吸引配偶。",
      distribution: "广泛分布于欧亚大陆，是城市、农村最常见的鸟类之一。无论是组屋草地、小贩中心外围、还是校园角落，只要有食物和绿化，随处可见其蹦跳身影。"
    }
  },
  {
    id: 2, name: "爪哇八哥", englishName: "Javan Myna", latinName: "Acridotheres javanicus",
    category: "城市鸟", rarity: "极度常见", location: "小贩中心", funFact: "极度聪明，擅长模仿。",
    details: {
      appearance: "体长约24厘米，全身深黑色或暗灰色，额头有一小撮竖起的朋克式羽冠。最醒目的是鲜黄色的喙和双腿。飞行时翅膀基部闪现两块白色斑块，是重要的飞行辨识特征。眼周有黄色裸皮。",
      habitatAndHabits: "性格极其大胆自信，是小贩中心和露天餐厅的常客。地面行走时大摇大摆迈步，不像麻雀那样蹦跳。智商极高，会跟随除草机捡食被惊飞的昆虫。傍晚大群聚集夜栖树，场面壮观。杂食性，食谱极广。",
      callCharacteristics: "大嗓门，叫声粗厉沙哑且变化多端。作为椋鸟科成员，擅长模仿环境中的各种声音，包括口哨声、其他鸟类叫声甚至人类说话声。",
      distribution: "原产印尼爪哇岛，引入后凭借超强适应力成为本地最强势的鸟种之一，在东南亚各大城市数量庞大，被列为入侵物种。"
    }
  },
  {
    id: 3, name: "珠颈斑鸠", englishName: "Spotted Dove", latinName: "Spilopelia chinensis",
    category: "城市鸟", rarity: "常见", location: "公园", funFact: "后颈有黑底白点的珍珠项链。",
    details: {
      appearance: "体长约30厘米，体态优雅。整体柔和的灰褐色，胸腹部带温柔粉红色调。后颈有大块黑色羽区密布白色圆点，宛如华丽珍珠项链，「珠颈」之名由此而来。尾羽较长，飞行时外侧尾羽白色明显。",
      habitatAndHabits: "性格温和胆小，常成对出现。喜欢在开阔草地或小径上啄食掉落的种子。走路时头部有节奏地前后点动。受惊起飞时翅膀用力拍打空气，发出明显扑扑声。以植物种子为主食，偶尔也吃小型无脊椎动物。",
      callCharacteristics: "叫声低沉缓慢，节奏感极强，为「咕——咕——咕」或「咕咕——咕」，是城市里最具催眠效果的背景声之一，慵懒午后最常听到。",
      distribution: "广泛分布于南亚和东南亚热带亚热带地区。公园、小区绿化带、自然保护区边缘均可见到，已完全融入城市生态系统。"
    }
  },
  {
    id: 4, name: "黑枕黄鹂", englishName: "Black-naped Oriole", latinName: "Oriolus chinensis",
    category: "林鸟", rarity: "常见", location: "高大乔木", funFact: "叫声极其婉转悦耳。",
    details: {
      appearance: "体长约26厘米，雄鸟全身亮丽金黄色，从眼后延伸至枕部有一条宽阔黑带，「黑枕」之名由此而来。翅膀和尾羽黑色，与金黄色身体对比强烈。雌鸟颜色略偏黄绿，对比不如雄鸟鲜明。喙为玫瑰粉红色。",
      habitatAndHabits: "偏好高大乔木的树冠层活动，很少下到地面。行动敏捷，常在树叶间跳跃觅食。以果实、花蜜和昆虫为食。候鸟习性，部分个体在本地全年可见，部分个体随季节迁徙。",
      callCharacteristics: "鸣声是本地最婉转悦耳的鸟叫之一，为响亮流畅的口哨式「咿哦——」或「咿咿哦」，在树冠间远远就能听到，令人心旷神怡。",
      distribution: "分布于东亚至东南亚的热带亚热带地区。常见于城市公园、植物园及郊区有高大乔木的地带，在本地属全年可见的常见留鸟。"
    }
  },
  {
    id: 5, name: "白领翡翠", englishName: "Collared Kingfisher", latinName: "Todiramphus chloris",
    category: "水鸟", rarity: "常见", location: "红树林", funFact: "脾气火爆的捕鱼高手。",
    details: {
      appearance: "体长约24厘米，背部、翅膀和尾羽为鲜艳的翠蓝绿色，腹部洁白，颈部有白色领环，「白领」之名由此而来。头顶蓝绿色，过眼纹黑色。喙粗长而有力，黑色，是捕猎的利器。",
      habitatAndHabits: "领地意识极强，性格凶悍，会主动驱逐进入领地的其他鸟类。常静止栖于突出枝头或电线上俯视水面，发现猎物后俯冲捕捉。食物多样，包括鱼类、蟹、蜥蜴和昆虫，并非只吃鱼。",
      callCharacteristics: "叫声响亮刺耳，为连续急促的「kek-kek-kek-kek」，具有强烈的宣示领地意味。声音远比外形凶悍，常在清晨率先打破宁静。",
      distribution: "广泛分布于南亚、东南亚至太平洋岛屿。本地在红树林、海岸、河岸及城市绿地均十分常见，是最容易观察到的翠鸟科成员。"
    }
  },
  {
    id: 6, name: "苍鹭", englishName: "Grey Heron", latinName: "Ardea cinerea",
    category: "水鸟", rarity: "常见", location: "水库边缘", funFact: "捕鱼时可以一动不动站立数小时。",
    details: {
      appearance: "体长约90厘米，是本地最大的涉禽之一。整体灰白色，头顶和颈侧有黑色纹路，繁殖期枕部有黑色冠羽。颈部细长呈S形弯曲，飞行时缩颈，腿部向后伸直。喙长而尖，黄色，是捕鱼的利器。",
      habitatAndHabits: "极其耐心的猎手，常在浅水区一动不动伫立等待，发现鱼类后以闪电般速度刺出长喙捕获。领地意识强，通常独自觅食。以鱼类为主食，也吃蛙类、蛇和小型哺乳动物。",
      callCharacteristics: "平时沉默寡言，受惊飞走时发出低沉粗哑的「呱——」声。繁殖期在鸟巢附近会发出各种嘈杂叫声。",
      distribution: "广泛分布于欧亚非大陆。本地常见于水库、河流、鱼塘和湿地边缘，城市公园的大型水体也时有出没。"
    }
  },
  {
    id: 7, name: "小白鹭", englishName: "Little Egret", latinName: "Egretta garzetta",
    category: "水鸟", rarity: "常见", location: "浅水区", funFact: "繁殖期头部会长出两根细长的装饰羽。",
    details: {
      appearance: "体长约60厘米，全身雪白，喙黑色细长，腿黑色，脚趾黄色是重要辨识特征。繁殖期头部长出两根飘逸的细长装饰羽，背部和胸部也有蓬松的蓑羽，姿态极为优雅。非繁殖期装饰羽消失。",
      habitatAndHabits: "喜欢在浅水区涉水觅食，常用黄色脚趾搅动水底惊起小鱼虾再迅速捕食。有时会张开翅膀形成阴影遮光，便于看清水中猎物。食物以小鱼、虾、蟹、蛙为主。傍晚常与其他鹭类聚集在树上夜宿。",
      callCharacteristics: "通常安静，受惊时发出短促的「呱」声。繁殖期在巢区附近叫声频繁，发出粗哑的嘎嘎声。",
      distribution: "广泛分布于欧亚非及澳洲。本地在海岸、红树林、河流、鱼塘及稻田均极为常见，是城市水体边最容易观察到的白色鹭鸟。"
    }
  },
  {
    id: 8, name: "红原鸡", englishName: "Red Junglefowl", latinName: "Gallus gallus",
    category: "林鸟", rarity: "罕见", location: "林下", funFact: "现代家鸡的纯正野生祖先。",
    details: {
      appearance: "体长约70厘米，雄鸟华丽壮观，头顶红色肉冠高耸，颈部有金红色披针形长羽，背部深红棕色，尾羽长而弯曲呈镰刀状，闪耀金属绿光泽。雌鸟体型较小，羽色棕褐色有黑色纵纹，与枯叶完美融合。",
      habitatAndHabits: "栖息于热带森林林缘和灌丛，晨昏活动最为频繁，日间多在林下觅食。以种子、果实、昆虫和小型无脊椎动物为食，用脚刨地寻找食物。警觉性极高，发现危险立刻奔入密林。夜间飞上树枝栖息。",
      callCharacteristics: "雄鸟啼鸣声与家鸡极为相似，为响亮的「喔喔喔喔——」，清晨在林缘地带经常可闻，是判断其存在的重要线索。",
      distribution: "原产南亚和东南亚热带森林。本地分布于自然保护区和郊野林地，因栖息地减少和与家鸡杂交，纯种个体已相当稀少。"
    }
  },
  {
    id: 9, name: "普通喜鹊", englishName: "Eurasian Magpie", latinName: "Pica pica",
    category: "城市鸟", rarity: "常见", location: "小区树木", funFact: "唯一能通过镜子自我认知测试的鸟类。",
    details: {
      appearance: "体长约45厘米，黑白色对比鲜明。头、颈、胸和背部为有金属光泽的黑色，腹部和肩部纯白，翅膀带蓝绿色金属光泽。尾羽特别长，约占体长的一半，黑色带绿色金属光泽，飞行时尾羽飘动极为醒目。",
      habitatAndHabits: "高度智慧的鸟类，能制造和使用简单工具，有储藏食物的习惯并能记住藏食地点。杂食性，食物包括昆虫、果实、小型脊椎动物和腐肉。成对或小群活动，会建造有顶盖的大型球形巢。",
      callCharacteristics: "叫声为响亮干脆的「喳喳喳」，声音嘈杂但富有节奏感。受到威胁或发现天敌时会发出急促的警戒叫声提醒同伴。",
      distribution: "广泛分布于欧亚大陆温带地区，已成功适应城市环境。常见于城市公园、小区绿地及郊区农田，在中国北方尤为常见。"
    }
  },
  {
    id: 10, name: "乌鸫", englishName: "Common Blackbird", latinName: "Turdus merula",
    category: "城市鸟", rarity: "常见", location: "绿地", funFact: "雄鸟全身纯黑，喙和眼圈鲜黄色，极具辨识度。",
    details: {
      appearance: "体长约25厘米，雄鸟全身羽毛纯黑色，喙和眼圈为鲜艳的橙黄色，对比强烈，极具辨识度。雌鸟和幼鸟褐色，喉部有纵纹，喙色较暗。雄鸟第一年换为成鸟羽色时喙逐渐变黄。",
      habitatAndHabits: "喜欢在落叶层翻找食物，用喙拨开枯叶寻找蚯蚓和昆虫。善于奔跑，常在草地上小跑几步后突然停下侧头倾听地下蚯蚓的动静。杂食性，果实、浆果、蚯蚓和昆虫均在食谱之列。",
      callCharacteristics: "鸣声是欧洲和亚洲城市中最富旋律感的鸟鸣之一，为流畅悠扬的口哨式歌声，变化丰富，常在清晨和傍晚高声鸣唱。警戒叫声为急促的「tik-tik-tik」。",
      distribution: "广泛分布于欧亚大陆，已高度适应城市生活。城市公园、花园和绿地是其主要栖息地，在中国中部和东部城市十分常见。"
    }
  },
  {
    id: 11, name: "白鹡鸰", englishName: "White Wagtail", latinName: "Motacilla alba",
    category: "城市鸟", rarity: "常见", location: "广场水边", funFact: "尾巴会不停地上下摆动，像在点头。",
    details: {
      appearance: "体长约18厘米，黑白灰三色鲜明。背部灰色，腹部白色，头部和胸部有黑色斑块。有多个亚种，头部黑白图案略有差异。尾羽较长，外侧白色。最大特点是站立或行走时尾羽持续上下摆动。",
      habitatAndHabits: "喜欢在开阔的地面活动，常见于广场、停车场、河岸和草坪。步行时小步快走，尾巴不停上下摆动。以昆虫为主食，常在水边捕食水面的昆虫。候鸟习性，秋冬季节在本地数量增多。",
      callCharacteristics: "飞行时发出清脆的「吱——吱——」双音节叫声，节奏轻快，常边飞边叫。鸣唱声为连续的短促音节组合，音调多变。",
      distribution: "广泛分布于欧亚大陆，是迁徙距离最长的鸣禽之一。在本地为冬候鸟和旅鸟，秋冬季节可在城市广场、河岸和机场草坪见到。"
    }
  },
  {
    id: 12, name: "普通翠鸟", englishName: "Common Kingfisher", latinName: "Alcedo atthis",
    category: "水鸟", rarity: "罕见", location: "溪流", funFact: "背部蓝色在阳光下会闪耀蓝宝石般的光芒。",
    details: {
      appearance: "体长约17厘米，体型娇小但颜色极为华丽。背部和翅膀为鲜艳的钴蓝色，在阳光照射下闪耀宝石般光芒。腹部和脸颊橙栗色，过眼纹蓝色。雄鸟喙全黑，雌鸟下喙基部橙红色。头大、嘴长、尾短。",
      habitatAndHabits: "水质清澈的溪流、河道和鱼塘旁的独行侠。常静止栖于水面上方的枝头，眼神锐利地注视水下，发现小鱼后俯冲入水，成功率极高。领地意识强，会沿固定水域巡逻。以小鱼为主食。",
      callCharacteristics: "飞行时发出尖锐响亮的单音节「唧——」声，声音清脆刺耳，有时候没看到鸟，先听到这声就能判断它正从水面飞过。",
      distribution: "广泛分布于欧亚非。本地为不常见的留鸟，对水质要求较高，主要出现在自然保护区、植物园和郊区清澈水体附近。"
    }
  },
  {
    id: 13, name: "戴胜", englishName: "Eurasian Hoopoe", latinName: "Upupa epops",
    category: "林鸟", rarity: "罕见", location: "开阔草地", funFact: "头顶的扇形羽冠是它最标志性的特征。",
    details: {
      appearance: "体长约28厘米，外形极具辨识度。头顶有一排橙棕色羽冠，平时收拢，激动或降落时展开成美丽的扇形。整体棕橙色，翅膀和尾羽有黑白相间的宽条纹。喙细长向下弯曲，用于探入土中寻找食物。",
      habitatAndHabits: "喜欢在开阔的草地、农田和林缘活动，用长喙插入土中探取昆虫幼虫和蚯蚓。行走时头部前后摆动，类似鸡的步态。繁殖期会在树洞或石缝中筑巢，雌鸟孵卵期间会分泌恶臭液体驱敌。",
      callCharacteristics: "叫声为低沉而有共鸣感的「扑扑扑」三音节，反复重复，在较远处也能清晰听到，是辨识戴胜的重要声音线索。",
      distribution: "广泛分布于欧亚非。本地为不常见的候鸟或迷鸟，出现于开阔草地和高尔夫球场，春秋迁徙季节偶尔可见。"
    }
  },
  {
    id: 14, name: "绿头鸭", englishName: "Mallard", latinName: "Anas platyrhynchos",
    category: "水鸟", rarity: "极度常见", location: "人工湖", funFact: "雄鸟头部在阳光下会呈现金属绿色光泽。",
    details: {
      appearance: "体长约58厘米，是最常见的野鸭。繁殖期雄鸟头颈部金属绿色，颈部有白色颈环，胸部栗褐色，体羽灰色，尾部有向上卷曲的黑色饰羽。雌鸟全身棕褐色具深色斑纹，腹部色浅，是典型的保护色。",
      habitatAndHabits: "高度适应人类环境，城市公园的人工湖是其主要栖息地。杂食性，水草、藻类、昆虫和软体动物均在食谱中，也会接受人类投喂的面包（但面包营养价值低不建议喂）。飞行能力强，迁徙距离远。",
      callCharacteristics: "雌鸟发出响亮的「嘎嘎嘎」声，是最典型的鸭子叫声。雄鸟叫声较轻柔沙哑，为较低的「嘎」声。",
      distribution: "原产北半球，现已引入全球各地并广泛杂交。本地见于城市公园、水库和湿地，是观鸟新手最容易认识的鸭类。"
    }
  },
  {
    id: 15, name: "夜鹭", englishName: "Black-crowned Night Heron", latinName: "Nycticorax nycticorax",
    category: "水鸟", rarity: "常见", location: "河边树冠", funFact: "红色的眼睛是其夜行性生活的重要适应。",
    details: {
      appearance: "体长约60厘米，体型粗壮。成鸟头顶和背部黑色带金属光泽，翅膀和尾部灰色，腹部白色，眼睛鲜红色。繁殖期枕部有2-3根白色细长饰羽。幼鸟褐色有白色斑点，与成鸟差异极大。",
      habitatAndHabits: "典型的夜行性鹭类，白天静止栖于水边树丛中休息，日落后开始活动觅食。以鱼类、蛙类和甲壳动物为主食。常群体栖息，傍晚时分陆续飞出的景象令人印象深刻。",
      callCharacteristics: "飞行时常在夜间发出粗哑响亮的「哇——」叫声，在安静的夜晚可传至很远，是夜间河边最容易听到的鸟声之一。",
      distribution: "广泛分布于全球温带至热带地区，是分布最广的鹭类之一。本地常见于河流、水库和红树林，城市公园水体附近也时有出现。"
    }
  },
  {
    id: 16, name: "大山雀", englishName: "Great Tit", latinName: "Parus major",
    category: "林鸟", rarity: "常见", location: "公园", funFact: "胸前有一条显眼的黑色纵纹，像打了领带。",
    details: {
      appearance: "体长约14厘米，外形活泼。头部和喉部黑色，脸颊白色，背部黄绿色，腹部鲜黄色，胸腹中央有一条明显的黑色纵纹从喉部延伸至腹部。翅膀灰蓝色有白色翅斑。雄鸟胸前黑纹较宽，雌鸟较细。",
      habitatAndHabits: "活泼好动，在树枝间不停跳跃觅食，有时会倒挂在枝头。杂食性，繁殖期以昆虫为主，其余季节也大量取食种子和果实。聪明机警，会利用工具，已有研究记录其能将细棍插入树洞取食昆虫。",
      callCharacteristics: "叫声多样，最典型的是响亮双音节的「似乎、似乎」或「吱——吱」，鸣声清脆多变，是公园中最活跃的歌手之一。",
      distribution: "广泛分布于欧亚大陆，从英国到日本均有分布。本地见于城市公园、植物园和郊区林地，是最常见的山雀科成员。"
    }
  },
  {
    id: 17, name: "画眉", englishName: "Chinese Hwamei", latinName: "Garrulax canorus",
    category: "林鸟", rarity: "罕见", location: "灌木丛", funFact: "眼周有白色延伸纹，像画了眉毛，名字由此而来。",
    details: {
      appearance: "体长约23厘米，整体棕褐色。最显著的特征是眼周有白色眼圈，并向后延伸形成白色眉纹，宛如精心描画的眉毛。背部棕褐色，腹部色较浅，喉部和胸部有黑色细纵纹。喙粗短而弯曲。",
      habitatAndHabits: "性格隐秘，喜欢藏身于浓密的灌木丛和竹林中，不易被发现。以昆虫、果实和种子为食。领地意识强，雄鸟会长时间在固定地点高声鸣唱。因鸣声优美，长期被人类捕捉作为笼鸟，野外数量已受影响。",
      callCharacteristics: "鸣声是中国最负盛名的笼鸟鸣唱之一，声音嘹亮婉转、变化丰富，能连续鸣唱数分钟不重复，有极强的模仿能力。",
      distribution: "原产中国华南至东南亚，已引入多地。本地见于植物园和郊区浓密灌丛，为不常见留鸟，主要由笼鸟逃逸或放生的种群组成。"
    }
  },
  {
    id: 18, name: "鸳鸯", englishName: "Mandarin Duck", latinName: "Aix galericulata",
    category: "水鸟", rarity: "稀有", location: "林间池塘", funFact: "被誉为世界上最美丽的鸭子。",
    details: {
      appearance: "体长约45厘米。雄鸟繁殖羽极为华丽，头部有绿色、紫色和白色冠羽，眼后有白色眉纹，胸部栗紫色，最特别的是翅膀上有一对橙色「帆状」直立羽，是世界上最华丽的鸭类之一。雌鸟灰褐色，眼后有白色眼圈。",
      habitatAndHabits: "偏好有林木遮蔽的溪流和池塘，会在树洞中筑巢。以水生植物、橡实、种子和小型水生动物为食。非繁殖期雄鸟换为暗淡的「蚀羽」，与雌鸟相似。在中国文化中象征爱情忠贞。",
      callCharacteristics: "雄鸟发出尖锐刺耳的「嘶——」声，雌鸟叫声为较低沉的「嘎嘎」声。通常比较安静，不像家鸭那般嘈杂。",
      distribution: "繁殖于东亚，越冬于中国南方、日本和朝鲜半岛。本地为罕见迷鸟或逃逸个体，偶见于植物园和有林木的水体附近。"
    }
  },
  {
    id: 19, name: "丹顶鹤", englishName: "Red-crowned Crane", latinName: "Grus japonensis",
    category: "水鸟", rarity: "稀有", location: "湿地", funFact: "头顶红色裸皮是其名字的由来，象征长寿与吉祥。",
    details: {
      appearance: "体长约150厘米，是世界上最高的鹤类之一。全身洁白，飞行羽黑色，颈侧和喉部黑色，头顶有鲜红色裸皮，极具辨识度。腿黑色细长，喙灰绿色。飞行时颈部伸直，优雅壮观。",
      habitatAndHabits: "栖息于开阔的芦苇湿地、河滩和农田，对栖息地要求较高。杂食性，以鱼类、两栖动物、植物根茎和谷物为食。终身配对，有复杂的求偶舞蹈行为，双双对舞的场景极为壮观。",
      callCharacteristics: "叫声响亮高亢，为嘹亮的「喔——喔——」声，穿透力极强，在空旷湿地中可传至数公里远，有「鹤鸣于九皋，声闻于野」之美誉。",
      distribution: "繁殖于中国东北、俄罗斯远东和日本北海道，越冬于中国长江流域。全球种群数量约3000只，为濒危物种，是中国一级保护动物。"
    }
  },
  {
    id: 20, name: "红腹锦鸡", englishName: "Golden Pheasant", latinName: "Chrysolophus pictus",
    category: "林鸟", rarity: "稀有", location: "山区", funFact: "被称为中国最美丽的鸟类之一。",
    details: {
      appearance: "体长约100厘米（含尾），雄鸟是中国最华丽的鸟类之一。头顶金黄色丝状冠羽，颈部有橙红色扇形斑纹，背部绿色，腰部金黄，腹部鲜红，尾羽极长有黑色斑纹。雌鸟棕褐色有黑色横斑，朴素低调。",
      habitatAndHabits: "栖息于山地密林和灌丛，善于奔跑，飞行能力一般。以植物嫩芽、种子、浆果和昆虫为食，清晨和傍晚觅食。雄鸟在繁殖期展开华丽羽衣围绕雌鸟进行炫耀展示。",
      callCharacteristics: "叫声为尖锐的「嗒——嗒」金属声，或急促的「嗒嗒嗒」，常在发现危险时发出警戒叫声后迅速奔入林中。",
      distribution: "中国特有物种，原产于中国中西部山地森林。已引入英国、美国等地。本地偶见于动物园或逃逸个体，野外极为罕见。"
    }
  },
  {
    id: 21, name: "黑天鹅", englishName: "Black Swan", latinName: "Cygnus atratus",
    category: "水鸟", rarity: "常见", location: "湖泊", funFact: "飞行时会露出白色的飞羽，与黑色身体形成强烈对比。",
    details: {
      appearance: "体长约120厘米，全身羽毛黑色，喙鲜红色，末端有白色横带，眼睛红色。飞行时初级飞羽和次级飞羽为白色，与黑色体羽对比鲜明，十分醒目。颈部细长，游水时常呈优雅的S形弯曲。",
      habitatAndHabits: "原产澳大利亚，高度适应人工湖泊和公园水体。杂食性，以水草、藻类为主食，也接受人类投喂。繁殖期领地意识增强，会主动驱赶入侵者。飞行能力强，会进行季节性迁移。",
      callCharacteristics: "叫声为低沉的哨音或鼻音「嗡嗡」声，也会发出响亮的喇叭音。通常较安静，受威胁时会嘶嘶作声并张翅示威。",
      distribution: "原产澳大利亚和新西兰，现已引入全球许多地区作为观赏鸟类。本地常见于公园湖泊和植物园水体，为引进种。"
    }
  },
  {
    id: 22, name: "游隼", englishName: "Peregrine Falcon", latinName: "Falco peregrinus",
    category: "猛禽", rarity: "稀有", location: "高处", funFact: "俯冲速度可超过320公里/时，是地球上速度最快的动物。",
    details: {
      appearance: "体长约38-48厘米，雌鸟明显大于雄鸟。背部蓝灰色，腹部白色有黑色横斑，头部黑色，脸颊有宽阔的黑色「胡须」纹。翅膀尖长而狭窄，适合高速飞行。眼圈和蜡膜黄色，眼睛深褐色，目光锐利。",
      habitatAndHabits: "城市高楼和悬崖是其偏爱的筑巢地点。捕猎时先升高占据优势位置，发现猎物后收翅急速俯冲，以高速冲击力击昏猎物。主要捕食中小型鸟类，城市中偏爱捕食鸽子。",
      callCharacteristics: "叫声为响亮刺耳的「嗝嗝嗝嗝」急促叫声，繁殖期在巢区附近叫声频繁，有时在城市高楼间也能听到。",
      distribution: "全球分布最广的猛禽之一，除南极洲外各大洲均有记录。本地为不常见的冬候鸟，偶见于城市高楼、海岸和开阔地带，春秋迁徙季节过境数量稍多。"
    }
  },
  {
    id: 23, name: "红嘴鸥", englishName: "Black-headed Gull", latinName: "Chroicocephalus ridibundus",
    category: "水鸟", rarity: "常见", location: "沿海", funFact: "繁殖期头部变为深褐色，非繁殖期头部变为白色。",
    details: {
      appearance: "体长约38厘米，喙和脚红色是其名字由来。繁殖期头部深褐色（非黑色），眼后有白色半月形斑。非繁殖期头部白色，眼后有深色斑点。翅尖黑色，飞行时前缘白色明显。体羽白色，背部浅灰色。",
      habitatAndHabits: "群居性强，常成大群在海岸、河口和城市水体附近活动。机会主义的杂食者，以鱼类、昆虫、蚯蚓和人类食物垃圾为食，常跟随渔船或耕作机械觅食。飞行轻盈优雅，会在风中悬停。",
      callCharacteristics: "叫声嘈杂刺耳，为尖锐的「嘎嘎嘎」或「咔咔咔」声，大群聚集时声音震耳欲聋，是海港和海滨的标志性声音。",
      distribution: "繁殖于欧亚大陆北部，越冬于南方沿海地区。本地为常见冬候鸟，每年秋冬季节大量出现于海湾、河口和沿海鱼塘。"
    }
  },
  {
    id: 24, name: "家燕", englishName: "Barn Swallow", latinName: "Hirundo rustica",
    category: "城市鸟", rarity: "常见", location: "屋檐", funFact: "剪刀形的尾羽是识别家燕的标志性特征。",
    details: {
      appearance: "体长约17-19厘米，背部钢蓝色有金属光泽，额头和喉部砖红色，腹部白色或淡黄色。最显著的特征是深叉形的「剪刀尾」，外侧尾羽特别延长，飞行时尾羽张开呈优雅的燕尾形。",
      habitatAndHabits: "与人类关系极为密切，偏好在建筑物屋檐、桥梁和室内筑碗状泥巢。几乎完全在飞行中觅食，张大嘴在空中捕捉飞虫。迁徙距离极长，每年往返于繁殖地和越冬地，是长途迁徙的冠军之一。",
      callCharacteristics: "飞行时发出连续的「叽叽喳喳」叫声，鸣声为轻快活泼的颤音和啾啾声，常边飞边叫，是夏季最欢快的声音之一。",
      distribution: "几乎遍布全球（除南极洲），繁殖于北半球，越冬于南半球。本地为常见候鸟，迁徙季节大量过境，部分个体在本地繁殖。"
    }
  },
  {
    id: 25, name: "黄腹花蜜鸟", englishName: "Olive-backed Sunbird", latinName: "Cinnyris jugularis",
    category: "林鸟", rarity: "常见", location: "花园", funFact: "能像蜂鸟一样悬停在花前吸取花蜜。",
    details: {
      appearance: "体长约12厘米，是本地最常见的花蜜鸟。雄鸟背部橄榄绿色，喉部和胸部有鲜艳的金属蓝紫色，腹部亮黄色。雌鸟全身橄榄黄色，无金属色泽。喙细长向下弯曲，完美适合探入花中吸蜜。",
      habitatAndHabits: "花园、公园和林缘的常见访客。主要以花蜜为食，也捕食小昆虫补充蛋白质。能短暂悬停在花前，但多数情况下会栖于枝条上弯喙吸蜜。用蜘蛛网和植物纤维筑悬挂式水滴形巢。",
      callCharacteristics: "叫声尖细清脆，为「叽——叽——」或急促的「唧唧唧」，常在花丛中不停鸣叫，声音轻盈活泼。雄鸟还会发出复杂的颤音鸣唱。",
      distribution: "广泛分布于南亚至东南亚和澳大利亚北部。本地极为常见，从城市花园到郊区林缘均可见到其活跃身影，是最容易在花园中观察到的鸟类之一。"
    }
  },
  {
    id: 26, name: "冠斑犀鸟", englishName: "Oriental Pied Hornbill", latinName: "Anthracoceros albirostris",
    category: "林鸟", rarity: "罕见", location: "热带林", funFact: "雄鸟会用泥土将雌鸟封在树洞中孵卵，只留一条缝喂食。",
    details: {
      appearance: "体长约65厘米，是本地最常见的犀鸟。全身黑白色对比鲜明，背部、翅膀和尾羽黑色，腹部和脸部白色。最显著的是巨大的黄白色喙，喙上有角质盔突。雄鸟盔突有黑斑，雌鸟盔突较小。",
      habitatAndHabits: "栖息于热带雨林和林缘，以果实为主食，尤爱无花果，也捕食蜥蜴、蛇和大型昆虫。繁殖期雌鸟钻入树洞，由雄鸟和雌鸟共同用泥土和粪便封住洞口，仅留一条细缝，雄鸟负责从缝中传递食物。",
      callCharacteristics: "飞行时发出响亮的「嗒嗒嗒」翅膀扑击声，叫声为嘈杂的「嘎嘎嘎」，成群飞过时声音和飞行声震耳欲聋，是热带雨林的标志性声音。",
      distribution: "分布于南亚至东南亚热带地区。本地见于自然保护区和郊野公园，近年来在岛屿和偏远绿地数量有所恢复。"
    }
  },
  {
    id: 27, name: "太平鸟", englishName: "Bohemian Waxwing", latinName: "Bombycilla garrulus",
    category: "林鸟", rarity: "稀有", location: "果园", funFact: "翅膀上有红色蜡质翅尖，像用蜡烛点过一样。",
    details: {
      appearance: "体长约18厘米，外形优雅。整体棕灰色，头顶有褐色羽冠，过眼纹黑色，喉部黑色。翅膀黑色带黄色翅斑，次级飞羽羽轴末端有鲜红色蜡质小点，如同蜡封，这是「蜡翼鸟」英文名的由来。尾端黄色。",
      habitatAndHabits: "典型的游荡性鸟类，跟随浆果资源移动，冬季在浆果充足的地方大量聚集。以浆果为主食，尤爱花楸果、苹果和山楂，进食速度极快，有时会因过量进食发酵果实而「醉酒」。",
      callCharacteristics: "叫声为独特的颤抖高音「唧——唧——」或「嘶嘶嘶」，一群太平鸟同时鸣叫时宛如银铃悦耳，是冬季北方树林中最独特的声音之一。",
      distribution: "繁殖于北美和欧亚大陆北部针叶林，越冬于南方温带地区。本地为极罕见的冬候鸟，偶见于有大量浆果的林地，出现年份不规律。"
    }
  },
  {
    id: 28, name: "领雀嘴鹎", englishName: "Collared Finchbill", latinName: "Spizixos semitorques",
    category: "林鸟", rarity: "常见", location: "灌木丛", funFact: "象牙白色的粗短厚喙是其最显眼的特征。",
    details: {
      appearance: "体长约23厘米，整体橄榄绿色。最显著的特征是象牙白色的粗短厚喙，与其他鹎类纤细的喙截然不同。头部灰黑色，喉部有白色项纹形成明显「领圈」。背部、翅膀和尾羽橄榄绿色，腹部色较浅。",
      habitatAndHabits: "活跃于林缘灌木丛、竹林和次生林，很少到开阔地。杂食性，以果实、浆果和昆虫为食，厚实的喙非常适合处理较硬的果实。常成小群活动，行动敏捷，在枝间跳跃觅食。",
      callCharacteristics: "叫声响亮欢快，为圆润的「咕咕哦」或「欧几里得」式音节，鸣唱时音调上扬，声音悦耳，是南方山地和林缘最常听到的鸟叫之一。",
      distribution: "分布于中国南部、台湾至中南半岛北部。本地见于郊区林缘、植物园和山地，为留鸟，全年可见。"
    }
  },
  {
    id: 29, name: "灰喜鹊", englishName: "Azure-winged Magpie", latinName: "Cyanopica cyanus",
    category: "城市鸟", rarity: "常见", location: "松林", funFact: "天蓝色的翅膀和长尾是其最美丽的特征。",
    details: {
      appearance: "体长约34厘米，修长优雅。头顶和颈背黑色，脸颊和腹部白色，背部灰色。翅膀和长尾为独特的天蓝色，是其最具辨识度的颜色特征。飞行时蓝色翅膀和尾羽在阳光下格外亮眼，飘逸灵动。",
      habitatAndHabits: "喜欢在松树林和混交林中活动，常成群穿行于树冠间。喜食松子，也吃昆虫、果实和小型脊椎动物。社会性强，群体合作繁殖，多只个体共同协助一对繁殖鸟照顾雏鸟。",
      callCharacteristics: "叫声嘈杂刺耳，为急促的「嗝嗝嗝」或「嘎——嘎——」，成群活动时此起彼伏，在安静的松林中显得格外嘈杂。",
      distribution: "分布区域奇特，仅见于伊比利亚半岛和中国至日本东亚地区，中间地带无分布，是地理隔离的典型案例。本地见于城市公园松树林和郊区林地。"
    }
  },
  {
    id: 30, name: "红头长尾山雀", englishName: "Black-throated Bushtit", latinName: "Aegithalos concinnus",
    category: "林鸟", rarity: "常见", location: "林间", funFact: "体型极小，是中国最小的鸟类之一，常被亲切称为「小肥啾」。",
    details: {
      appearance: "体长约10厘米，是体型极小的鸣禽。头顶栗红色，过眼纹宽阔黑色，喉部中央有黑色大斑，背部灰色，腹部白色带棕色，尾羽较长。整体外形圆润可爱，大眼睛更增添几分呆萌感，深受观鸟爱好者喜爱。",
      habitatAndHabits: "几乎总是成群活动，5-20只的小群在林间枝头不停穿梭觅食，极少静止。以昆虫和蜘蛛为主食，觅食时会倒挂在细枝末端，将枝条的每一面都检查到。群体成员之间保持密切的声音联系。",
      callCharacteristics: "叫声为细弱但连续的「吱——吱——吱」高音，成群活动时声音不断，虽然微弱但极具穿透力，是发现其群体的重要线索。",
      distribution: "分布于喜马拉雅山脉至中国南部和东南亚北部。本地见于植物园、郊区林地和山地，常跟随混合鸟群活动，在繁茂林间最为活跃。"
    }
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