import {drawRock} from './props/rock.js';
import {drawCrate} from './props/crate.js';
import {drawBarricade} from './props/barricade.js';
import {drawTree} from './props/tree.js';
import {drawTorch} from './props/torch.js';
import {ellipse,glow} from './primitives.js';
import {PROP_SCALE} from '../render-quality.js';
export function drawProp(ctx,p,time,light){
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(PROP_SCALE,PROP_SCALE);
    if(p.destroyed){
      ellipse(ctx,0,0,p.radius*1.25,p.radius*.5,'#141a19b3');
      for(let i=0;i<7;i++){ctx.fillStyle=p.kind==='rock'?'#747b73':'#3e3026';ctx.save();ctx.translate(Math.cos(i*2.4)*p.radius*.75,Math.sin(i*2.4)*p.radius*.3);ctx.rotate(i);ctx.fillRect(-7,-3,12,6);ctx.restore();}
      if(p.heat>.1)glow(ctx,0,0,p.radius*1.4,'#ff6a23',p.heat*.25);ctx.restore();return;
    }
    const r=p.radius,shade=ctx.createLinearGradient(-r,-r,r,r);shade.addColorStop(0,light);shade.addColorStop(.12,p.kind==='rock'?'#89938a':'#8c7252');shade.addColorStop(1,p.kind==='rock'?'#38494b':'#392f2b');
    ctx.fillStyle=shade;ctx.strokeStyle='#15262a';ctx.lineWidth=2;
    const draw={rock:drawRock,crate:drawCrate,barricade:drawBarricade,tree:drawTree,torch:drawTorch}[p.kind];
    if(draw)draw(ctx,p,time);
    if(p.hp<p.maxHp){ctx.strokeStyle='#111a21';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-r*.4,-r);ctx.lineTo(3,-r*.5);ctx.lineTo(-3,0);ctx.stroke();}
    ctx.restore();
  }
