import {ellipse,glow} from '../primitives.js';
export function drawTorch(ctx,p,time){const r=p.radius;

      ctx.strokeStyle='#6c5946';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,3);ctx.lineTo(0,-40);ctx.stroke();ctx.fillStyle='#222d32';ctx.fillRect(-8,-43,16,9);
      glow(ctx,0,-42,36,'#ff993e',.3+Math.sin(time*9+p.id)*.04);ctx.fillStyle='#ffad42';ctx.beginPath();ctx.moveTo(-6,-42);ctx.quadraticCurveTo(-7,-54,Math.sin(time*8+p.id)*5,-66);ctx.quadraticCurveTo(13,-50,6,-42);ctx.fill();ellipse(ctx,0,-47,3,7,'#fff1b0');
    
}
