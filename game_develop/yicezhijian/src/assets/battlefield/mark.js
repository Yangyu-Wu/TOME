import {ellipse,glow} from './primitives.js';
const TAU=Math.PI*2;
export function drawMark(ctx,m,time,light){
    const age=time-m.born,hot=Math.max(0,1-age/5);ctx.save();ctx.translate(m.x,m.y);ctx.scale(1,.62);
    const g=ctx.createRadialGradient(0,0,1,0,0,m.radius);g.addColorStop(0,m.theme==='inferno'?'#190d0be6':'#08121abf');g.addColorStop(.7,'#10161c99');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(-m.radius,-m.radius,m.radius*2,m.radius*2);
    ctx.strokeStyle='#bac1b44d';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,m.radius*.7,.2,5.8);ctx.stroke();
    for(let i=0;i<9;i++){const a=i*2.399+m.seed,len=m.radius*(.45+(i%4)*.16);ctx.beginPath();ctx.moveTo(Math.cos(a)*8,Math.sin(a)*8);ctx.lineTo(Math.cos(a+.12)*len*.5,Math.sin(a+.12)*len*.5);ctx.lineTo(Math.cos(a)*len,Math.sin(a)*len);ctx.lineWidth=3;ctx.strokeStyle='#071015ce';ctx.stroke();if(hot>0){ctx.lineWidth=1;ctx.strokeStyle=m.color;ctx.globalAlpha=hot*.7;ctx.stroke();ctx.globalAlpha=1;}}
    if(m.theme==='seven-stars'){ctx.strokeStyle='#8cbfffff';ctx.globalAlpha=.18+hot*.4;ctx.beginPath();for(let i=0;i<8;i++){const a=i*4*Math.PI/7;const x=Math.cos(a)*m.radius*.58,y=Math.sin(a)*m.radius*.58;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}
    ctx.restore();
  }
