import {ellipse,glow} from '../primitives.js';
export function drawRock(ctx,p,time){const r=p.radius;

      ctx.beginPath();ctx.moveTo(-r,r*.1);ctx.lineTo(-r*.75,-r*.62);ctx.lineTo(-r*.12,-r);ctx.lineTo(r*.67,-r*.6);ctx.lineTo(r,r*.2);ctx.lineTo(r*.35,r*.5);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#c0c7ad70';ctx.beginPath();ctx.moveTo(-r*.75,-r*.62);ctx.lineTo(0,-r*.35);ctx.lineTo(r*.67,-r*.6);ctx.moveTo(0,-r*.35);ctx.lineTo(r*.35,r*.5);ctx.stroke();
    
}
