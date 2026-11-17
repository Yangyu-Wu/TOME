import {glow,star,circle} from './primitives.js';
const TAU=Math.PI*2;
export function drawTornado(ctx,x,y,scale,time,color='#96ffe0'){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  ctx.fillStyle=color;ctx.globalAlpha=.08;ctx.beginPath();ctx.moveTo(-75,-145);ctx.bezierCurveTo(-40,-95,-18,-45,-9,0);ctx.lineTo(9,0);ctx.bezierCurveTo(18,-45,40,-95,75,-145);ctx.quadraticCurveTo(0,-170,-75,-145);ctx.fill();ctx.globalAlpha=1;
  for(let i=0;i<17;i++){const t=i/16,r=10+t*66,yy=-t*145,shift=Math.sin(time*5+t*5)*12;ctx.strokeStyle=i%3===0?'#efffff':color;ctx.globalAlpha=.18+t*.55;ctx.lineWidth=2+t*3;ctx.beginPath();ctx.ellipse(shift,yy,r,8+t*15,Math.sin(time+t)*.05,time*9+i*.6,time*9+i*.6+Math.PI*1.7);ctx.stroke();}
  ctx.globalAlpha=.8;for(let i=0;i<16;i++){const t=(i/16+time*.3)%1,a=time*8+i*2.4,r=14+t*62;ctx.save();ctx.translate(Math.cos(a)*r,-t*140+Math.sin(a)*r*.25);ctx.rotate(a);ctx.fillStyle=i%3?'#c5c1a0':color;ctx.fillRect(-2,-2,5+i%3,3);ctx.restore();}ctx.restore();
}
