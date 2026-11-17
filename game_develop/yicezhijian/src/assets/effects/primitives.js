const TAU=Math.PI*2;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const ease=t=>1-(1-t)**3;

export function glow(ctx,x,y,r,color,alpha=1){
  if(r<=0)return;ctx.save();ctx.globalAlpha*=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(.25,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
}
export function star(ctx,x,y,r,color,rotation=0){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,len=i%2?r*.22:r;i?ctx.lineTo(Math.cos(a)*len,Math.sin(a)*len):ctx.moveTo(len,0);}ctx.closePath();ctx.fill();ctx.restore();}
export function circle(ctx,x,y,r,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,TAU);ctx.stroke();}
