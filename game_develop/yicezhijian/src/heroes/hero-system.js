import {HERO_BY_ID} from './catalog.js';

export const MAX_STAR=3;
export const STAR_MULTIPLIER=Object.freeze({1:1,2:1.8,3:3.2});
let nextInstance=1;

function makeInstanceId(heroId){return `${heroId}-${Date.now().toString(36)}-${nextInstance++}`;}

export function hydrateHeroUnit(unit){
  const hero=HERO_BY_ID[unit.heroId||unit.id];
  if(!hero)throw new Error(`Unknown hero: ${unit.heroId||unit.id}`);
  const star=unit.star||1,multiplier=STAR_MULTIPLIER[star]||1;
  return {...unit,...hero,id:hero.id,heroId:hero.id,instanceId:unit.instanceId||makeInstanceId(hero.id),star,slot:unit.slot||'bench',maxHp:Math.round(hero.hp*multiplier),currentHp:unit.currentHp??Math.round(hero.hp*multiplier),damage:Math.round(hero.damage*multiplier),attackCooldown:unit.attackCooldown||0,skillCooldown:unit.skillCooldown||0,shield:unit.shield||0,statuses:unit.statuses||[]};
}

export function createHeroUnit(heroId,slot='bench',star=1){return hydrateHeroUnit({heroId,slot,star});}

const SLOT_PRIORITY={front:0,back:1,bench:2};
function chooseSurvivor(group){return [...group].sort((a,b)=>(SLOT_PRIORITY[a.slot]??9)-(SLOT_PRIORITY[b.slot]??9))[0];}

export function resolveUpgrades(roster,heroId){
  const upgrades=[];
  for(let star=1;star<MAX_STAR;star++){
    while(true){
      const matches=roster.filter(unit=>unit.heroId===heroId&&unit.star===star);
      if(matches.length<3)break;
      const consumed=matches.slice(0,3),survivor=chooseSurvivor(consumed);
      const insertAt=Math.min(...consumed.map(unit=>roster.indexOf(unit)));
      for(const unit of consumed){const index=roster.indexOf(unit);if(index>=0)roster.splice(index,1);}
      const upgraded=createHeroUnit(heroId,survivor.slot,star+1);
      roster.splice(insertAt>=0?Math.min(insertAt,roster.length):roster.length,0,upgraded);
      upgrades.push({heroId,fromStar:star,toStar:star+1,instanceId:upgraded.instanceId});
    }
  }
  return upgrades;
}

export function addHeroToRoster(state,heroId,{benchLimit=9}={}){
  const benchCount=state.roster.filter(unit=>unit.slot==='bench').length;
  const canMerge=state.roster.filter(unit=>unit.heroId===heroId&&unit.star===1).length>=2;
  if(benchCount>=benchLimit&&!canMerge)return {ok:false,upgrades:[]};
  const unit=createHeroUnit(heroId);state.roster.push(unit);
  const upgrades=resolveUpgrades(state.roster,heroId);
  if(upgrades.length)state.events?.push({type:'hero-upgraded',heroId,upgrades});
  return {ok:true,unit,upgrades};
}

export function restoreRoster(roster=[]){return roster.map(hydrateHeroUnit);}
