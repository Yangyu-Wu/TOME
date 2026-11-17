const clamp=t=>Math.max(0,Math.min(1,t));

export function flightExit(origin,target){
  let dx=target.x-origin.x,dy=target.y-origin.y;
  const length=Math.hypot(dx,dy);if(length<1){dx=0;dy=-1;}else{dx/=length;dy/=length;}
  const distance=Math.min(dx>0?(960-origin.x)/dx:dx<0?-origin.x/dx:Infinity,dy>0?(600-origin.y)/dy:dy<0?-origin.y/dy:Infinity)+420;
  return {x:origin.x+dx*distance,y:origin.y+dy*distance};
}

// Position and analytic tangent share the same curve, including a moving target.
export function flightPoint(f,state,progress=f.age/f.duration){
  const target=f.exitPoint||state.enemies.find(u=>u.id===f.target.id&&!u.dead)||f.target;
  const t=clamp(progress),dx=target.x-f.origin.x,dy=target.y-f.origin.y;
  const height=f.exitPoint||f.ultimate.theme==='seven-stars'?0:Math.min(115,Math.hypot(dx,dy)*.32);
  return {x:f.origin.x+dx*t,y:f.origin.y+dy*t-Math.sin(t*Math.PI)*height,
    angle:Math.atan2(dy-Math.cos(t*Math.PI)*Math.PI*height,dx),t,target};
}

export function drawFlightTrail(ctx,f,state){
  const t=clamp(f.age/f.duration);
  ctx.save();ctx.lineCap='round';
  for(let i=18;i>0;i--){
    const a=Math.max(0,t-i*.022),b=Math.max(0,t-(i-1)*.022);
    if(a===b)continue;
    const p=flightPoint(f,state,a),q=flightPoint(f,state,b);
    ctx.globalAlpha=(1-i/19)*.55;ctx.strokeStyle=i%3?f.ultimate.color:f.ultimate.secondary;
    ctx.lineWidth=2+(1-i/19)*10;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
    if(i%3===0){ctx.fillStyle=f.ultimate.secondary;ctx.beginPath();ctx.arc(p.x+Math.sin(i*4+f.age*8)*8,p.y+Math.cos(i*3+f.age*8)*8,1+(1-i/19)*2,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
}

// A directional, speed-scaled motion streak behind a travelling creature.
// Kept separate from the luminous trail so silhouette remains readable over
// bright impacts and the battlefield can still show through the wake.
export function drawFlightMotionBlur(ctx,f,state,point){
  if(!f.exitPoint)return;
  const speed=Math.hypot(f.exitPoint.x-f.origin.x,f.exitPoint.y-f.origin.y)/Math.max(.01,f.duration),length=Math.min(150,Math.max(54,speed*.22));
  ctx.save();ctx.translate(point.x,point.y);ctx.rotate(point.angle);const gradient=ctx.createLinearGradient(-length,0,-8,0);gradient.addColorStop(0,'rgba(255,255,255,0)');gradient.addColorStop(.7,f.ultimate.color+'44');gradient.addColorStop(1,f.ultimate.secondary+'cc');ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(-length,-5);ctx.quadraticCurveTo(-length*.45,-18,-8,-9);ctx.lineTo(-8,9);ctx.quadraticCurveTo(-length*.45,18,-length,5);ctx.closePath();ctx.fill();ctx.restore();
}
