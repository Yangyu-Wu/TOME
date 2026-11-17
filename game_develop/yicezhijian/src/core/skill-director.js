import {executeHeroSkill} from '../heroes/skill-system.js';
import {ultimateFor} from '../heroes/ultimates.js';
import {emitParticles,impactVfx,VFX_LIMITS} from './battle-vfx.js';
import {flightPoint,flightExit} from '../assets/effects/flight-path.js';

const living=state=>state.enemies.filter(e=>!e.dead&&e.currentHp>0);
const friends=state=>[...state.roster.filter(u=>u.slot==='front'&&u.currentHp>0),...state.summons.filter(u=>!u.dead)];
const findCaster=(state,cast)=>state.roster.find(u=>u.instanceId===cast.casterId);

export function queueSkill(state,caster){
  if(caster.pendingCast)return false;
  const targets=living(state).sort((a,b)=>Math.hypot(a.x-caster.x,a.y-caster.y)-Math.hypot(b.x-caster.x,b.y-caster.y)),target=targets[0],ultimate=ultimateFor(caster);
  if(!ultimate){
    const ok=executeHeroSkill(caster,{allies:friends(state),enemies:state.enemies,summons:state.summons,effects:state.effects});
    if(ok){
      const supportive=['heal','shield','haste','summon'].includes(caster.skill.type),x=supportive?caster.x:target?.x??caster.x,y=supportive?caster.y:target?.y??caster.y;
      emitParticles(state,{x,y,count:24,color:caster.rarityColor,speed:95,seed:state.castSequence++});
      state.lights.push({x,y,radius:90,color:caster.rarityColor,life:.45,maxLife:.45});
      state.lights=state.lights.slice(-VFX_LIMITS.lights);
      if(!supportive&&target)impactVfx(state,{x,y,radius:45,theme:'arcane',color:caster.rarityColor,force:20,power:25,targets:[]});
    }
    return ok;
  }
  if(!target)return false;
  const cast={id:++state.castSequence,casterId:caster.instanceId,heroId:caster.heroId,name:caster.name,ultimate,origin:{x:caster.x,y:caster.y},targets:targets.slice(0,ultimate.strikes||1).map(u=>({id:u.id,x:u.x,y:u.y})),age:0};
  caster.pendingCast=true;state.skillQueue.push(cast);
  state.events.push({type:'ultimate-queued',heroId:cast.heroId,castId:cast.id,at:state.visualTime});
  return true;
}

export function updateSkillDirector(state,dt){
  state.cinematicGap=Math.max(0,(state.cinematicGap||0)-dt);
  if(!state.cinematic&&state.skillFlights.length===0&&state.cinematicGap<=0&&state.skillQueue.length){
    let cast=state.skillQueue.shift(),caster=findCaster(state,cast);
    if(caster&&!caster.dead&&caster.currentHp>0){
      cast.duration=state.ultimateSeen[cast.heroId]?.72:1.2;state.ultimateSeen[cast.heroId]=true;cast.age=0;cast.origin={x:caster.x,y:caster.y};
      state.cinematic=cast;caster.casting=true;caster.skillFlash=cast.duration;
      state.events.push({type:'ultimate-cinematic',heroId:cast.heroId,castId:cast.id,at:state.visualTime});
    }else if(caster)caster.pendingCast=false;
  }
  const active=state.cinematic;
  if(active){
    active.age+=dt;
    if(active.age>=active.duration){
      const caster=findCaster(state,active),strikes=active.ultimate.strikes||1;
      for(let i=0;i<strikes;i++){
        const target=active.targets[i%active.targets.length];
        const theme=active.ultimate.theme,duration=theme==='sonic'?.45:['dragon','inferno'].includes(theme)?1.12:.78;
        const exitPoint=['dragon','inferno'].includes(theme)?flightExit(active.origin,target):null;
        state.skillFlights.push({...active,age:-i*.13,duration,strike:i,last:i===strikes-1,target:{...target},exitPoint,hitIds:[],origin:theme==='seven-stars'?{x:260+i*64,y:45}:active.origin});
      }
      if(caster)caster.casting=false;
      state.events.push({type:'ultimate-launch',heroId:active.heroId,castId:active.id,at:state.visualTime});
      state.cinematic=null;
    }
  }
  for(const flight of state.skillFlights){
    // If an earlier star killed its target, visibly home to a living replacement.
    if(!flight.exitPoint&&!state.enemies.some(e=>e.id===flight.target.id&&!e.dead)){
      const replacement=living(state).sort((a,b)=>Math.hypot(a.x-flight.target.x,a.y-flight.target.y)-Math.hypot(b.x-flight.target.x,b.y-flight.target.y))[0];
      if(replacement)flight.target={id:replacement.id,x:replacement.x,y:replacement.y};
    }
    const previous=flightPoint(flight,state);flight.age+=dt;
    if(flight.exitPoint&&flight.age>=0){
      const point=flightPoint(flight,state),dx=point.x-previous.x,dy=point.y-previous.y,len2=dx*dx+dy*dy,caster=findCaster(state,flight);
      if(caster)for(const enemy of living(state)){
        if(flight.hitIds.includes(enemy.id))continue;
        const t=len2?Math.max(0,Math.min(1,((enemy.x-previous.x)*dx+(enemy.y-previous.y)*dy)/len2)):0;
        if(Math.hypot(enemy.x-previous.x-dx*t,enemy.y-previous.y-dy*t)>42+(enemy.boss?28:enemy.elite?14:0))continue;
        executeHeroSkill(caster,{allies:flight.hitIds.length?[]:friends(state),enemies:[enemy],effects:state.effects,impactPoint:enemy,quiet:true});
        flight.hitIds.push(enemy.id);
        impactVfx(state,{x:enemy.x,y:enemy.y,radius:46,theme:flight.ultimate.theme,color:flight.ultimate.color,force:flight.ultimate.force*.25,power:caster.damage,targets:[enemy]});
        state.events.push({type:'ultimate-impact',heroId:flight.heroId,castId:flight.id,targetId:enemy.id,strike:flight.strike,x:enemy.x,y:enemy.y,at:state.visualTime});
      }
      if(flight.age>=flight.duration){if(caster&&flight.last){caster.pendingCast=false;caster.skillCooldown=caster.skill.cooldown;state.cinematicGap=.55;}flight.done=true;}
      continue;
    }
    if(flight.age<flight.duration)continue;
    const caster=findCaster(state,flight);if(!caster){flight.done=true;continue;}
    const target=state.enemies.find(e=>e.id===flight.target.id&&!e.dead),point=target?{x:target.x,y:target.y}:flight.target,u=flight.ultimate,affected=living(state);
    executeHeroSkill(caster,{allies:friends(state),enemies:state.enemies,summons:state.summons,effects:state.effects,impactPoint:point,strikeIndex:flight.strike,quiet:true});
    impactVfx(state,{...point,radius:u.radius,theme:u.theme,color:u.color,force:u.force,power:caster.damage*u.power,targets:affected});
    state.events.push({type:'ultimate-impact',heroId:flight.heroId,castId:flight.id,strike:flight.strike,x:point.x,y:point.y,at:state.visualTime});
    if(flight.last){caster.pendingCast=false;caster.skillCooldown=caster.skill.cooldown;state.cinematicGap=.55;}
    flight.done=true;
  }
  state.skillFlights=state.skillFlights.filter(f=>!f.done);
}
