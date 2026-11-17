import {drawWater} from './water.js';
import {drawMark} from './mark.js';
import {ellipse,glow} from './primitives.js';
import {drawProp} from './prop.js';
import {PROP_SCALE} from '../render-quality.js';
const TAU=Math.PI*2;
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
const rgb=c=>`rgb(${c.join(',')})`;
const STAGES=[
  {name:'破晓',sky:[99,83,80],ground:[77,84,71],light:[255,194,122],dark:.1},
  {name:'白昼',sky:[94,137,154],ground:[89,109,91],light:[255,242,199],dark:0},
  {name:'黄昏',sky:[110,64,70],ground:[79,69,68],light:[255,151,86],dark:.18},
  {name:'深夜',sky:[18,33,63],ground:[35,53,65],light:[135,183,255],dark:.4},
];

export function lightingAt(time=0){
  const cycle=((time/88)%1+1)%1,position=cycle*4,index=Math.floor(position),t=position-index,a=STAGES[index],b=STAGES[(index+1)%4];
  const ease=t*t*(3-2*t),angle=cycle*TAU-.8;
  return {name:a.name,cycle,sky:rgb(mix(a.sky,b.sky,ease)),ground:rgb(mix(a.ground,b.ground,ease)),light:rgb(mix(a.light,b.light,ease)),dark:a.dark+(b.dark-a.dark)*ease,dx:Math.cos(angle)*24,dy:12+Math.abs(Math.sin(angle))*20};
}

export class EnvironmentRenderer {
  ground(ctx,state,w,h,time){
    const light=lightingAt(time);this.light=light;
    const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,light.sky);g.addColorStop(.4,light.ground);g.addColorStop(1,'#182c30');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    // Worn courtyard paving: bevels, recessed joints and directional erosion.
    // Every detail is derived from its tile coordinates so it never shimmers.
    for(let row=0;row<11;row++)for(let col=0;col<18;col++){
      const x=col*58+(row%2)*29-24,y=105+row*46,seed=row*37+col*19;
      const tone=(seed*13)%17;
      ctx.fillStyle=`rgba(${seed%3===0?'157,169,146':'20,34,35'},${.035+(seed%7)*.012})`;ctx.fillRect(x+2,y+2,54,42);
      // A narrow top bevel catches ambient light; the lower/right edge stays recessed.
      ctx.strokeStyle=`rgba(205,211,183,${.055+tone*.002})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+1,y+45);ctx.lineTo(x+1,y+1);ctx.lineTo(x+57,y+1);ctx.stroke();
      ctx.strokeStyle=`rgba(7,16,19,${.19+tone*.004})`;ctx.beginPath();ctx.moveTo(x+57,y+1);ctx.lineTo(x+57,y+45);ctx.lineTo(x+1,y+45);ctx.stroke();
      if(seed%4===0){
        const ox=7+(seed*11)%35,oy=8+(seed*7)%24;
        ctx.fillStyle=`rgba(12,25,22,${.08+(seed%5)*.018})`;ctx.beginPath();ctx.ellipse(x+ox,y+oy,5+(seed%4)*2,2+(seed%3),-.35,0,TAU);ctx.fill();
        ctx.strokeStyle='#d1c7a020';ctx.beginPath();ctx.moveTo(x+ox-9,y+oy+5);ctx.lineTo(x+ox-2,y+oy+7);ctx.lineTo(x+ox+4,y+oy+3);ctx.stroke();
      }
      if(seed%11===0){ctx.strokeStyle='#0c1719a0';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x+14,y+7);ctx.lineTo(x+19,y+16);ctx.lineTo(x+16,y+22);ctx.lineTo(x+25,y+30);ctx.stroke();ctx.strokeStyle='#c8c2a32b';ctx.beginPath();ctx.moveTo(x+15,y+7);ctx.lineTo(x+20,y+16);ctx.stroke();}
    }
    for(let i=0;i<74;i++){const x=35+(i*137)%890,y=123+(i*83)%440;ellipse(ctx,x,y,2+i%4,1+i%2,i%3?'#c4c1a329':'#182f2580');if(i%4===0){ctx.strokeStyle='#73946565';ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-2,y-9,x-6,y-11);ctx.moveTo(x,y);ctx.lineTo(x+3,y-9);ctx.stroke();}}
    // Fortress edges and warm inset trim give the arena depth.
    ctx.fillStyle='#111d23';ctx.fillRect(18,112,15,h-130);ctx.fillRect(w-33,112,15,h-130);ctx.fillRect(18,h-25,w-36,13);
    ctx.fillStyle='#647065';ctx.fillRect(30,114,w-60,3);ctx.fillStyle='#243238';ctx.fillRect(30,117,3,h-144);ctx.fillRect(w-33,117,3,h-144);
    ctx.strokeStyle='#b8aa8052';ctx.lineWidth=1;ctx.strokeRect(30,114,w-60,h-139);
    for(let i=0;i<17;i++){ctx.fillStyle=i%2?'#46504c':'#384345';ctx.fillRect(22+i*54,h-22,49,13);}
    for(const water of state.battlefield?.waters||[])this.water(ctx,water,time,state);
    for(const mark of state.battlefield?.marks||[])this.mark(ctx,mark,time);
    for(const p of state.battlefield?.props||[])if(!p.destroyed)this.shadow(ctx,p.x,p.y,p.radius*PROP_SCALE,(p.kind==='tree'?3.2:p.kind==='torch'?2:1.15)*PROP_SCALE);
    return light;
  }

  shadow(ctx,x,y,r,height=1){const l=this.light;ctx.save();ctx.translate(x,y);ctx.transform(1,0,l.dx/45,1,0,0);ellipse(ctx,l.dx*height*.5,l.dy*height*.5,r*.85,r*.4+l.dy*height*.4,`rgba(4,12,24,${.28+l.dark*.35})`);ctx.restore();}

  water(ctx,p,time,state){drawWater(ctx,p,time,state,this.light);}

  mark(ctx,m,time){drawMark(ctx,m,time,this.light);}

  prop(ctx,p,time){drawProp(ctx,p,time,this.light.light);}
  atmosphere(ctx,state,w,h,time){
    const light=this.light;ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle=`rgba(29,48,84,${light.dark})`;ctx.fillRect(0,0,w,h);ctx.restore();
    ctx.save();ctx.globalCompositeOperation='screen';
    for(const p of state.battlefield?.props||[])if(p.kind==='torch'&&!p.destroyed)glow(ctx,p.x,p.y-42*PROP_SCALE,72*PROP_SCALE,'#ff9a38',(.12+light.dark*.4)*(1+Math.sin(time*8+p.id)*.12));
    for(const l of state.lights||[])glow(ctx,l.x,l.y,l.radius,l.color,l.life/l.maxLife*.22);
    for(const f of state.fields||[])glow(ctx,f.x,f.y,f.radius*1.6,f.color,Math.min(1,f.duration-f.age)*.08);
    // Soft diagonal sun shafts and drifting pollen become fireflies at night.
    ctx.fillStyle=light.light;ctx.globalAlpha=.025+Math.max(0,.04-light.dark*.1);
    for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(60+i*200,110);ctx.lineTo(95+i*200,110);ctx.lineTo(390+i*200,h);ctx.lineTo(210+i*200,h);ctx.fill();}
    ctx.globalAlpha=.25+light.dark*.6;
    for(let i=0;i<26;i++){const x=40+(i*181+time*(5+i%3*2))%880,y=130+(i*73+Math.sin(time+i)*13)%420;ellipse(ctx,x,y,1+i%2,1+i%2,i%3?'#dbe7bc':'#ffc885');}
    ctx.restore();
    const vignette=ctx.createRadialGradient(w/2,h/2,180,w/2,h/2,570);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#06101bb0');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  }
}
