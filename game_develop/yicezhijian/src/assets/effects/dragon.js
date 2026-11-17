import {glow,star,circle} from './primitives.js';
const TAU=Math.PI*2;
export function drawDragon(ctx,x,y,scale,time,color='#42ffc0'){
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.translate(x,y);ctx.scale(scale,scale);
  const points=Array.from({length:52},(_,i)=>{const t=i/51;return {x:-175+t*320,y:Math.sin(t*TAU*1.15-time*2)*38*(.3+t)+Math.sin(t*Math.PI)*-26,r:3+t*13};});
  ctx.lineCap='round';
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];ctx.strokeStyle='#113e4b';ctx.lineWidth=b.r*2.5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    ctx.strokeStyle=i%4===0?'#e1ffb4':color;ctx.lineWidth=b.r*1.55;ctx.stroke();
    if(i%3===0){ctx.fillStyle='#c2fbb3';ctx.beginPath();ctx.moveTo(b.x-6,b.y-b.r*.5);ctx.lineTo(b.x-15,b.y-b.r-15);ctx.lineTo(b.x+4,b.y-b.r*.7);ctx.fill();ctx.strokeStyle='#106552';ctx.lineWidth=1;ctx.beginPath();ctx.arc(b.x,b.y,b.r*.6,Math.PI*.1,Math.PI*.9);ctx.stroke();}
    if(i===27||i===38){ctx.strokeStyle='#d3ffb7';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-10,b.y+24);ctx.lineTo(b.x+5,b.y+30);ctx.moveTo(b.x-10,b.y+24);ctx.lineTo(b.x-18,b.y+33);ctx.stroke();}
  }
  // Layered wing membranes and scale highlights give the travelling body a
  // readable silhouette at battlefield scale instead of a single glowing
  // ribbon.  The wing roots follow the same analytic body points, so they
  // remain attached while the dragon banks along the flight curve.
  for(const index of [15,28,41]){
    const root=points[index],direction=index%2?-1:1;ctx.save();ctx.translate(root.x,root.y);ctx.scale(1,direction);
    ctx.fillStyle='rgba(175,255,205,.26)';ctx.strokeStyle='#baffcb';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-20,-38,-8,-78);ctx.quadraticCurveTo(24,-56,58,-25);ctx.quadraticCurveTo(28,-12,0,0);ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(224,255,192,.72)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-8,-78);ctx.moveTo(0,0);ctx.lineTo(20,-58);ctx.moveTo(0,0);ctx.lineTo(43,-34);ctx.stroke();ctx.restore();
  }
  for(let i=8;i<46;i+=3){const p=points[i];ctx.fillStyle=i%2?'#d9ffb7':'#8fffc0';ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(p.x-3,p.y-p.r*.35,Math.max(1.2,p.r*.13),0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
  const head=points.at(-1);ctx.translate(head.x,head.y);ctx.rotate(Math.cos(time*2)*.1);
  ctx.fillStyle=color;ctx.strokeStyle='#efffc2';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-19,-17);ctx.lineTo(7,-24);ctx.lineTo(20,-10);ctx.lineTo(43,-7);ctx.lineTo(47,4);ctx.lineTo(27,12);ctx.lineTo(8,12);ctx.lineTo(-8,21);ctx.lineTo(-23,12);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#fff5ba';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-6,-19);ctx.lineTo(-15,-42);ctx.lineTo(-30,-48);ctx.moveTo(7,-19);ctx.lineTo(8,-39);ctx.lineTo(-2,-48);ctx.stroke();
  ctx.fillStyle='#123d35';ctx.beginPath();ctx.moveTo(24,3);ctx.lineTo(46,3);ctx.lineTo(29,10);ctx.fill();ctx.fillStyle='#fffade';ctx.fillRect(29,2,3,6);glow(ctx,10,-8,13,'#fffbd0',.7);star(ctx,10,-8,6,'#ffffff');
  ctx.strokeStyle='#d2ffc8';ctx.lineWidth=1.8;for(const sign of [-1,1]){ctx.beginPath();ctx.moveTo(35,5);ctx.bezierCurveTo(65,sign*25,20,sign*45,65+Math.sin(time*5)*8,sign*55);ctx.stroke();}
  ctx.restore();
}
