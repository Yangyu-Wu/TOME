import {ultimateFor} from './ultimates.js';

const alive=list=>list.filter(unit=>!unit.dead&&unit.currentHp>0);
const nearest=(source,list)=>alive(list).sort((a,b)=>Math.hypot(source.x-a.x,source.y-a.y)-Math.hypot(source.x-b.x,source.y-b.y))[0];
const starPower=unit=>1+(unit.star-1)*.55;

function damage(target,amount,effects=[]){
  const absorbed=Math.min(target.shield||0,amount);target.shield=Math.max(0,(target.shield||0)-absorbed);
  const dealt=Math.max(0,amount-absorbed);target.currentHp-=dealt;target.hitFlash=.14;target.hitStrength=Math.min(1,(target.hitStrength||0)+Math.min(1,Math.max(.12,dealt/80)));if(dealt>0&&effects.length<180)effects.push({type:'text',text:`-${Math.round(dealt)}`,x:target.x,y:target.y-24,life:.72,maxLife:.72,color:'#ffe2a0'});if(target.currentHp<=0){target.currentHp=0;target.dead=true;}
}
function heal(target,amount,effects){const restored=Math.min(target.maxHp-target.currentHp,amount);target.currentHp+=restored;if(restored>0&&effects.length<180)effects.push({type:'text',text:`+${Math.round(restored)}`,x:target.x,y:target.y-24,life:.85,maxLife:.85,color:'#8df0aa'});}
function inRadius(origin,list,radius){return alive(list).filter(unit=>Math.hypot(origin.x-unit.x,origin.y-unit.y)<=radius);}

export function tickStatuses(unit,dt){
  unit.statuses=(unit.statuses||[]).filter(status=>{
    status.remaining-=dt;
    if(status.type==='burn'){status.tick=(status.tick||0)-dt;if(status.tick<=0){damage(unit,status.power);status.tick=.5;}}
    return status.remaining>0&&!unit.dead;
  });
}

export function executeHeroSkill(caster,{allies,enemies,summons=[],effects=[],impactPoint,strikeIndex,quiet=false}){
  effects=effects||[];
  const skill=caster.skill,targets=alive(enemies),friends=alive(allies),target=nearest(impactPoint||caster,targets),ultimate=ultimateFor(caster);
  if(!skill||(!target&&!['heal','shield','haste','summon'].includes(skill.type)))return false;
  const power=caster.damage*skill.power*starPower(caster)*(caster.synergy?.skillPower||1)*(caster.role==='archer'?(caster.synergy?.rangedPower||1):1);
  if(ultimate){
    const origin=impactPoint||target||caster,area=inRadius(origin,targets,skill.radius);
    if(ultimate.theme==='seven-stars'){
      // The director invokes each falling star on contact; standalone calls resolve the full constellation.
      const victims=strikeIndex===undefined?targets.slice(0,7):target&&Math.hypot(target.x-origin.x,target.y-origin.y)<=skill.radius?[target]:[];
      for(const enemy of victims)damage(enemy,power,effects);
      for(const friend of friends)friend.shield=Math.min(friend.maxHp*.4,(friend.shield||0)+power*.4);
    }else{
      for(const enemy of area){
        damage(enemy,power*(enemy===target?1:.72),effects);
        if(ultimate.theme==='inferno'&&!enemy.dead)enemy.statuses.push({type:'burn',power:power*.12,remaining:4,tick:.5});
        if(['airburst','moon','thunder'].includes(ultimate.theme)&&!enemy.dead)enemy.statuses.push({type:'stun',remaining:ultimate.theme==='moon'?1.6:.65});
      }
      if(ultimate.theme==='eclipse')heal(caster,power*.6,effects);
      if(ultimate.theme==='dragon')for(const friend of friends){friend.statuses.push({type:'haste',remaining:3,power:.35});friend.shield=Math.min(friend.maxHp*.35,(friend.shield||0)+power*.5);}
    }
  }else switch(skill.type){
    case 'single':damage(target,power*1.65,effects);break;
    case 'area':for(const enemy of inRadius(target,targets,skill.radius))damage(enemy,power,effects);break;
    case 'heal':for(const friend of [...friends].sort((a,b)=>a.currentHp/a.maxHp-b.currentHp/b.maxHp).slice(0,2))heal(friend,power*1.15,effects);break;
    case 'shield':for(const friend of friends)friend.shield=(friend.shield||0)+power*.85;break;
    case 'burn':damage(target,power*.65,effects);target.statuses.push({type:'burn',power:power*.13,remaining:skill.duration,tick:.5});break;
    case 'stun':damage(target,power*.8,effects);target.statuses.push({type:'stun',remaining:Math.min(2.5,skill.duration)});break;
    case 'haste':for(const friend of friends)friend.statuses.push({type:'haste',remaining:skill.duration,power:.35});break;
    case 'drain':damage(target,power*1.1,effects);heal(caster,power*.65,effects);break;
    case 'chain':for(const enemy of targets.slice(0,Math.min(4,1+caster.star)))damage(enemy,power*.78,effects);break;
    case 'summon':{const owned=summons.filter(unit=>unit.ownerId===caster.instanceId&&!unit.dead);if(owned.length<3){const index=summons.length;summons.push({id:`summon-${caster.instanceId}-${index}`,ownerId:caster.instanceId,name:`${caster.name}亲兵`,role:'spear',x:caster.x+32+owned.length*12,y:caster.y+18,maxHp:Math.round(caster.maxHp*.35),currentHp:Math.round(caster.maxHp*.35),damage:Math.round(caster.damage*.55),speed:58,range:35,attackCooldown:0,skillCooldown:99,shield:0,statuses:[],dead:false,summoned:true,visual:caster.visual});}break;}
    default:return false;
  }
  caster.lastSkill=skill.name;caster.skillFlash=.5;
  if(!quiet)effects.push({type:'skill',skillType:skill.type,theme:ultimate?.theme,heroId:caster.heroId||caster.id,x:caster.x,y:caster.y,targetX:target?.x??caster.x,targetY:target?.y??caster.y,color:ultimate?.color||caster.rarityColor||'#e2bd68',life:.9,maxLife:.9,radius:skill.radius||55});
  return true;
}
