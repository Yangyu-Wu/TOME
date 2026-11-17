import {glow,star,circle} from './primitives.js';
const TAU=Math.PI*2;
const DIPPER=[[-126,-52],[-75,-76],[-28,-40],[25,-51],[68,-23],[53,39],[2,30]];
export function drawConstellation(ctx,x,y,scale,time){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.strokeStyle='#75bfff';ctx.lineWidth=1.5;ctx.beginPath();DIPPER.forEach(([sx,sy],i)=>i?ctx.lineTo(sx,sy):ctx.moveTo(sx,sy));ctx.lineTo(25,-51);ctx.stroke();
  for(let i=0;i<7;i++){const [sx,sy]=DIPPER[i];glow(ctx,sx,sy,22,'#6daeff',.65);star(ctx,sx,sy,8+Math.sin(time*3+i)*2,'#fff3bf',time*.3);ctx.fillStyle='#c5dfff';ctx.font='8px serif';ctx.textAlign='center';ctx.fillText(['天枢','天璇','天玑','天权','玉衡','开阳','摇光'][i],sx,sy+22);}
  ctx.strokeStyle='#c0dcff55';ctx.lineWidth=1;for(let k=0;k<3;k++)circle(ctx,0,0,110+k*16,'#c0dcff44');
  for(let i=0;i<12;i++){const a=i*Math.PI/6+time*.15;ctx.strokeStyle='#c0dcff88';ctx.beginPath();ctx.moveTo(Math.cos(a)*125,Math.sin(a)*125);ctx.lineTo(Math.cos(a)*140,Math.sin(a)*140);ctx.stroke();}
  ctx.restore();
}
