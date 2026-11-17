import {GameApp} from '../src/core/game-app.js';
import {createHeroUnit} from '../src/heroes/index.js';
import {queueSkill,updateSkillDirector} from '../src/core/skill-director.js';
import {updateVfx} from '../src/core/battle-vfx.js';

export function makeVisualScene(heroId='guanyu'){
  const app=new GameApp({seed:7});app.state.roster=[createHeroUnit(heroId,'front',3),createHeroUnit(heroId==='lvbu'?'zhaoyun':'lvbu','front',3),createHeroUnit('zhugeliang','back',3),createHeroUnit('zhouyu','back',3)];
  app.startBattle({difficulty:5,duration:120});const state=app.state;
  state.effects=[];state.roster[0].x=340;state.roster[0].y=440;state.roster[1].x=590;state.roster[1].y=460;
  state.enemies=Array.from({length:22},(_,i)=>({...app.battle.createEnemy(i,5,Math.floor(i/4),i%4,4,{elite:i%7===0,ranged:i%3===0}),x:i===0?420:170+(i*83)%640,y:i===0?400:160+(i*53)%335,maxHp:5000,currentHp:5000,moving:true,walkPhase:i*.8}));
  for(const enemy of state.enemies)enemy.entering=false;
  state.enemySpawned=state.enemies.length;state.battleElapsed=18;state.battleTime=102;
  return {app,state,caster:state.roster[0]};
}

export function stepPresentation(state,seconds){for(let i=0;i<Math.ceil(seconds*60);i++){updateVfx(state,1/60);updateSkillDirector(state,1/60);}}
export function castForScene(scene,phase='cinematic'){
  queueSkill(scene.state,scene.caster);
  if(phase==='cinematic')stepPresentation(scene.state,.55);
  else if(phase==='flight')stepPresentation(scene.state,1.57);
  else if(phase==='impact')stepPresentation(scene.state,['guanyu','zhouyu','luxun'].includes(scene.caster.heroId)?2.46:2.12);
  else stepPresentation(scene.state,2.95);
  return scene;
}
