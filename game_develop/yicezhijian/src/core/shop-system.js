import {HEROES,HERO_BY_ID} from '../heroes/index.js';

const DEFAULT_ODDS=Object.freeze({1:.35,2:.30,3:.20,4:.11,5:.04});

export class ShopSystem {
  constructor(random){this.random=random;}
  refresh(state,cost=2){if(state.gold<cost)return false;state.gold-=cost;this.roll(state);return true;}
  roll(state){
    const used=new Set();state.shop=Array.from({length:5},()=>{
      const cost=this.rollCost(),pool=HEROES.filter(hero=>hero.cost===cost&&!used.has(hero.id));
      const fallback=HEROES.filter(hero=>!used.has(hero.id)),hero=(pool.length?pool:fallback)[this.random.int((pool.length?pool:fallback).length)];
      if(hero)used.add(hero.id);return hero?.id??null;
    });
  }
  rollCost(){let value=this.random.next?.()??Math.random();for(const cost of [1,2,3,4,5]){value-=DEFAULT_ODDS[cost];if(value<=0)return cost;}return 5;}
  buy(state,index,addHero){const id=state.shop[index];if(!id)return false;const hero=HERO_BY_ID[id];if(!hero||state.gold<hero.cost||!addHero(state,id))return false;state.gold-=hero.cost;state.shop[index]=null;return true;}
}
