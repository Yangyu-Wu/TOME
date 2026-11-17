// Presentation and mechanics share these identities; no browser dependencies.
export const ULTIMATES = Object.freeze({
  guanyu: {theme:'dragon', name:'青龙偃月', epithet:'武圣临阵 · 青龙破军', color:'#42ffc0', secondary:'#d4ff93', type:'area', radius:112, power:1.55, force:170},
  zhouyu: {theme:'inferno', name:'赤壁业火', epithet:'江东都督 · 烈焰焚天', color:'#ff743a', secondary:'#ffe6a0', type:'burn', radius:108, power:1.3, force:85},
  zhugeliang: {theme:'seven-stars', name:'七星天诏', epithet:'卧龙借天 · 七星归位', color:'#8bcaff', secondary:'#fff2ac', type:'chain', radius:70, power:.68, force:60, strikes:7},
  lvbu: {theme:'airburst', name:'无双·裂空', epithet:'飞将无双 · 一戟裂天', color:'#ff68bd', secondary:'#c9a7ff', type:'area', radius:116, power:1.55, force:205},
  zhaoyun: {theme:'sonic', name:'龙胆·破音', epithet:'银枪白马 · 七进七出', color:'#a5efff', secondary:'#ffffff', type:'single', radius:85, power:1.6, force:150},
  zhangfei: {theme:'airburst', name:'长坂震天吼', epithet:'当阳一声 · 万军震退', color:'#ffc165', secondary:'#fff0ae', type:'stun', radius:130, power:1.15, force:210},
  lingtong: {theme:'tornado', name:'旋风突阵', epithet:'江东疾锋 · 风卷残军', color:'#83ffd6', secondary:'#c8edff', type:'area', radius:98, power:1.25, force:75},
  pangtong: {theme:'tornado', name:'凤雏·九霄风', epithet:'凤雏入阵 · 风起九霄', color:'#d8a7ff', secondary:'#e9faff', type:'area', radius:105, power:1.3, force:80},
  luxun: {theme:'inferno', name:'火烧连营', epithet:'白衣儒将 · 七百里连营', color:'#ff9a49', secondary:'#fff0a0', type:'burn', radius:112, power:1.3, force:75},
  simayi: {theme:'eclipse', name:'冢虎·蚀月', epithet:'星河寂灭 · 冢虎出渊', color:'#b59aff', secondary:'#f0caff', type:'drain', radius:106, power:1.35, force:-120},
  machao: {theme:'sonic', name:'铁骑·踏空', epithet:'西凉锦骑 · 踏破长空', color:'#6fcfff', secondary:'#fff4c1', type:'area', radius:98, power:1.4, force:170},
  zhangjiao: {theme:'thunder', name:'苍天雷罚', epithet:'太平道起 · 九天雷罚', color:'#a7a4ff', secondary:'#ffffff', type:'chain', radius:108, power:1.25, force:120},
  diaochan: {theme:'moon', name:'闭月·倾城', epithet:'月下惊鸿 · 落花乱阵', color:'#ffb5df', secondary:'#fff0f9', type:'stun', radius:104, power:1.05, force:50},
});

export function ultimateFor(unit) { return ULTIMATES[unit.heroId || unit.id] || null; }
