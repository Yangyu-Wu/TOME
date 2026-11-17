import {motionPose} from '../heroes/motion.js';
import {SOLDIER_SCALE} from '../render-quality.js';
export const soldierScale=unit=>(unit.boss?2.8:unit.elite?1.75:13/15)*SOLDIER_SCALE;
export function drawSoldier(ctx,unit,color,light){
    const pose=motionPose(unit),scale=soldierScale(unit);
    ctx.save();ctx.translate(unit.x,unit.y+pose.bob-(unit.airHeight||0));ctx.scale((unit.facing===-1?-1:1)*scale,scale);
    ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#172631';ctx.lineWidth=5;
    for(const [x,foot] of [[-5,pose.leftFoot],[5,pose.rightFoot]]){ctx.beginPath();ctx.moveTo(x,8);ctx.lineTo(x+foot*.25,17);ctx.lineTo(x+foot*.7,23-Math.max(0,foot)*.3);ctx.stroke();}
    const g=ctx.createLinearGradient(-10,-12,12,16);g.addColorStop(0,light);g.addColorStop(.12,color);g.addColorStop(1,'#283139');ctx.fillStyle=g;ctx.strokeStyle='#19232a';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-11,12);ctx.lineTo(-9,-9);ctx.lineTo(7,-10);ctx.lineTo(12,12);ctx.lineTo(0,16);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle='#c6b49688';ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-8,-2+i*5);ctx.lineTo(9,-2+i*5);ctx.stroke();}
    ctx.fillStyle='#c39978';ctx.beginPath();ctx.ellipse(0,-17,6.5,8,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-9,-17);ctx.lineTo(-6,-29);ctx.lineTo(5,-31);ctx.lineTo(10,-17);ctx.closePath();ctx.fill();ctx.strokeStyle='#d7d2aa';ctx.stroke();ctx.fillStyle='#1a2730';ctx.fillRect(1,-19,5,2);
    ctx.save();ctx.translate(10,-4);ctx.rotate(pose.arm+pose.attackArc);ctx.strokeStyle='#d3c5a2';ctx.lineWidth=2;
    if(unit.role==='archer'){ctx.beginPath();ctx.arc(3,0,12,-1.2,1.2);ctx.moveTo(7,-11);ctx.lineTo(unit.attackFlash?1:7,0);ctx.lineTo(7,11);ctx.stroke();ctx.strokeStyle='#bea16d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(7,-11);ctx.lineTo(7,11);ctx.stroke();}
    else if(unit.role==='shield'){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(1,-10);ctx.lineTo(17,-13);ctx.lineTo(19,8);ctx.lineTo(10,15);ctx.lineTo(1,9);ctx.closePath();ctx.fill();ctx.strokeStyle='#d3c5a2';ctx.stroke();ctx.strokeStyle='#967a50';ctx.beginPath();ctx.moveTo(-4,24);ctx.lineTo(8,-22);ctx.stroke();}
    else{ctx.strokeStyle='#9a8059';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-4,24);ctx.lineTo(12,-30);ctx.stroke();ctx.strokeStyle='#cfd4c3';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(12,-30);ctx.lineTo(13,-43);ctx.lineTo(18,-30);ctx.stroke();ctx.fillStyle='#cfd4c3';ctx.fill();}
    ctx.restore();if(pose.attackProgress>0&&pose.attackProgress<1){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.1+pose.attack*.15;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(12,0,25,-1.25+pose.attackProgress*.8,-.4+pose.attackProgress*.8);ctx.stroke();ctx.restore();}ctx.strokeStyle=color;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-10,-5);ctx.lineTo(-13+pose.stride*2,7);ctx.stroke();
    if(unit.hitFlash>0){ctx.globalCompositeOperation='screen';ctx.fillStyle='#ffe6b880';ctx.beginPath();ctx.ellipse(0,-4,12,23,0,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
