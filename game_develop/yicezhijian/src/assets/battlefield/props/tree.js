import {ellipse,glow} from '../primitives.js';
export function drawTree(ctx,p,time){const r=p.radius;

      const sway=Math.sin(time*1.3+p.id)*3;ctx.fillStyle='#685341';ctx.beginPath();ctx.moveTo(-9,3);ctx.lineTo(-4+sway,-70);ctx.lineTo(4+sway,-73);ctx.lineTo(9,3);ctx.fill();
      for(let i=0;i<5;i++){const x=Math.cos(i*2.4)*22+sway,y=-65+Math.sin(i*2.4)*12;const leaf=ctx.createRadialGradient(x-5,y-12,2,x,y,31);leaf.addColorStop(0,'#66846c');leaf.addColorStop(1,'#233c3a');ellipse(ctx,x,y,29,22,leaf);}
    
}
