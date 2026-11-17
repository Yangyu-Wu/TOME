import {ellipse,glow} from '../primitives.js';
export function drawBarricade(ctx,p,time){const r=p.radius;

      ctx.strokeStyle='#a28660';ctx.lineWidth=6;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*19-12,9);ctx.lineTo(i*19+10,-30);ctx.moveTo(i*19+12,9);ctx.lineTo(i*19-10,-30);ctx.stroke();}ctx.strokeStyle='#d5b985';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-r-6,-12);ctx.lineTo(r+6,-12);ctx.stroke();
    
}
