import {createBattlefield,scarGround,damageScenery,updateScenery} from './battlefield.js';

export const VFX_LIMITS=Object.freeze({particles:720,waves:36,fields:12,lights:24});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function initializeVfx(state) {
  state.visualTime=0;state.particles=[];state.shockwaves=[];state.fields=[];state.lights=[];state.battlefield=createBattlefield();
  state.skillQueue=[];state.skillFlights=[];state.cinematic=null;state.cinematicGap=0;state.castSequence=0;state.ultimateSeen={};
}

export function emitParticles(state,{x,y,count=20,color='#ffd995',speed=100,kind='spark',seed=0,z=4}){
  if(!state.particles)return;
  const room=VFX_LIMITS.particles-state.particles.length;
  for(let i=0;i<Math.min(room,count);i++){
    const a=i*2.399963+seed,force=speed*(.35+(i%13)/18),life=kind==='smoke'?1.8+i%5*.2:.45+(i%7)*.13;
    state.particles.push({x,y,z,vx:Math.cos(a)*force,vy:Math.sin(a)*force*.65,vz:kind==='smoke'?20:50+(i%9)*19,life,maxLife:life,size:kind==='smoke'?12+i%9:1.5+i%4,color,kind,rotation:a,spin:(i%2?1:-1)*4});
  }
}

export function impactVfx(state,{x,y,radius=70,theme='airburst',color='#ffd995',force=95,power=100,targets=[]}){
  if(!state.particles)return;
  const seed=state.castSequence||0;
  emitParticles(state,{x,y,count:theme==='inferno'?76:54,color,speed:190,seed,kind:theme==='inferno'?'ember':'spark'});
  emitParticles(state,{x,y,count:12,color:'#77858e',speed:75,seed:seed+2,kind:'smoke'});
  emitParticles(state,{x,y,count:14,color:'#b5a08a',speed:155,seed,kind:'debris'});
  state.shockwaves.push({x,y,radius,theme,color,age:0,duration:theme==='sonic'?.8:1.1});
  state.shockwaves=state.shockwaves.slice(-VFX_LIMITS.waves);
  state.lights.push({x,y,radius:radius*2.4,color,life:.7,maxLife:.7});state.lights=state.lights.slice(-VFX_LIMITS.lights);
  scarGround(state,x,y,radius*.65,theme,color);
  const fragments=damageScenery(state,x,y,radius,Math.max(theme==='arcane'?20:90,power*1.7),theme);
  state.particles.push(...fragments.slice(0,VFX_LIMITS.particles-state.particles.length));
  state.screenShake=Math.max(state.screenShake||0,theme==='airburst'?10:theme==='seven-stars'?3.5:7);
  for(const unit of targets){
    if(unit.dead&&unit.deathAge>.8)continue;const dx=unit.x-x,dy=unit.y-y,d=Math.hypot(dx,dy);
    if(d>radius+22)continue;const factor=1-clamp(d/(radius+50),0,.85),sign=force<0?-1:1,impulse=Math.abs(force)*factor;
    unit.hitDirection=(dx/(d||1)||.6)*sign>=0?1:-1;unit.hitStrength=Math.min(1,(unit.hitStrength||0)+factor*.55);unit.hitFlash=Math.max(unit.hitFlash||0,.14);
    unit.impulseX=(unit.impulseX||0)+(dx/(d||1)||.6)*impulse*sign;unit.impulseY=(unit.impulseY||0)+(dy/(d||1)||.4)*impulse*sign;
    unit.liftSpeed=Math.max(unit.liftSpeed||0,(theme==='airburst'?155:theme==='sonic'?100:60)*factor);unit.airHeight=Math.max(unit.airHeight||0,1);
  }
  if(theme==='inferno'||theme==='tornado'||theme==='eclipse'){
    state.fields.push({x,y,radius,color,theme,age:0,duration:theme==='inferno'?4:theme==='tornado'?2.7:1.8,emitClock:0});
    state.fields=state.fields.slice(-VFX_LIMITS.fields);
  }
}

export function updateVfx(state,dt){
  state.visualTime=(state.visualTime||0)+dt;updateScenery(state,dt);
  const particles=state.particles||[];
  for(const p of particles){
    p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.rotation+=p.spin*dt;
    if(p.kind==='smoke'){p.vx*=Math.exp(-dt);p.vy*=Math.exp(-dt);p.size+=dt*9;p.vz+=dt*5;}
    else {p.vz-=dt*310;if(p.z<0){p.z=0;p.vz=Math.abs(p.vz)*.28;p.vx*=.62;p.vy*=.62;}}
  }
  state.particles=particles.filter(p=>p.life>0).slice(-VFX_LIMITS.particles);
  for(const wave of state.shockwaves||[])wave.age+=dt;
  state.shockwaves=(state.shockwaves||[]).filter(w=>w.age<w.duration);
  for(const light of state.lights||[])light.life-=dt;
  state.lights=(state.lights||[]).filter(l=>l.life>0);
  for(const field of state.fields||[]){
    field.age+=dt;field.emitClock-=dt;
    if(field.emitClock<=0){field.emitClock=.09;const a=field.age*9,r=field.radius*(.25+Math.sin(field.age*7)**2*.45);emitParticles(state,{x:field.x+Math.cos(a)*r,y:field.y+Math.sin(a)*r*.5,count:field.theme==='tornado'?4:3,color:field.color,kind:field.theme==='inferno'?'ember':'spark',speed:field.theme==='tornado'?95:30,seed:field.age,z:field.theme==='tornado'?30+field.age*18:8});}
    if(field.theme==='tornado'||field.theme==='eclipse')for(const unit of state.enemies||[]){
      if(unit.dead)continue;const dx=unit.x-field.x,dy=unit.y-field.y,d=Math.hypot(dx,dy);
      if(d>field.radius||d<4)continue;
      unit.x+=(-dx*.4-dy*1.5)*dt;unit.y+=(-dy*.4+dx*1.5)*dt;
      unit.airHeight=Math.max(unit.airHeight||0,Math.sin(field.age*4)**2*20);unit.liftSpeed=Math.max(unit.liftSpeed||0,15);
    }
  }
  state.fields=(state.fields||[]).filter(f=>f.age<f.duration);
}

export function updateUnitPhysics(unit,dt){
  if(!unit.entering){unit.x=clamp(unit.x+(unit.impulseX||0)*dt,35,925);unit.y=clamp(unit.y+(unit.impulseY||0)*dt,116,566);}
  unit.impulseX=(unit.impulseX||0)*Math.exp(-5*dt);unit.impulseY=(unit.impulseY||0)*Math.exp(-5*dt);
  unit.hitStrength=(unit.hitStrength||0)*Math.exp(-7*dt);if(unit.hitStrength<.015)unit.hitStrength=0;
  if((unit.airHeight||0)>0||(unit.liftSpeed||0)>0){unit.liftSpeed=(unit.liftSpeed||0)-dt*380;unit.airHeight=Math.max(0,(unit.airHeight||0)+unit.liftSpeed*dt);if(unit.airHeight===0)unit.liftSpeed=0;}
}

export function clearVfx(state){
  for(const key of ['particles','shockwaves','fields','lights','skillQueue','skillFlights','effects'])state[key]=[];
  state.cinematic=null;state.bossEntrance=null;state.battlefield=null;state.screenShake=0;state.visualTime=0;
  for(const unit of [...(state.roster||[]),...(state.enemies||[]),...(state.summons||[])])Object.assign(unit,{pendingCast:false,casting:false,airHeight:0,impulseX:0,impulseY:0,liftSpeed:0,hitFlash:0,hitStrength:0,hitDirection:1,attackMotion:null,attackSequence:0,attackFlash:0});
}
