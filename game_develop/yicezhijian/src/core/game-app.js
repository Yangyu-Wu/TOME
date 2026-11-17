import {createInitialState,unlockTestRoster,addHero,assignSlot} from './game-state.js';
import {Random} from './random.js';
import {ShopSystem} from './shop-system.js';
import {BattleSimulation} from './battle-simulation.js';
import {restoreRoster} from '../heroes/index.js';
import {clearVfx} from './battle-vfx.js';

export class GameApp {
  constructor({storage,seed,testMode=false}={}){this.storage=storage;this.testMode=testMode;this.random=new Random(seed);this.shop=new ShopSystem(this.random);this.battle=new BattleSimulation();this.state=createInitialState({testMode});unlockTestRoster(this.state);this.listeners=new Set();}
  persist(){if(this.state.phase==='camp')this.save();}
  subscribe(listener){this.listeners.add(listener);listener(this.state);return()=>this.listeners.delete(listener);}
  emit(){for(const listener of this.listeners)listener(this.state);}
  newGame(){this.state=createInitialState({testMode:this.testMode});unlockTestRoster(this.state);this.shop.roll(this.state);this.persist();this.emit();}
  buy(index){if(this.state.phase!=='camp')return false;const result=this.shop.buy(this.state,index,addHero);if(result){this.persist();this.emit();}return result;}
  refresh(){if(this.state.phase!=='camp')return false;const result=this.shop.refresh(this.state);if(result){this.persist();this.emit();}return result;}
  deploy(index,slot,position){if(this.state.phase!=='camp')return false;const result=assignSlot(this.state,index,slot,position);if(result){this.persist();this.emit();}return result;}
  // 测试环境只调整上阵四将，保留完整收藏和已有星级。
  setupTestRoster(){
    if(this.state.phase!=='camp')return false;
    const preset=['lvbu','guanyu','zhugeliang','zhouyu'];
    if(this.state.testMode){
      unlockTestRoster(this.state);
      this.state.roster.forEach(unit=>{unit.slot='bench';unit.formationPosition=null;});
      preset.forEach((id,index)=>{const unit=this.state.roster.filter(unit=>unit.heroId===id).sort((a,b)=>b.star-a.star)[0];assignSlot(this.state,this.state.roster.indexOf(unit),index<2?'front':'back',index%2);});
    }else{
      this.state.roster=[];preset.forEach(id=>addHero(this.state,id));
      this.state.roster.forEach((unit,index)=>{unit.slot=index<2?'front':'back';});
    }
    this.shop.roll(this.state);this.persist();this.emit();return true;
  }
  startBattle(options={}){
    if(this.state.phase!=='camp'||!this.state.roster.some(unit=>unit.slot==='front'))return false;
    const battleType=options.battleType||'normal',baseDifficulty=1+Math.floor(this.state.wave/2),typeBonus={normal:0,encounter:2,boss:4}[battleType]??0,difficulty=options.difficulty??baseDifficulty+typeBonus;
    this.battle.start(this.state,{...options,battleType,difficulty});this.emit();return true;
  }
  tick(dt){this.battle.update(this.state,dt);this.emit();}
  continueAfterBattle(){
    if(!['reward','defeat'].includes(this.state.phase))return false;
    const victory=this.state.phase==='reward',baseReward=victory?5+this.state.difficulty:2,interest=victory?Math.min(5,Math.floor(this.state.gold/10)):0;
    this.state.gold+=baseReward+interest;this.state.interest=interest;this.state.lastBattle={victory,baseReward,interest,wave:this.state.wave+1};
    if(victory)this.state.wave+=1;
    this.state.phase='camp';this.state.enemies=[];this.state.summons=[];this.state.projectiles=[];
    clearVfx(this.state);
    for(const unit of this.state.roster){unit.currentHp=unit.maxHp;unit.dead=false;unit.shield=0;unit.statuses=[];}
    this.shop.roll(this.state);this.persist();this.emit();return true;
  }
  restart(){this.newGame();return true;}
  save(){this.storage?.save('yice-save-v1',this.state);}
  load(){const saved=this.storage?.load('yice-save-v1');if(saved){this.state={...createInitialState(),...saved,testMode:this.testMode,phase:'camp',enemies:[],summons:[],projectiles:[],roster:restoreRoster(saved.roster)};if(!this.state.shop.some(Boolean))this.shop.roll(this.state);}else{this.state=createInitialState({testMode:this.testMode});this.shop.roll(this.state);}unlockTestRoster(this.state);this.persist();this.emit();}
}
