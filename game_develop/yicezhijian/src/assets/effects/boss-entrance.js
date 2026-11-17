import {drawSoldier} from '../soldiers/model.js';

export function drawBossEntrance(ctx,entrance,w,h){
  if(!entrance)return;
  const t=Math.max(0,Math.min(1,entrance.age/entrance.duration)),alpha=Math.min(1,t*10,(1-t)*8);
  ctx.save();ctx.globalAlpha=alpha;
  const backdrop=ctx.createLinearGradient(0,0,w,h);backdrop.addColorStop(0,'#090911');backdrop.addColorStop(.55,'#551722');backdrop.addColorStop(1,'#100b16');
  ctx.fillStyle=backdrop;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(w*.69,h*.5);ctx.rotate(-.18);
  for(let i=0;i<16;i++){ctx.strokeStyle=i%2?'#ec465944':'#ff9e7a22';ctx.lineWidth=2+i%3;const x=(i*97+entrance.age*210)%(w*1.5)-w;ctx.beginPath();ctx.moveTo(x,-h);ctx.lineTo(x+220,h);ctx.stroke();}ctx.restore();
  ctx.save();ctx.translate(w*.7+(1-Math.min(1,t*5))*180,h*.59);ctx.scale(3.3,3.3);
  drawSoldier(ctx,{x:0,y:0,boss:true,elite:true,role:'spear',walkPhase:entrance.age,moving:false,facing:-1},'#cf354d','#ffc4b0');ctx.restore();
  ctx.fillStyle='#070911dd';ctx.fillRect(0,h*.7,w,h*.3);
  ctx.fillStyle='#ff6474';ctx.font='700 21px serif';ctx.textAlign='left';ctx.fillText('敌  军  主  将  参  战',w*.09,h*.24);
  ctx.fillStyle='#fff0dd';ctx.font='900 56px serif';ctx.fillText(entrance.name,w*.09,h*.4);
  ctx.fillStyle='#ff8c97';ctx.font='900 36px serif';ctx.textAlign='center';ctx.fillText('强 敌 来 袭',w*.5,h*.81);
  ctx.fillStyle='#d6b8bc';ctx.font='16px serif';ctx.fillText('列阵迎敌 · 决战将至',w*.5,h*.88);
  ctx.strokeStyle='#ff5368';ctx.lineWidth=2;ctx.strokeRect(22,22,w-44,h-44);ctx.restore();
}
