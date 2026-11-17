import {ULTIMATES} from './ultimates.js';

const TIER_5=[
 ['lvbu','吕布','群雄','spear','天下无双'],['caocao','曹操','魏','shield','魏武挥鞭'],['liubei','刘备','蜀','shield','仁德天下'],
 ['sunquan','孙权','吴','shield','坐断东南'],['zhugeliang','诸葛亮','蜀','mage','八阵图'],['simayi','司马懿','魏','mage','鹰视狼顾'],
 ['guanyu','关羽','蜀','spear','水淹七军'],['zhouyu','周瑜','吴','mage','赤壁业火'],['zhaoyun','赵云','蜀','spear','七进七出'],
];
const TIER_4=[
 ['zhangfei','张飞','蜀','shield','当阳怒吼'],['machao','马超','蜀','cavalry','西凉铁骑'],['dianwei','典韦','魏','shield','古之恶来'],
 ['xuchu','许褚','魏','shield','虎痴裸衣'],['taishici','太史慈','吴','archer','神亭酣战'],['ganning','甘宁','吴','assassin','锦帆夜袭'],
 ['huangzhong','黄忠','蜀','archer','百步穿杨'],['zhangliao','张辽','魏','cavalry','威震逍遥津'],['xiahoudun','夏侯惇','魏','shield','拔矢啖睛'],
 ['pangtong','庞统','蜀','mage','铁索连环'],['luxun','陆逊','吴','mage','火烧连营'],['diaochan','貂蝉','群雄','support','闭月离间'],
];
const TIER_3=[
 ['sunce','孙策','吴','cavalry','小霸王渡江'],['guojia','郭嘉','魏','mage','遗计定辽东'],['xunyu','荀彧','魏','support','王佐之才'],
 ['jiangwei','姜维','蜀','spear','麒麟北伐'],['weiyan','魏延','蜀','assassin','子午奇谋'],['zhurong','祝融','群雄','archer','飞刀烈焰'],
 ['menghuo','孟获','群雄','shield','蛮王再起'],['zhoutai','周泰','吴','shield','不屈血战'],['lvmeng','吕蒙','吴','spear','白衣渡江'],
 ['xiahouyuan','夏侯渊','魏','archer','神速奔袭'],['zhangjiao','张角','群雄','mage','苍天雷法'],['huatuo','华佗','群雄','support','青囊济世'],
];
const TIER_2=[
 ['caoRen','曹仁','魏','shield','据守樊城'],['yujin','于禁','魏','shield','毅重军令'],['xuhuang','徐晃','魏','spear','长驱破围'],
 ['fazheng','法正','蜀','mage','睚眦奇策'],['madai','马岱','蜀','cavalry','潜锋斩将'],['guanyinping','关银屏','蜀','spear','虎女震军'],
 ['chengpu','程普','吴','shield','三朝宿将'],['lingtong','凌统','吴','assassin','旋风突阵'],['daqiao','大乔','吴','support','国色流离'],
 ['yuanshao','袁绍','群雄','archer','名门号令'],['yanliang','颜良','群雄','spear','河北雄锋'],['wenchou','文丑','群雄','cavalry','双雄疾驰'],
];
const TIER_1=[
 ['liaohua','廖化','蜀','spear','先锋坚守'],['zhouCang','周仓','蜀','shield','扛刀护主'],['jianYong','简雍','蜀','support','纵论安民'],
 ['liDian','李典','魏','spear','长者先登'],['yuejin','乐进','魏','assassin','先登奋强'],['manchong','满宠','魏','mage','峻刑守城'],
 ['handang','韩当','吴','archer','江表劲弓'],['zhuran','朱然','吴','archer','火矢守营'],['panZhang','潘璋','吴','assassin','截江夺刃'],
 ['gongSunZan','公孙瓒','群雄','cavalry','白马义从'],['huaXiong','华雄','群雄','spear','汜水逞威'],['gaoshun','高顺','群雄','shield','陷阵无退'],
 ['zhangbao','张宝','群雄','mage','地公妖术'],['zhangliang','张梁','群雄','shield','人公奋击'],
];

const ROLE_BASE={shield:{hp:128,damage:10,range:34,speed:46},spear:{hp:102,damage:15,range:42,speed:58},archer:{hp:78,damage:17,range:155,speed:48},mage:{hp:74,damage:19,range:145,speed:44},support:{hp:86,damage:9,range:125,speed:46},cavalry:{hp:96,damage:16,range:38,speed:78},assassin:{hp:82,damage:20,range:32,speed:72}};
const COST_COLOR={5:'#d98a28',4:'#8f56c6',3:'#506fc3',2:'#4d9b70',1:'#7f858b'};
const SKILL_TYPES=['single','area','heal','shield','burn','stun','haste','drain','chain','summon'];

function hash(text){let value=2166136261;for(const char of text){value^=char.charCodeAt(0);value=Math.imul(value,16777619);}return value>>>0;}
function buildHero(row,cost,index){const [id,name,faction,role,skillName]=row,base=ROLE_BASE[role],seed=hash(id),power=1+(cost-1)*.18,ultimate=ULTIMATES[id];return Object.freeze({
 id,name,faction,role,cost,rarityColor:COST_COLOR[cost],mark:name.slice(-1),
 hp:Math.round(base.hp*power+(seed%9)),damage:Math.round(base.damage*power+(seed%4)),range:base.range,speed:base.speed,
 skill:Object.freeze({id:`${id}-skill`,name:ultimate?.name||skillName,type:ultimate?.type||SKILL_TYPES[(seed+index)%SKILL_TYPES.length],power:ultimate?.power??Number((1.05+cost*.18+(seed%17)/100).toFixed(2)),cooldown:Number((8.2-cost*.45-(seed%7)*.1).toFixed(1)),radius:ultimate?.radius||70+(seed%45),duration:1.5+(seed%20)/10}),
 visual:Object.freeze({skin:seed%5,helmet:(seed>>>3)%7,armor:(seed>>>7)%6,weapon:role,plume:(seed>>>11)%5,portraitHue:seed%360,accentHue:(seed>>>9)%360,face:(seed>>>14)%6}),
});}

export const HEROES=Object.freeze([[5,TIER_5],[4,TIER_4],[3,TIER_3],[2,TIER_2],[1,TIER_1]].flatMap(([cost,rows])=>rows.map((row,index)=>buildHero(row,cost,index))));
export const HERO_BY_ID=Object.freeze(Object.fromEntries(HEROES.map(hero=>[hero.id,hero])));
export const HERO_COUNTS=Object.freeze(Object.fromEntries([1,2,3,4,5].map(cost=>[cost,HEROES.filter(hero=>hero.cost===cost).length])));

if(HEROES.length!==59||HERO_COUNTS[5]!==9||[4,3,2].some(cost=>HERO_COUNTS[cost]!==12)||HERO_COUNTS[1]!==14)throw new Error('Hero catalog tier counts are invalid');
