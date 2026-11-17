import {glow,star,circle} from './primitives.js';
import {drawTornado} from './tornado.js';
const TAU=Math.PI*2,clamp=t=>Math.max(0,Math.min(1,t)),ease=t=>1-(1-t)**3;
export function drawField(ctx,f,time){
    const fade=Math.min(1,(f.duration-f.age)*1.5);ctx.save();ctx.globalAlpha=fade;
    if(f.theme==='tornado')drawTornado(ctx,f.x,f.y,f.radius/75,time,f.color);
    else if(f.theme==='inferno'){
      glow(ctx,f.x,f.y,f.radius,'#ff5925',.2);
      for(let i=0;i<19;i++){const a=i*2.4,r=f.radius*(.2+(i%5)*.15),x=f.x+Math.cos(a)*r,y=f.y+Math.sin(a)*r*.55,high=20+Math.sin(time*9+i)*8+(i%4)*9;
        ctx.fillStyle=i%3===0?'#ffe79a':i%2?'#ff842d':'#ed3c23';ctx.globalAlpha=fade*.65;ctx.beginPath();ctx.moveTo(x-7,y);ctx.bezierCurveTo(x-14,y-high*.5,x+Math.sin(time*6+i)*10,y-high,x+3,y-high-14);ctx.bezierCurveTo(x+4,y-high*.5,x+13,y-8,x+7,y);ctx.closePath();ctx.fill();
      }
    }else if(f.theme==='eclipse'){
      glow(ctx,f.x,f.y,f.radius,f.color,.3);ctx.save();ctx.translate(f.x,f.y);ctx.scale(1,.5);for(let i=0;i<5;i++){ctx.strokeStyle=f.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,25+i*13,time*3+i,time*3+i+4);ctx.stroke();}ctx.restore();
    }
    ctx.restore();
  }
