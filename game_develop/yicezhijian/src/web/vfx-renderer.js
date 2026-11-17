import {drawParticle} from '../assets/effects/particle.js';
import {drawWave} from '../assets/effects/wave.js';
import {drawField} from '../assets/effects/field.js';
import {HERO_BY_ID,drawHeroModel} from '../heroes/index.js';
import {glow,star,circle} from '../assets/effects/primitives.js';
import {drawDragon} from '../assets/effects/dragon.js';
import {drawPhoenix} from '../assets/effects/phoenix.js';
import {drawConstellation} from '../assets/effects/constellation.js';
import {drawTornado} from '../assets/effects/tornado.js';
import {flightPoint,drawFlightTrail,drawFlightMotionBlur} from '../assets/effects/flight-path.js';
import {drawBossEntrance} from '../assets/effects/boss-entrance.js';
export {glow,drawDragon,drawPhoenix,drawConstellation,drawTornado};
const TAU=Math.PI*2;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const ease=t=>1-(1-t)**3;

export class VfxRenderer {
  bossEntrance(ctx,entrance,w,h){drawBossEntrance(ctx,entrance,w,h);}
  constructor(canvas){this.bloom=canvas.ownerDocument.createElement('canvas');this.bloom.width=960;this.bloom.height=600;this.glowCtx=this.bloom.getContext('2d');}

  draw(ctx,state){
    const time=state.visualTime||0;
    // Smoke remains opaque; bright particles and spells accumulate light.
    for(const p of state.particles||[])if(p.kind==='smoke')this.particle(ctx,p);
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const field of state.fields||[])this.field(ctx,field,time);
    for(const flight of state.skillFlights||[])if(flight.age>=0)this.flight(ctx,flight,state,time);
    for(const wave of state.shockwaves||[])this.wave(ctx,wave);
    for(const p of state.particles||[])if(p.kind!=='smoke')this.particle(ctx,p);
    for(const l of state.lights||[])glow(ctx,l.x,l.y,l.radius*.45,l.color,l.life/l.maxLife*.5);
    ctx.restore();this.bloomPass(ctx,state);
  }

  particle(ctx,p){drawParticle(ctx,p);}

  wave(ctx,w){drawWave(ctx,w);}

  field(ctx,f,time){drawField(ctx,f,time);}

  flightPoint(f,state){
    return flightPoint(f,state);
  }
  flight(ctx,f,state,time){
    const {x,y,t,target,angle}=this.flightPoint(f,state),u=f.ultimate;ctx.save();
    drawFlightMotionBlur(ctx,f,state,{x,y,angle});
    drawFlightTrail(ctx,f,state);
    glow(ctx,x,y,72,u.color,.4);
    if(u.theme==='dragon'){
      // Anchor the snout on the flight curve so the body trails behind the impact.
      const scale=.32+Math.sin(t*Math.PI)*.25;
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
      drawDragon(ctx,-192,-Math.sin(TAU*1.15-time*2)*38*1.3,1,time,u.color);ctx.restore();
    }
    else if(u.theme==='inferno'){
      ctx.save();ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);const scale=.25+Math.sin(t*Math.PI)*.18;
      drawPhoenix(ctx,0,0,scale,time,u.color);ctx.restore();
    }
    else if(u.theme==='seven-stars'||u.theme==='thunder'){
      ctx.strokeStyle=u.color;ctx.lineWidth=9;ctx.globalAlpha=.45;ctx.beginPath();ctx.moveTo(x-(target.x-f.origin.x)*.18,y-(target.y-f.origin.y)*.18);ctx.lineTo(x,y);ctx.stroke();ctx.globalAlpha=1;ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.stroke();star(ctx,x,y,15,u.secondary,time*4);
    }else if(u.theme==='tornado'){drawTornado(ctx,x,y,.55,time,u.color);}
    else if(u.theme==='sonic'){
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(target.y-f.origin.y,target.x-f.origin.x));ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(45,0);ctx.lineTo(-75,-5);ctx.lineTo(-100,0);ctx.lineTo(-75,5);ctx.fill();for(let i=0;i<4;i++){ctx.strokeStyle=u.color;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(-i*25,0,9,12+i*8,0,0,TAU);ctx.stroke();}ctx.restore();
    }else {circle(ctx,x,y,24,u.color,4);star(ctx,x,y,36,u.secondary,time*5);}
    // A target rune makes the landing location readable underneath the spectacle.
    if(!f.exitPoint){ctx.globalAlpha=.2+t*.5;ctx.save();ctx.translate(target.x,target.y);ctx.scale(1,.55);circle(ctx,0,0,u.radius*(1-.25*t),u.color,1.5);ctx.restore();}ctx.restore();
  }

  bloomPass(ctx,state){
    const g=this.glowCtx;g.clearRect(0,0,960,600);g.save();g.globalCompositeOperation='lighter';
    for(const l of state.lights||[])glow(g,l.x,l.y,l.radius*.55,l.color,l.life/l.maxLife*.38);
    for(const f of state.skillFlights||[])if(f.age>=0){const p=this.flightPoint(f,state);glow(g,p.x,p.y,75,f.ultimate.color,.3);}
    for(const f of state.fields||[])glow(g,f.x,f.y-20,f.radius*.9,f.color,.14);
    // Radial gradients are already soft. Avoid an extra full-frame blur at 2x density.
    g.restore();ctx.save();ctx.globalCompositeOperation='screen';ctx.drawImage(this.bloom,0,0,960,600);ctx.restore();
  }

  cinematic(ctx,cast,w,h,time){
    if(!cast)return;const t=clamp(cast.age/cast.duration),u=cast.ultimate,enter=clamp(t*7),fade=clamp((1-t)*7),a=Math.min(enter,fade);
    ctx.save();ctx.globalAlpha=a;ctx.fillStyle='#040914f5';ctx.fillRect(0,0,w,h);
    const g=ctx.createLinearGradient(0,h,w,0);g.addColorStop(0,'#071922');g.addColorStop(.5,'#101a2c');g.addColorStop(1,'#050a18');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.globalCompositeOperation='screen';glow(ctx,w*.68,h*.45,340,u.color,.18);
    for(let i=0;i<65;i++){const x=(i*167+time*180)%w,y=(i*79)%h;ctx.strokeStyle=i%3?u.color:u.secondary;ctx.globalAlpha=.04+(i%5)*.02;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+30+i%4*30,y-9);ctx.stroke();}ctx.restore();
    ctx.save();ctx.translate(w*.69,h*.44);ctx.rotate(-.15);ctx.strokeStyle=u.color;ctx.globalAlpha=.15;ctx.lineWidth=1;for(let i=0;i<4;i++)circle(ctx,0,0,140+i*25,u.color);ctx.restore();
    // Full-height warrior silhouette, cape, and bespoke weapon are drawn at native resolution.
    const hero=HERO_BY_ID[cast.heroId];ctx.save();ctx.translate(230+(1-ease(enter))*-100,330);ctx.scale(3.1,3.1);
    ctx.fillStyle=u.color;ctx.globalAlpha=.15;ctx.beginPath();ctx.moveTo(-12,-10);ctx.bezierCurveTo(-65,8,-30,40,-70,55);ctx.lineTo(40,55);ctx.lineTo(12,-10);ctx.fill();ctx.globalAlpha=1;
    if(hero)drawHeroModel(ctx,{...hero,x:0,y:0,moving:false,walkPhase:time*2,currentHp:100,star:3,facing:1,skillFlash:1},{scale:1.4});ctx.restore();
    ctx.save();ctx.globalCompositeOperation='lighter';
    if(u.theme==='dragon')drawDragon(ctx,650,265,1.23,time,u.color);
    else if(u.theme==='inferno')drawPhoenix(ctx,660,245,1.13,time,u.color);
    else if(u.theme==='seven-stars')drawConstellation(ctx,655,270,1.45,time);
    else if(u.theme==='tornado')drawTornado(ctx,650,390,1.9,time,u.color);
    else if(u.theme==='eclipse'||u.theme==='moon'){
      glow(ctx,660,260,160,u.color,.28);circle(ctx,660,260,94,u.color,6);ctx.fillStyle='#090c1a';ctx.beginPath();ctx.arc(684,240,92,0,TAU);ctx.fill();for(let i=0;i<24;i++){const a=i*2.4+time*.4;star(ctx,660+Math.cos(a)*(90+i%5*18),260+Math.sin(a)*(90+i%5*18),3+i%4,u.secondary,time);}
    }else if(u.theme==='thunder'){
      for(let i=0;i<5;i++){ctx.strokeStyle=i%2?u.color:'#ffffff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(520+i*55,90);ctx.lineTo(500+i*55,180);ctx.lineTo(540+i*55,210);ctx.lineTo(515+i*55,370);ctx.stroke();}glow(ctx,650,310,160,u.color,.3);
    }else{
      for(let i=0;i<6;i++){ctx.save();ctx.translate(660,260);ctx.rotate(-.45);ctx.strokeStyle=i%2?u.color:u.secondary;ctx.lineWidth=i%2?3:1;ctx.beginPath();ctx.ellipse(0,0,55+i*19,80+i*24,0,0,TAU);ctx.stroke();ctx.restore();}
      ctx.strokeStyle='#fff2ce';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(520,390);ctx.lineTo(770,125);ctx.stroke();star(ctx,750,145,65,u.color,-.7);glow(ctx,650,260,110,u.color,.2);
    }
    ctx.restore();
    ctx.fillStyle='#050b14dd';ctx.fillRect(0,425,w,175);ctx.strokeStyle=u.color;ctx.globalAlpha=a*.65;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(45,425);ctx.lineTo(w-45,425);ctx.stroke();ctx.globalAlpha=a;
    ctx.fillStyle=u.secondary;ctx.font='600 14px serif';ctx.textAlign='left';ctx.fillText('绝  技  ·  天  地  共  鸣',62,65);
    ctx.fillStyle='#f5e6bf';ctx.font='900 46px serif';ctx.fillText(cast.name,62,132);
    ctx.fillStyle=u.secondary;ctx.textAlign='center';ctx.font='900 45px serif';ctx.shadowColor=u.color;ctx.shadowBlur=22;ctx.fillText(u.name,w/2,482);ctx.shadowBlur=0;
    ctx.font='16px serif';ctx.fillStyle='#c9d8df';ctx.fillText(u.epithet,w/2,522);
    ctx.fillStyle='#233447';ctx.fillRect(w*.33,551,w*.34,2);ctx.fillStyle=u.color;ctx.fillRect(w*.33,551,w*.34*t,2);
    ctx.strokeStyle='#a1adb14f';ctx.strokeRect(20,20,w-40,h-40);ctx.restore();
  }
}
