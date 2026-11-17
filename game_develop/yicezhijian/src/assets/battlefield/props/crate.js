import {ellipse,glow} from '../primitives.js';
export function drawCrate(ctx,p,time){const r=p.radius;

      ctx.fillRect(-r,-r*1.5,r*2,r*1.7);ctx.strokeRect(-r,-r*1.5,r*2,r*1.7);ctx.strokeStyle='#c2aa78';ctx.lineWidth=3;ctx.strokeRect(-r+4,-r*1.5+4,r*2-8,r*1.7-8);ctx.beginPath();ctx.moveTo(-r+4,-r*1.5+4);ctx.lineTo(r-4,r*.2-4);ctx.stroke();
    
}
