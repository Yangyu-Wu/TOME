import {armorColors,skinColors} from './palette.js';
export function portraitStyle(hero){return `--portrait:hsl(${hero.visual.portraitHue} 36% 38%);--accent:hsl(${hero.visual.accentHue} 58% 55%);--rarity:${hero.rarityColor}`;}
export function portraitMarkup(hero,star=1){return `<canvas class="generated-portrait" width="384" height="384" data-portrait="${hero.id}" data-star="${star}" style="${portraitStyle(hero)}" aria-label="${hero.name}头像"></canvas>`;}

export function drawHeroPortrait(ctx,hero,star=1){
  ctx.save();ctx.setTransform(ctx.canvas.width/128,0,0,ctx.canvas.height/128,0,0);const w=128,h=128,v=hero.visual;ctx.clearRect(0,0,w,h);const background=ctx.createRadialGradient(w*.5,h*.34,5,w*.5,h*.56,w*.74);background.addColorStop(0,`hsl(${v.accentHue} 56% 48%)`);background.addColorStop(1,`hsl(${v.portraitHue} 38% 14%)`);ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.globalAlpha=.23;ctx.strokeStyle='#fff0bd';ctx.lineWidth=1;for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(w/2,h/2,18+i*12,0,Math.PI*2);ctx.stroke();}ctx.restore();
  ctx.fillStyle=armorColors[v.armor%armorColors.length];ctx.beginPath();ctx.moveTo(11,119);ctx.quadraticCurveTo(15,82,45,78);ctx.lineTo(83,78);ctx.quadraticCurveTo(116,86,119,119);ctx.closePath();ctx.fill();ctx.strokeStyle='#151b25';ctx.lineWidth=4;ctx.stroke();
  ctx.fillStyle='#b8946b';ctx.beginPath();ctx.moveTo(48,67);ctx.lineTo(80,67);ctx.lineTo(84,90);ctx.lineTo(64,105);ctx.lineTo(43,88);ctx.closePath();ctx.fill();
  const skin=skinColors[v.skin%skinColors.length];ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(64,52,25,31,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#382d2b';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle=`hsl(${v.portraitHue} 35% 22%)`;ctx.beginPath();ctx.moveTo(39,51);ctx.lineTo(42,24);ctx.quadraticCurveTo(64,4,87,24);ctx.lineTo(90,51);ctx.lineTo(82,40);ctx.lineTo(47,39);ctx.closePath();ctx.fill();
  ctx.fillStyle=`hsl(${v.accentHue} 48% 38%)`;ctx.beginPath();ctx.moveTo(36,39);ctx.lineTo(42,13+(v.helmet%4)*2);ctx.lineTo(85,13);ctx.lineTo(93,40);ctx.lineTo(83,35);ctx.lineTo(45,35);ctx.closePath();ctx.fill();ctx.strokeStyle='#d7bd7c';ctx.lineWidth=2;ctx.stroke();
  if(v.plume){ctx.strokeStyle=`hsl(${v.accentHue} 75% 66%)`;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(64,14);ctx.bezierCurveTo(58,5-v.plume,75,7-v.plume*2,69,0);ctx.stroke();}
  ctx.strokeStyle='#382c29';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(48,50);ctx.lineTo(58,51);ctx.moveTo(70,51);ctx.lineTo(80,50);ctx.stroke();ctx.fillStyle='#201c20';ctx.fillRect(51,53,5,3);ctx.fillRect(72,53,5,3);
  ctx.strokeStyle='#734d43';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(58,67);ctx.quadraticCurveTo(64,71,70,67);ctx.stroke();
  ctx.fillStyle='#e1c582';ctx.beginPath();ctx.moveTo(44,81);ctx.lineTo(64,97);ctx.lineTo(84,81);ctx.lineTo(91,119);ctx.lineTo(36,119);ctx.closePath();ctx.fill();ctx.strokeStyle='#26303a';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='#f0dfb2';ctx.lineWidth=1;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(43+i*12,91);ctx.lineTo(38+i*13,115);ctx.stroke();}
  ctx.fillStyle=hero.rarityColor;ctx.beginPath();ctx.arc(w-17,h-17,14,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f4d990';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff0bb';ctx.font='bold 11px serif';ctx.textAlign='center';ctx.fillText(`${star}★`,w-17,h-13);
  ctx.restore();
}
