import {HEROES,createHeroUnit,addHeroToRoster} from '../heroes/index.js';

export const FORMATION_LIMITS=Object.freeze({front:2,back:2,bench:9});

export function createInitialState({testMode=false}={}){return {phase:'camp',testMode,run:1,wave:0,level:5,gold:20,interest:0,route:null,difficulty:1,battleType:'normal',battleTime:90,battleDuration:90,battleElapsed:0,roster:[],shop:Array(5).fill(null),enemies:[],summons:[],projectiles:[],lastBattle:null,events:[]};}

// 补齐测试收藏，不触发合成，也不覆盖旧存档中的星级和编队。
export function unlockTestRoster(state){
  if(!state.testMode)return;
  const owned=new Set(state.roster.map(unit=>unit.heroId));
  for(const hero of HEROES)if(!owned.has(hero.id))state.roster.push(createHeroUnit(hero.id));
  for(const slot of ['front','back']){
    const units=state.roster.filter(unit=>unit.slot===slot),used=new Set();
    for(const unit of units){
      if(!Number.isInteger(unit.formationPosition)||unit.formationPosition<0||unit.formationPosition>=FORMATION_LIMITS[slot]||used.has(unit.formationPosition))unit.formationPosition=null;
      else used.add(unit.formationPosition);
    }
    for(const unit of units)if(unit.formationPosition===null){
      const position=Array.from({length:FORMATION_LIMITS[slot]},(_,i)=>i).find(i=>!used.has(i));
      if(position===undefined)unit.slot='bench';else{unit.formationPosition=position;used.add(position);}
    }
  }
}

export function assignSlot(state,index,target,position){
  const unit=state.roster[index];if(!unit)return false;
  if(!FORMATION_LIMITS[target])return false;
  if(state.testMode){
    if(target==='bench'){unit.slot='bench';unit.formationPosition=null;return true;}
    if(position===undefined){
      if(unit.slot===target)return true;
      position=Array.from({length:FORMATION_LIMITS[target]},(_,i)=>i).find(i=>!state.roster.some(other=>other.slot===target&&other.formationPosition===i));
    }
    if(!Number.isInteger(position)||position<0||position>=FORMATION_LIMITS[target])return false;
    const previous=state.roster.find(other=>other!==unit&&other.slot===target&&other.formationPosition===position);
    if(previous){previous.slot='bench';previous.formationPosition=null;}
    unit.slot=target;unit.formationPosition=position;return true;
  }
  if(unit.slot===target)return true;
  if(state.roster.filter(x=>x.slot===target).length>=FORMATION_LIMITS[target])return false;
  unit.slot=target;return true;
}

export function addHero(state,heroId){
  return addHeroToRoster(state,heroId,{benchLimit:state.testMode?Infinity:FORMATION_LIMITS.bench}).ok;
}
