import {glow,star,circle} from './primitives.js';
import {drawTornado} from './tornado.js';
const TAU=Math.PI*2,clamp=t=>Math.max(0,Math.min(1,t)),ease=t=>1-(1-t)**3;
export function drawWave(ctx,w){
    const t=clamp(w.age/w.duration),r=w.radius*(.2+ease(t)*1.9),a=(1-t)**1.3;ctx.save();ctx.globalAlpha=a;
    ctx.translate(w.x,w.y);ctx.scale(1,.63);
    for(let i=0;i<3;i++)circle(ctx,0,0,r-i*9,w.color,(1-t)*(i===0?5:2));
    if(w.theme==='airburst'||w.theme==='sonic'){
      for(let i=0;i<18;i++){const ang=i*TAU/18;ctx.strokeStyle=i%2?'#effbff':w.color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(Math.cos(ang)*r*.8,Math.sin(ang)*r*.8);ctx.lineTo(Math.cos(ang)*r*1.24,Math.sin(ang)*r*1.24);ctx.stroke();}
      ctx.scale(1,1/.63);ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-r*.25,r*.55,r*.8,0,-Math.PI,0);ctx.stroke();
    }
    if(w.theme==='seven-stars'){star(ctx,0,0,50*(1-t), '#ffffff',t);}
    if(w.theme==='thunder'){ctx.scale(1,1/.63);ctx.strokeStyle='#f2f0ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-180*(1-t));ctx.lineTo(-18,-90);ctx.lineTo(12,-60);ctx.lineTo(0,0);ctx.stroke();}
    ctx.restore();
  }
