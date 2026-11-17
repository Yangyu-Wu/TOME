import {tickStatuses} from '../heroes/index.js';
import {calculateSynergyEffects} from '../content/synergies.js';
import {initializeVfx,updateVfx,updateUnitPhysics,emitParticles} from './battle-vfx.js';
import {queueSkill,updateSkillDirector} from './skill-director.js';
import {signatureAttackFor} from '../heroes/attack-timing.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const stunned=unit=>(unit.statuses||[]).some(status=>status.type==='stun');
const haste=unit=>(unit.statuses||[]).some(status=>status.type==='haste')?1.35:1;

export class BattleSimulation {
  start(state,{difficulty=1,duration,battleType='normal'}={}){
    const typeDuration={normal:80,encounter:95,boss:120}[battleType]||80,battleDuration=duration??clamp(typeDuration+difficulty*2,80,120);
    state.phase='battle';state.battleType=battleType;state.difficulty=difficulty;state.battleDuration=battleDuration;state.battleTime=battleDuration;state.battleElapsed=0;state.screenShake=0;state.summons=[];state.projectiles=[];state.effects=[];state.enemies=[];
    initializeVfx(state);
    state.enemyPlan=this.createEnemyPlan(difficulty,battleDuration,battleType);state.enemySpawned=0;state.nextSpawnAt=0;
    const front=state.roster.filter(unit=>unit.slot==='front');
    const deployed=state.roster.filter(unit=>unit.slot==='front'||unit.slot==='back');state.synergyEffects=calculateSynergyEffects(deployed);state.deployedCount=deployed.length;state.loneHero=state.deployedCount===1;state.lonePressureTick=0;
    for(let index=0;index<state.synergyEffects.active.length;index++){const id=state.synergyEffects.active[index];state.effects.push({type:'synergy',id,x:480,y:250+index*26,life:2.2,maxLife:2.2,radius:72,color:'#f1d27d'});}
    for(const unit of deployed){unit.synergy=state.synergyEffects;unit.baseMaxHp=unit.baseMaxHp||unit.maxHp;const hpMultiplier=state.synergyEffects.maxHp||1;unit.maxHp=Math.round(unit.baseMaxHp*hpMultiplier);}
    front.forEach((unit,index)=>{const position=state.testMode?(unit.formationPosition??index):index;Object.assign(unit,{dead:false,currentHp:unit.maxHp,shield:0,statuses:[],x:410+position*120,y:500,attackCooldown:position*.2,skillCooldown:2+position*.4,walkPhase:position});});
    state.roster.filter(unit=>unit.slot==='back').forEach((unit,index)=>{const position=state.testMode?(unit.formationPosition??index):index;Object.assign(unit,{dead:false,currentHp:unit.maxHp,shield:0,statuses:[],x:65,y:145+position*120,skillCooldown:2.5+position,skillDuration:unit.skill.cooldown});});
    for(const unit of deployed)Object.assign(unit,{pendingCast:false,casting:false,moving:false,facing:1,airHeight:0,liftSpeed:0,impulseX:0,impulseY:0,footstepClock:0,attackMotion:null,attackSequence:0});
    state.bossEntrance=null;
    if(battleType==='boss'){const boss=this.createBoss(difficulty);state.enemies.push(boss);state.bossEntrance={age:0,duration:2.8,name:boss.name};}
    this.spawnWave(state,true);
  }
  createEnemyPlan(difficulty,duration,battleType='normal'){
    // 密集但可读的战斗节奏：约每 1.2~1.9 秒从四面刷新一批。
    // 遭遇战额外压缩间隔，Boss 战保持较大的单位压力而不是空场等待。
    const typeFactor={normal:1,encounter:1.22,boss:.9}[battleType]||1,spawnInterval=clamp(1.9-difficulty*.045-(battleType==='encounter'?.18:0),1.15,1.9),waveSize=clamp(Math.round((4+Math.floor(difficulty/3))*typeFactor),4,10),waves=Math.ceil((duration-2)/spawnInterval),total=waves*waveSize,eliteRate=clamp(.025+difficulty*.038+(battleType==='encounter'?.06:0),.05,.48),rangedRate=clamp(.18+difficulty*.035+(battleType==='encounter'?.05:0),.22,.56);
    return {total,waveSize,eliteRate,rangedRate,spawnInterval,waves,battleType};
  }
  createBoss(difficulty){const hp=1100+difficulty*180;return {id:'boss-unit',name:'敌军主将',role:'archer',elite:true,boss:true,entry:'北',x:480,y:235,currentHp:hp,maxHp:hp,damage:8+difficulty*.7,speed:28,range:205,attackCooldown:.7,attackInterval:.58,burst:3+Math.floor(difficulty/3),shield:180+difficulty*28,statuses:[],dead:false,walkPhase:0};}
  spawnWave(state,initial=false){
    const plan=state.enemyPlan,remaining=plan.total-state.enemySpawned;if(remaining<=0)return;
    const count=Math.min(plan.waveSize,remaining),wave=Math.floor(state.enemySpawned/plan.waveSize),difficulty=state.difficulty;
    for(let i=0;i<count;i++){const sequence=state.enemySpawned+i,elite=difficulty>=3&&((sequence*7+wave*3)%100)/100<plan.eliteRate,ranged=((sequence*11+wave*5)%100)/100<plan.rangedRate,enemy=this.createEnemy(sequence,difficulty,wave,i,count,{elite,ranged});state.enemies.push(enemy);}
    state.enemySpawned+=count;state.nextSpawnAt=state.battleElapsed+plan.spawnInterval;state.events.push({type:'enemy-wave',wave:wave+1,count,totalSpawned:state.enemySpawned});
  }
  createEnemy(index,difficulty,wave,position,count,{elite,ranged}){
    const quality=1+difficulty*.14+wave*.018,eliteMultiplier=elite?2.15:1,side=(wave+position)%4,offset=90+((index*83+position*47)%420);
    const points=[{x:offset,y:-70,entry:'北',entryX:offset,entryY:130},{x:1030,y:offset+40,entry:'东',entryX:918,entryY:offset+40},{x:offset,y:670,entry:'南',entryX:offset,entryY:560},{x:-70,y:offset+40,entry:'西',entryX:42,entryY:offset+40}],spawn=points[side];
    const damage=(.82+difficulty*.105)*(1+wave*.004)*(elite?1.2:1);
    return {id:`enemy-${index}`,name:elite?'敌方名将':ranged?'敌军弓手':'敌军甲士',role:ranged?'archer':'spear',elite,...spawn,entering:true,entranceAge:0,currentHp:Math.round(43*quality*eliteMultiplier),maxHp:Math.round(43*quality*eliteMultiplier),damage:Number(damage.toFixed(1)),speed:ranged?40+difficulty*1.7:52+difficulty*2.3,range:ranged?175:34,attackCooldown:(index%5)*.08,attackInterval:ranged?Math.max(.46, .86-difficulty*.028):Math.max(.4,.64-difficulty*.016),burst:ranged?1+Math.floor(difficulty/4)+(elite?1:0):1,shield:elite?Math.round(16*difficulty):0,statuses:[],dead:false,walkPhase:index};
  }
  update(state,dt){
    if(state.phase==='battle'&&state.bossEntrance){state.bossEntrance.age+=dt;if(state.bossEntrance.age>=state.bossEntrance.duration)state.bossEntrance=null;return;}
    if(state.phase!=='battle')return;state.battleTime=clamp(state.battleTime-dt,0,state.battleDuration);state.battleElapsed+=dt;state.screenShake=Math.max(0,(state.screenShake||0)-dt*18);
    updateVfx(state,dt);updateSkillDirector(state,dt);
    if(state.enemySpawned<state.enemyPlan.total&&state.battleElapsed>=state.nextSpawnAt)this.spawnWave(state);
    const front=state.roster.filter(unit=>unit.slot==='front'&&unit.currentHp>0),back=state.roster.filter(unit=>unit.slot==='back'&&unit.currentHp>0),allies=[...front,...state.summons.filter(unit=>!unit.dead)];
    for(const unit of [...allies,...back,...state.enemies])tickStatuses(unit,dt);
    for(const unit of allies)this.updateFront(unit,allies,state.enemies,state,dt);
    for(const unit of back)this.updateBack(unit,allies,state.enemies,state,dt);
    for(const enemy of state.enemies.filter(unit=>!unit.dead))this.updateEnemy(enemy,allies,state,dt);
    for(const unit of [...allies,...state.enemies.filter(unit=>!unit.dead)]){updateUnitPhysics(unit,dt);if(unit.moving){unit.footstepClock=(unit.footstepClock||0)-dt;if(unit.footstepClock<=0){unit.footstepClock=.25;emitParticles(state,{x:unit.x,y:unit.y+15,count:2,color:'#bcae8a',speed:20,kind:'dust',seed:unit.walkPhase});}}}
    for(const unit of state.enemies)if(unit.dead){if(unit.deathAge===undefined){unit.deathAge=0;emitParticles(state,{x:unit.x,y:unit.y,count:7,color:'#c4b895',speed:60,kind:'dust'});}unit.deathAge+=dt;if(unit.deathAge<.8)updateUnitPhysics(unit,dt);}
    this.updateProjectiles(state,allies,dt);
    this.updateEffects(state,dt);
    this.updateLoneHeroPressure(state,front,dt);
    const allSpawned=state.enemySpawned>=state.enemyPlan.total;
    if(!allies.some(unit=>unit.currentHp>0)){state.phase='defeat';state.events.push({type:'battle-ended',result:'defeat'});}
    else if(allSpawned&&state.enemies.every(unit=>unit.dead)){state.phase='reward';state.events.push({type:'battle-ended',result:'victory'});}
    else if(state.battleTime<=0){state.phase='defeat';state.events.push({type:'battle-ended',result:'timeout'});}
  }
  updateFront(unit,allies,enemies,state,dt){
    unit.moving=false;if(unit.dead||unit.currentHp<=0||stunned(unit)||unit.casting){if(unit.attackMotion?.active){unit.attackMotion.active=false;unit.attackMotion.cancelled=true;}return;}
    const speedBonus=state.synergyEffects?.attackSpeed||1;unit.attackCooldown-=dt*haste(unit)*speedBonus;unit.skillCooldown-=dt*(state.synergyEffects?.cooldown||1);unit.skillFlash=Math.max(0,(unit.skillFlash||0)-dt);unit.attackFlash=Math.max(0,(unit.attackFlash||0)-dt);unit.hitFlash=Math.max(0,(unit.hitFlash||0)-dt);
    if(unit.attackMotion?.active){this.advanceSignatureAttack(unit,enemies,state,dt);return;}
    const target=enemies.filter(enemy=>!enemy.dead).sort((a,b)=>distance(unit,a)-distance(unit,b))[0];if(!target)return;unit.facing=target.x>=unit.x?1:-1;
    const d=distance(unit,target),range=unit.range||35;if(d>range){const separation=this.separation(unit,allies),dx=(target.x-unit.x)/d+separation.x,dy=(target.y-unit.y)/d+separation.y;unit.x+=dx*unit.speed*dt;unit.y+=dy*unit.speed*dt;unit.walkPhase=(unit.walkPhase||0)+dt*(unit.role==='cavalry'?13:10);unit.moving=true;}
    else if(unit.skill&&unit.skillCooldown<=0&&!unit.pendingCast){if(queueSkill(state,unit))unit.skillCooldown=unit.skill.cooldown;}
    else if(unit.attackCooldown<=0){
      if(signatureAttackFor(unit)){this.beginSignatureAttack(unit,target,state);return;}
      if(unit.role==='archer')this.fireHeroArrow(unit,target,state);else{target.hitDirection=unit.facing;this.damage(target,this.attackDamage(unit,state),state);}unit.attackCooldown=unit.role==='archer'?.72:.3;unit.attackFlash=.2;state.screenShake=Math.max(state.screenShake,1.2);
    }
  }
  beginSignatureAttack(unit,target,state){
    const timing=signatureAttackFor(unit),rate=haste(unit)*(state.synergyEffects?.attackSpeed||1),duration=timing.duration/rate;
    unit.attackSequence=(unit.attackSequence||0)+1;
    unit.attackMotion={sequence:unit.attackSequence,age:0,duration,impactTime:duration*timing.impact,active:true,impactApplied:false,targetId:target.instanceId||target.id,facing:unit.facing,damage:this.attackDamage(unit,state)*timing.duration/.3,range:(unit.range||35)*1.25};
    // Slower, readable strikes carry the same baseline damage per second as
    // the old .3-second auto attack. Haste compresses the action, not damage.
    unit.attackCooldown=timing.duration;unit.attackFlash=.2;
  }
  advanceSignatureAttack(unit,enemies,state,dt){
    const action=unit.attackMotion;if(!action?.active)return;
    action.age=Math.min(action.duration,action.age+Math.max(0,dt));unit.facing=action.facing;
    if(!action.impactApplied&&action.age+1e-8>=action.impactTime){
      action.impactApplied=true;
      const target=enemies.find(enemy=>(enemy.instanceId||enemy.id)===action.targetId&&!enemy.dead&&enemy.currentHp>0);
      const inFront=target&&(target.x-unit.x)*action.facing>=-8;
      if(target&&inFront&&distance(unit,target)<=action.range){
        target.hitDirection=action.facing;this.damage(target,action.damage,state);action.hit=true;
        state.effects.push({id:`melee-${unit.instanceId||unit.id}-${action.sequence}`,type:'hit',kind:'melee',x:target.x,y:target.y-30,life:.28,maxLife:.28,radius:24,color:'#8dc8ff',direction:action.facing});state.screenShake=Math.max(state.screenShake||0,1.2);
      }else action.hit=false;
    }
    if(action.age>=action.duration)action.active=false;
  }
  updateBack(unit,allies,enemies,state,dt){unit.skillCooldown-=dt*(state.synergyEffects?.cooldown||1);unit.skillFlash=Math.max(0,(unit.skillFlash||0)-dt);unit.hitFlash=Math.max(0,(unit.hitFlash||0)-dt);if(unit.skillCooldown<=0&&!unit.pendingCast&&queueSkill(state,unit))unit.skillCooldown=unit.skill.cooldown;}
  updateEnemy(enemy,allies,state,dt){
    if(enemy.entering){
      const dx=enemy.entryX-enemy.x,dy=enemy.entryY-enemy.y,d=Math.hypot(dx,dy),step=enemy.speed*dt;
      enemy.entranceAge+=dt;enemy.moving=true;enemy.facing=dx<0?-1:1;enemy.walkPhase=(enemy.walkPhase||0)+dt*10;
      if(d<=step){enemy.x=enemy.entryX;enemy.y=enemy.entryY;enemy.entering=false;}
      else{enemy.x+=dx/d*step;enemy.y+=dy/d*step;}
      return;
    }
    enemy.moving=false;if(stunned(enemy))return;enemy.attackFlash=Math.max(0,(enemy.attackFlash||0)-dt);enemy.hitFlash=Math.max(0,(enemy.hitFlash||0)-dt);const target=allies.filter(unit=>unit.currentHp>0).sort((a,b)=>distance(enemy,a)-distance(enemy,b))[0];if(!target)return;enemy.attackCooldown-=dt;const d=distance(enemy,target);enemy.facing=target.x>=enemy.x?1:-1;
    if(d>enemy.range){enemy.x+=(target.x-enemy.x)/d*enemy.speed*dt;enemy.y+=(target.y-enemy.y)/d*enemy.speed*dt;enemy.walkPhase=(enemy.walkPhase||0)+dt*10;enemy.moving=true;}
    else if(enemy.attackCooldown<=0){const pressure=this.formationPressure(state);if(enemy.role==='archer')this.fireBurst(enemy,target,state,pressure);else{target.hitDirection=enemy.facing;this.damage(target,enemy.damage*pressure,state);}enemy.attackCooldown=enemy.attackInterval;enemy.attackFlash=.2;state.effects.push({type:'hit',x:target.x,y:target.y,life:.2,maxLife:.2,radius:14,color:'#d96c5c'});}
  }
  fireBurst(enemy,target,state,pressure=1){for(let i=0;i<enemy.burst;i++){const spread=(i-(enemy.burst-1)/2)*.11,angle=Math.atan2(target.y-enemy.y,target.x-enemy.x)+spread,speed=170+state.difficulty*12;state.projectiles.push({id:`shot-${enemy.id}-${state.battleElapsed}-${i}`,x:enemy.x,y:enemy.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,damage:enemy.damage*pressure*(enemy.burst>1?.72:1),radius:5,life:3,color:enemy.elite?'#ff5265':'#e14d5a'});}}
  fireHeroArrow(unit,target,state){const dx=target.x-unit.x,dy=target.y-unit.y,d=Math.hypot(dx,dy)||1,speed=410;state.projectiles.push({id:`arrow-${unit.instanceId||unit.id}-${state.battleElapsed.toFixed(3)}`,team:'ally',sourceId:unit.instanceId||unit.id,x:unit.x+unit.facing*12,y:unit.y-20,vx:dx/d*speed,vy:dy/d*speed,damage:this.attackDamage(unit,state),radius:7,life:2.4,color:'#75baff',kind:'arrow'});}
  updateProjectiles(state,allies,dt){for(const shot of state.projectiles){const fromX=shot.x,fromY=shot.y;shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.life-=dt;const dx=shot.x-fromX,dy=shot.y-fromY,lenSq=dx*dx+dy*dy,candidates=shot.team==='ally'?state.enemies.filter(unit=>!unit.dead):allies.filter(unit=>unit.currentHp>0),target=candidates.find(unit=>{const t=lenSq?Math.max(0,Math.min(1,((unit.x-fromX)*dx+(unit.y-fromY)*dy)/lenSq)):0,px=fromX+dx*t,py=fromY+dy*t;return Math.hypot(unit.x-px,unit.y-py)<shot.radius+(unit.boss?28:18);});if(target){target.hitDirection=shot.vx<0?-1:1;this.damage(target,shot.damage,state);shot.life=0;shot.x=target.x;shot.y=target.y;state.effects.push({type:'hit',x:target.x,y:target.y,life:.3,maxLife:.3,radius:22,color:shot.color});}}state.projectiles=state.projectiles.filter(shot=>shot.life>0&&shot.x>-20&&shot.x<980&&shot.y>-20&&shot.y<620);}
  updateLoneHeroPressure(state,front,dt){if(!state.loneHero||state.battleElapsed<10||!front[0])return;state.lonePressureTick+=dt;if(state.lonePressureTick<.5)return;const hero=front[0],rate=.012+state.battleElapsed/state.battleDuration*.024;hero.currentHp-=hero.maxHp*rate*state.lonePressureTick;state.lonePressureTick=0;hero.surrounded=true;if(hero.currentHp<=0){hero.currentHp=0;hero.dead=true;}}
  formationPressure(state){return state.deployedCount>=4?.62:state.deployedCount===3?.76:state.deployedCount===2?.9:1.35;}
  attackDamage(unit,state){let multiplier=1;if(unit.role==='archer')multiplier*=state.synergyEffects?.rangedPower||1;if(['spear','shield','cavalry'].includes(unit.role))multiplier*=state.synergyEffects?.martialPower||1;return unit.damage*multiplier;}
  updateEffects(state,dt){for(const effect of state.effects){effect.life-=dt;}state.effects=state.effects.filter(effect=>effect.life>0).slice(-180);}
  damage(target,amount,state){const adjusted=amount*(1-(target.synergy?.damageReduction||0)),absorbed=Math.min(target.shield||0,adjusted),dealt=Math.max(0,adjusted-absorbed);target.shield=Math.max(0,(target.shield||0)-absorbed);target.currentHp-=dealt;target.hitFlash=.14;target.hitStrength=Math.min(1,(target.hitStrength||0)+Math.min(1,Math.max(.12,dealt/80)));if(state){state.screenShake=Math.max(state.screenShake||0,target.boss?2.8:.35);if(dealt>0&&state.effects.length<180)state.effects.push({type:'text',text:`-${Math.round(dealt)}`,x:target.x,y:target.y-24,life:.68,maxLife:.68,color:state.roster.includes(target)||state.summons?.includes(target)?'#ffb18c':'#ffe4a0'});}if(target.currentHp<=0){target.currentHp=0;target.dead=true;}}
  separation(unit,allies){let x=0,y=0;for(const other of allies){if(other===unit||other.dead)continue;const dx=unit.x-other.x,dy=unit.y-other.y,d=Math.hypot(dx,dy);if(d>0&&d<48){const force=(48-d)/48*.7;x+=dx/d*force;y+=dy/d*force;}}return {x,y};}
}
