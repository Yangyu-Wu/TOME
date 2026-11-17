import {glow,star,circle} from './primitives.js';
const TAU=Math.PI*2;
export function drawPhoenix(ctx,x,y,scale,time,color='#ff7636'){
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.translate(x,y);ctx.scale(scale,scale);const flap=Math.sin(time*14)*.38;
  for(const side of [-1,1]){ctx.save();ctx.scale(side,1);ctx.rotate(flap);for(let i=8;i>=0;i--){const spread=i/8;ctx.fillStyle=i%2?'#ff963f':color;ctx.globalAlpha=.6+spread*.4;ctx.beginPath();ctx.moveTo(0,15);ctx.bezierCurveTo(50,-40,80+spread*100,-115+spread*25,170+spread*25,-70+spread*45);ctx.bezierCurveTo(110+spread*60,-5,55+spread*20,35,0,25);ctx.fill();ctx.strokeStyle='#ffeab0';ctx.lineWidth=.8;ctx.stroke();}ctx.restore();}
  ctx.globalAlpha=1;glow(ctx,0,15,72,'#ffac43',.45);
  for(let i=0;i<7;i++){ctx.strokeStyle=i%2?'#ffca70':'#ff642e';ctx.lineWidth=6-i*.5;ctx.beginPath();ctx.moveTo(0,20);ctx.bezierCurveTo((i-3)*18,80,Math.sin(time*3+i)*60,105,(i-3)*25+Math.sin(time*4+i)*15,150-i%3*12);ctx.stroke();}
  ctx.fillStyle='#fff1c0';ctx.beginPath();ctx.moveTo(-12,24);ctx.quadraticCurveTo(-20,-14,0,-43);ctx.lineTo(11,-57);ctx.lineTo(15,-38);ctx.lineTo(36,-29);ctx.lineTo(15,-22);ctx.quadraticCurveTo(22,3,9,26);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#ffda77';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-43);ctx.quadraticCurveTo(-30,-65,-20,-82);ctx.moveTo(0,-43);ctx.quadraticCurveTo(-10,-65,3,-76);ctx.stroke();ctx.restore();
}
