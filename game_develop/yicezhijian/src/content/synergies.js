export const SYNERGIES = Object.freeze([
  {id:'wei',name:'魏之铁壁',icon:'魏',threshold:2,description:'全军受到伤害 -12%',effect:{damageReduction:.12},select:units=>units.filter(u=>u.faction==='魏')},
  {id:'shu',name:'蜀汉同心',icon:'蜀',threshold:3,description:'全军攻速 +16%',effect:{attackSpeed:1.16},select:units=>units.filter(u=>u.faction==='蜀')},
  {id:'wu',name:'江东水师',icon:'吴',threshold:2,description:'远程伤害 +22%',effect:{rangedPower:1.22},select:units=>units.filter(u=>u.faction==='吴')},
  {id:'five-tigers',name:'五虎上将',icon:'五',threshold:3,description:'枪将与骑将伤害 +24%',effect:{martialPower:1.24},select:units=>units.filter(u=>['guanyu','zhangfei','zhaoyun','machao','huangzhong'].includes(u.heroId))},
  {id:'rulers',name:'君主羁绊',icon:'君',threshold:2,description:'全军生命 +18%',effect:{maxHp:1.18},select:units=>units.filter(u=>['caocao','sunquan','liubei'].includes(u.heroId))},
  {id:'dragon-phoenix',name:'卧龙凤雏',icon:'卧',threshold:2,description:'技能冷却 -20%',effect:{cooldown:1.2},select:units=>units.filter(u=>['zhugeliang','pangtong'].includes(u.heroId))},
  {id:'beauties',name:'闭月羞花',icon:'月',threshold:2,description:'技能强度 +20%',effect:{skillPower:1.2},select:units=>units.filter(u=>['diaochan','daqiao'].includes(u.heroId))},
]);

export function evaluateSynergies(units) {
  return SYNERGIES.map(item=>{const count=item.select(units).length;return {...item,count,active:count>=item.threshold};});
}

export function calculateSynergyEffects(units){
  return evaluateSynergies(units).filter(item=>item.active).reduce((total,item)=>{
    for(const [key,value] of Object.entries(item.effect||{})){if(key==='damageReduction')total[key]=1-(1-total[key])*(1-value);else if(key==='maxHp')total[key]*=value;else total[key]=Math.max(total[key]||1,value);}
    total.active.push(item.id);return total;
  },{damageReduction:0,attackSpeed:1,rangedPower:1,martialPower:1,maxHp:1,cooldown:1,skillPower:1,active:[]});
}
