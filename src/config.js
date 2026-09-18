export const MODEL_OPTIONS = [
  {
    id: "wuliangshou",
    label: "无量寿佛",
    url: new URL("../assets/wuliangshou-buddha.glb", import.meta.url),
  },
  {
    id: "bukong-chengjiu",
    label: "不空成就佛",
    url: new URL("../assets/bukong-chengjiu-buddha.glb", import.meta.url),
  },
  {
    id: "jingang-budong",
    label: "金刚不动佛",
    url: new URL("../assets/jingang-budong-buddha.glb", import.meta.url),
  },
  {
    id: "baosheng",
    label: "宝生佛",
    url: new URL("../assets/baosheng-buddha.glb", import.meta.url),
  },
  {
    id: "datong",
    label: "大同佛像",
    url: new URL("../assets/buddha-statue-datong.glb", import.meta.url),
  },
  {
    id: "model2",
    label: "毗卢遮那佛",
    url: new URL("../assets/model2.glb", import.meta.url),
  },
  {
    id: "model3",
    label: "佛像模型",
    url: new URL("../assets/3d model3.glb", import.meta.url),
  },
];

export const BUDDHA_INFO = {
  wuliangshou: {
    roman: "AMITAYUS",
    title: "无量寿佛",
    alias: "又称“阿弥陀佛”",
    direction: "西方",
    wisdom: "妙观察智",
    summary:
      "五方佛体系中，西方佛多对应阿弥陀佛，也常以无量寿、无量光的意象表达极乐净土与接引愿力。",
    points: ["西方净土", "莲华部", "长寿与光明"],
  },
  "bukong-chengjiu": {
    roman: "AMOGHASIDDHI",
    title: "不空成就佛",
    alias: "五方佛中的北方佛",
    direction: "北方",
    wisdom: "成所作智",
    summary:
      "不空成就佛象征事业成办与行动圆满，在五智中对应成所作智，强调将智慧落实为利益众生的行动。",
    points: ["北方佛", "成所作智", "事业成办"],
  },
  "jingang-budong": {
    roman: "AKSHOBHYA",
    title: "金刚不动佛",
    alias: "又称“阿閦佛”",
    direction: "东方",
    wisdom: "大圆镜智",
    summary:
      "东方阿閦佛意为不动、不可动摇，象征如镜般澄明的智慧，常与降伏烦恼、稳定心性相联系。",
    points: ["东方佛", "大圆镜智", "不动如镜"],
  },
  baosheng: {
    roman: "RATNASAMBHAVA",
    title: "宝生佛",
    alias: "五方佛中的南方佛",
    direction: "南方",
    wisdom: "平等性智",
    summary:
      "宝生佛象征福德、珍宝与平等性智，代表以平等心观照万物，将差别转化为圆融的智慧。",
    points: ["南方佛", "平等性智", "福德珍宝"],
  },
  model2: {
    roman: "VAIROCANA",
    title: "毗卢遮那佛",
    alias: "又称“大日如来”",
    direction: "中央",
    wisdom: "法界体性智",
    summary:
      "毗卢遮那佛为五方佛中央主尊，意为光明遍照，象征法界体性智，是统摄五方与五智的核心。",
    points: ["中央主尊", "法界体性智", "光明遍照"],
  },
  datong: {
    roman: "DATONG BUDDHA",
    title: "大同佛像",
    alias: "云冈与华严文化语境",
    direction: "大同",
    wisdom: "石窟与辽金佛教艺术",
    summary:
      "大同是北方佛教艺术重镇，云冈石窟与华严寺共同构成理解当地造像传统的重要线索。",
    points: ["云冈石窟", "华严寺", "北方佛教艺术"],
  },
  model3: {
    roman: "BUDDHA FORM",
    title: "佛像粒子模型",
    alias: "数字化造像展示",
    direction: "数字展陈",
    wisdom: "点云重构",
    summary:
      "通过点云粒子化呈现造像轮廓、材质与动态消散过程，用数字媒介重新观看佛教造像细节。",
    points: ["点云粒子", "动态消散", "交互观看"],
  },
};

export const MAX_PARTICLES = 1800000;
export const INITIAL_ROTATION_X = -0.08;
export const INITIAL_ZOOM = 2.28;
export const MAX_DPR = 2;

export const DEFAULT_MOTION_PARAMS = {
  pointSize: 8.2,
  autoRotateSpeed: 0.0053,
  verticalDelay: 3.65,
  scatterDuration: 1.55,
  returnStart: 7.65,
  returnDuration: 2.75,
  flowStrength: 4.0,
  flowLimit: 2.65,
  filamentDensity: 5.2,
  motionNoise: 1.65,
};
