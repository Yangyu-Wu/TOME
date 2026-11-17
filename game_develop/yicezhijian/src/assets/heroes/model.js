import {armorColors,skinColors} from './palette.js';
import {motionPose} from './motion.js';
export function drawHeroModel(ctx,unit,{scale=1,enemy=false,team=null,shadow=true,light='#e7dfae'}={}){
  const v=unit.visual||{skin:0,armor:0,helmet:0,plume:0,accentHue:0},pose=motionPose(unit),id=unit.heroId||unit.id;
  ctx.save();ctx.translate(unit.x,unit.y);ctx.scale(scale,scale);
  if(shadow){ctx.fillStyle='#030a1666';ctx.beginPath();ctx.ellipse(0,24,20,6,0,0,Math.PI*2);ctx.fill();}
  ctx.translate(0,pose.bob-(unit.airHeight||0));ctx.rotate(pose.turn);ctx.scale((unit.facing===-1?-1:1)*pose.squash,1/pose.squash);
  if(unit.dead)ctx.globalAlpha=.35;
  ctx.strokeStyle='#101d27';ctx.lineWidth=2.4;ctx.lineJoin='round';ctx.lineCap='round';
  if(unit.role==='cavalry'){
    ctx.fillStyle='#796a55';ctx.beginPath();ctx.ellipse(0,15,25,12,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillRect(17,-2,9,19);ctx.beginPath();ctx.ellipse(23,-4,10,6,-.4,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#3c332f';ctx.lineWidth=4;for(let i=0;i<4;i++){const x=-17+i*11,foot=Math.sin((unit.walkPhase||0)+i*Math.PI*.7)*8*(unit.moving?1:0);ctx.beginPath();ctx.moveTo(x,20);ctx.lineTo(x+foot,36);ctx.stroke();}ctx.translate(0,-12);
  }
  // Two articulated legs, swinging arms and a trailing cape remain distinct from idle breathing.
  ctx.strokeStyle='#1d2b34';ctx.lineWidth=7;
  for(const [x,foot] of [[-7,pose.leftFoot],[7,pose.rightFoot]]){ctx.beginPath();ctx.moveTo(x,12);ctx.lineTo(x+foot*.25,22);ctx.lineTo(x+foot,30-Math.max(0,foot)*.3);ctx.stroke();ctx.fillStyle='#253039';ctx.fillRect(x+foot-4,27-Math.max(0,foot)*.3,10,5);}
  const robe=team?(team==='enemy'?'#b43845':'#287bd0'):id==='guanyu'?'#287a57':id==='zhouyu'?'#b9473a':id==='zhugeliang'?'#b7d2c4':`hsl(${v.accentHue} 42% 34%)`;
  ctx.fillStyle=robe;ctx.strokeStyle='#152531';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-11,-7);ctx.bezierCurveTo(-22,4,-16-pose.cape,25,-24-pose.cape,30);ctx.lineTo(13,24);ctx.lineTo(12,-7);ctx.fill();ctx.stroke();
  const armor=ctx.createLinearGradient(-14,-5,15,20);armor.addColorStop(0,light);armor.addColorStop(.12,team?robe:enemy?'#9b5553':id==='guanyu'?'#508966':armorColors[v.armor%armorColors.length]);armor.addColorStop(1,'#23333c');ctx.fillStyle=armor;
  ctx.beginPath();ctx.moveTo(-14,17);ctx.lineTo(-12,-6);ctx.quadraticCurveTo(0,-15,12,-6);ctx.lineTo(15,17);ctx.lineTo(0,23);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#d8c59699';ctx.lineWidth=1;for(let row=0;row<3;row++){ctx.beginPath();ctx.moveTo(-10,2+row*6);ctx.lineTo(11,2+row*6);ctx.stroke();}
  ctx.fillStyle='#e2c48a';ctx.fillRect(-13,13,27,3);
  ctx.save();ctx.translate(-13,-1);ctx.rotate(-pose.arm);ctx.strokeStyle=robe;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-5,12);ctx.stroke();ctx.restore();
  ctx.fillStyle=id==='guanyu'?'#be846b':skinColors[v.skin%skinColors.length];ctx.strokeStyle='#2a2b2b';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-19,9,11,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=id==='zhugeliang'?'#283b43':robe;ctx.beginPath();ctx.moveTo(-11,-23);ctx.lineTo(-7,-35-(v.helmet%3));ctx.lineTo(7,-35-(v.helmet%3));ctx.lineTo(12,-23);ctx.closePath();ctx.fill();ctx.strokeStyle='#d3bd89';ctx.lineWidth=1;ctx.stroke();
  if(id==='guanyu'){ctx.fillStyle='#182820';ctx.beginPath();ctx.moveTo(-7,-14);ctx.quadraticCurveTo(-10,5,2,14);ctx.quadraticCurveTo(12,-1,7,-14);ctx.lineTo(0,-9);ctx.fill();}
  if(id==='zhugeliang'){ctx.fillStyle='#1b2a34';ctx.fillRect(-12,-34,24,5);ctx.fillRect(-5,-43,10,12);}
  ctx.fillStyle='#1c2428';ctx.fillRect(2,-22,4,2);
  if(v.plume&&id!=='zhugeliang'){ctx.strokeStyle=light;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-34);ctx.quadraticCurveTo(-10-pose.cape,-50-v.plume,-5-pose.cape,-53-v.plume);ctx.stroke();}
  ctx.save();ctx.translate(12,-1);ctx.rotate(pose.arm+pose.attackArc-(unit.casting?.5:0));ctx.strokeStyle='#dbc59b';ctx.lineWidth=3;
  if(id==='guanyu'){
    ctx.strokeStyle='#7a5d3c';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-7,28);ctx.lineTo(20,-39);ctx.stroke();ctx.strokeStyle='#d5bd8c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-4,16);ctx.lineTo(12,-24);ctx.stroke();ctx.fillStyle='#c8eee1';ctx.strokeStyle='#65b997';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(20,-39);ctx.quadraticCurveTo(44,-44,39,-67);ctx.quadraticCurveTo(29,-58,20,-56);ctx.closePath();ctx.fill();ctx.stroke();
  }else if(id==='zhugeliang'||id==='zhouyu'){
    ctx.strokeStyle='#bcab83';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,13);ctx.lineTo(11,-8);ctx.stroke();for(let i=0;i<6;i++){ctx.save();ctx.translate(10,-7);ctx.rotate((i-2.5)*.19+pose.attack*.12);ctx.fillStyle=id==='zhugeliang'?'#dfebd4':'#e7bb8c';ctx.beginPath();ctx.ellipse(0,-10,3,14,0,0,Math.PI*2);ctx.fill();ctx.restore();}if(id==='zhouyu'){ctx.strokeStyle='#e98f51';ctx.lineWidth=2;ctx.beginPath();ctx.arc(7,-13,14,-1.2,.8);ctx.stroke();}
  }else if(unit.role==='archer'){ctx.beginPath();ctx.arc(8,0,15,-1.2,1.2);ctx.moveTo(13,-14);ctx.lineTo(unit.attackFlash?3:13,0);ctx.lineTo(13,14);ctx.stroke();ctx.strokeStyle='#bd9c65';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(13,-14);ctx.lineTo(13,14);ctx.stroke();if(unit.attackFlash>0){ctx.globalAlpha=.75;ctx.strokeStyle='#e7d6ad';ctx.beginPath();ctx.moveTo(2,-8);ctx.lineTo(2,8);ctx.stroke();}}
  else if(unit.role==='mage'||unit.role==='support'){ctx.beginPath();ctx.moveTo(0,23);ctx.lineTo(9,-29);ctx.stroke();ctx.fillStyle=light;ctx.beginPath();ctx.arc(9,-31,4,0,Math.PI*2);ctx.fill();}
  else if(unit.role==='shield'){ctx.fillStyle=armor;ctx.beginPath();ctx.moveTo(-1,-8);ctx.lineTo(18,-12);ctx.lineTo(19,13);ctx.lineTo(9,21);ctx.lineTo(-2,13);ctx.closePath();ctx.fill();ctx.stroke();}
  else {ctx.beginPath();ctx.moveTo(-4,22);ctx.lineTo(19,-32);ctx.stroke();ctx.fillStyle='#e4ebdb';ctx.beginPath();ctx.moveTo(19,-32);ctx.lineTo(20,-48);ctx.lineTo(26,-34);ctx.closePath();ctx.fill();}
  if(pose.attackProgress>0&&pose.attackProgress<1){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.12+pose.attack*.18;ctx.strokeStyle=team==='enemy'?'#ff6471':'#9bd7ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(16,0,35,-1.35+pose.attackProgress*.8,-.35+pose.attackProgress*.8);ctx.stroke();ctx.restore();}
  ctx.restore();
  if(unit.hitFlash>0){ctx.globalCompositeOperation='screen';ctx.fillStyle='#fff5cf88';ctx.beginPath();ctx.ellipse(0,-3,16,27,0,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
