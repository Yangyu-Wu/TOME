import {ellipse,glow} from './primitives.js';
const TAU=Math.PI*2;
export function drawWater(ctx,p,time,state,light){
    ellipse(ctx,p.x,p.y,p.rx+9,p.ry+8,'#182d29');ellipse(ctx,p.x,p.y+2,p.rx+5,p.ry+3,'#7b80624a');
    ctx.save();ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx,p.ry,0,0,TAU);ctx.clip();
    const g=ctx.createLinearGradient(0,p.y-p.ry,0,p.y+p.ry);g.addColorStop(0,'#244652');g.addColorStop(.5,'#396b71');g.addColorStop(1,'#173e49');ctx.fillStyle=g;ctx.fillRect(p.x-p.rx,p.y-p.ry,p.rx*2,p.ry*2);
    // Moving reflection of the sun/moon and reflected skill illumination.
    glow(ctx,p.x+light.dx,p.y,60,light.light,.35);
    const reflectedLights=[...(state.lights||[]),...(state.fields||[]).map(f=>({x:f.x,y:f.y,radius:f.radius*2,color:f.color,life:Math.min(1,f.duration-f.age),maxLife:1}))];
    for(const l of reflectedLights){if(Math.hypot(p.x-l.x,p.y-l.y)<l.radius+p.rx)glow(ctx,l.x,p.y+(p.y-l.y)*.2,l.radius*.8,l.color,l.life/l.maxLife*.5);}
    for(let i=0;i<24;i++){
      const yy=p.y-p.ry+(i*7+time*7)%(p.ry*2),xx=p.x+Math.sin(i*1.7+time*.7)*p.rx*.65,len=8+Math.sin(i+time*2)**2*26;
      ctx.strokeStyle=i%4===0?light.light:'#a7ded5';ctx.globalAlpha=.12+(i%4)*.07;ctx.lineWidth=i%4===0?2:1;ctx.beginPath();ctx.moveTo(xx-len,yy);ctx.quadraticCurveTo(xx,yy+Math.sin(time*2+i)*3,xx+len,yy);ctx.stroke();
    }
    ctx.globalAlpha=.18;ctx.fillStyle='#081d2c';for(const unit of [...state.roster,...(state.enemies||[])])if(!unit.dead&&Math.abs(unit.x-p.x)<p.rx+20&&Math.abs(unit.y-p.y)<p.ry+50){ellipse(ctx,unit.x,p.y+(p.y-unit.y)*.25,10,18,'#081d2c');}
    ctx.restore();ctx.strokeStyle='#acbba16b';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx,p.ry,0,0,TAU);ctx.stroke();
    for(let i=0;i<7;i++){const a=i*.85,x=p.x+Math.cos(a)*(p.rx+3),y=p.y+Math.sin(a)*(p.ry+1);ctx.strokeStyle='#6f8862';ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+Math.sin(time+i)*3,y-15,x-3,y-23);ctx.stroke();}
  }
