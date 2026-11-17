import {glow,star,circle} from './primitives.js';
import {drawTornado} from './tornado.js';
const TAU=Math.PI*2,clamp=t=>Math.max(0,Math.min(1,t)),ease=t=>1-(1-t)**3;
export function drawParticle(ctx,p){
    const a=clamp(p.life/p.maxLife);ctx.save();ctx.globalAlpha=a*(p.kind==='smoke'?.14:1);ctx.translate(p.x,p.y-p.z);ctx.rotate(p.rotation);
    if(p.kind==='smoke'){glow(ctx,0,0,p.size,p.color,.7);}
    else if(p.kind==='debris'||p.kind==='dust'){ctx.globalCompositeOperation='source-over';ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*.65);}
    else {ctx.strokeStyle=p.color;ctx.lineWidth=p.size*.65;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-p.vx*.035,-(p.vy-p.vz)*.035);ctx.stroke();if(p.kind==='ember')glow(ctx,0,0,p.size*3,p.color,.4);}
    ctx.restore();
  }
