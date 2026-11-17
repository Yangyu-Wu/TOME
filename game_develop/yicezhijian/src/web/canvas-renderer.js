import {drawHeroModel} from '../heroes/index.js';
import {drawSoldier,soldierScale} from '../assets/soldiers/model.js';
import {EnvironmentRenderer,lightingAt} from './environment-renderer.js';
import {VfxRenderer,glow} from './vfx-renderer.js';
import {createBattlefield} from '../core/battlefield.js';
import {BATTLE_WIDTH,BATTLE_HEIGHT,RENDER_SCALE,SOLDIER_SCALE} from '../assets/render-quality.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export class CanvasRenderer {
  bossAura(ctx,unit){if(!unit.boss)return;ctx.save();ctx.globalAlpha=.18+.08*Math.sin((unit.walkPhase||0)*2);ctx.strokeStyle='#e04d56';ctx.lineWidth=5;ctx.beginPath();ctx.arc(unit.x,unit.y,48+Math.sin((unit.walkPhase||0)*3)*4,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.1;ctx.fillStyle='#d73e4c';ctx.beginPath();ctx.arc(unit.x,unit.y,38,0,Math.PI*2);ctx.fill();ctx.restore();}
  constructor(canvas,{renderScale=RENDER_SCALE}={}){this.canvas=canvas;this.renderScale=renderScale;canvas.width=BATTLE_WIDTH*renderScale;canvas.height=BATTLE_HEIGHT*renderScale;this.ctx=canvas.getContext('2d');this.ctx.imageSmoothingQuality='high';this.environment=new EnvironmentRenderer();this.vfx=new VfxRenderer(canvas);this.campField=createBattlefield();this.started=performance.now();this.frameCount=0;}
  render(state){
    const ctx=this.ctx,w=BATTLE_WIDTH,h=BATTLE_HEIGHT,time=state.environmentTime??(state.phase==='battle'?state.visualTime||state.battleElapsed||0:(performance.now()-this.started)/1000),world=state.battlefield?state:{...state,battlefield:this.campField};
    ctx.save();ctx.setTransform(this.renderScale,0,0,this.renderScale,0,0);ctx.clearRect(0,0,w,h);ctx.save();const shake=state.phase==='battle'?Math.min(9,state.screenShake||0):0;ctx.translate(Math.sin(time*47)*shake,Math.cos(time*39)*shake*.6);
    this.environment.ground(ctx,world,w,h,time);
    if(state.phase==='battle')this.battle(ctx,state,w,h,time);else{for(const prop of world.battlefield.props)this.environment.prop(ctx,prop,time);this.camp(ctx,state,w,h);}
    this.environment.atmosphere(ctx,world,w,h,time);if(state.phase==='battle')this.vfx.draw(ctx,state);ctx.restore();
    if(state.phase==='battle'){this.hud(ctx,state,w,h,time);this.vfx.cinematic(ctx,state.cinematic,w,h,state.visualTime||0);this.vfx.bossEntrance(ctx,state.bossEntrance,w,h);}
    ctx.restore();this.frameCount++;
  }
  camp(ctx,state,w,h){ctx.fillStyle='#e8d39a';ctx.font='700 28px serif';ctx.textAlign='center';ctx.fillText('一策之间 · 军帐整备',w/2,92);ctx.fillStyle='#9eb0ca';ctx.font='14px serif';ctx.fillText(`军需 ${state.gold} · 在册武将 ${state.roster.length}`,w/2,122);}
  battle(ctx,state,w,h,time){
    const enemies=state.enemies.filter(x=>!x.dead||(x.deathAge??0)<.8),allies=[...state.roster.filter(x=>x.slot==='front'&&x.currentHp>0),...(state.summons||[]).filter(x=>!x.dead)];
    for(const unit of [...enemies,...allies]){const scale=unit.visual?1:soldierScale(unit);this.environment.shadow(ctx,unit.x,unit.y+20*scale,15*scale,scale);this.bossAura(ctx,unit);}
    const objects=[...(state.battlefield?.props||[]).map(prop=>({y:prop.y,prop})),...enemies.map(unit=>({y:unit.y,unit,enemy:true})),...allies.map(unit=>({y:unit.y,unit}))].sort((a,b)=>a.y-b.y);
    for(const obj of objects){if(obj.prop)this.environment.prop(ctx,obj.prop,time);else this.unit(ctx,obj.unit,obj.enemy?'#d64250':'#287bd0',obj.enemy);}
    if(!this.gpuHeroesEnabled)for(const shot of state.projectiles||[])this.projectile(ctx,shot);this.effects(ctx,state.effects||[]);
  }
  hud(ctx,state,w,h,time){
    const alive=state.enemies.filter(x=>!x.dead).length,remaining=Math.max(0,(state.enemyPlan?.total||0)-(state.enemySpawned||0)),typeName={normal:'围城战',encounter:'精英遭遇',boss:'主将决战'}[state.battleType]||'战斗';
    ctx.save();const panel=ctx.createLinearGradient(0,0,0,116);panel.addColorStop(0,'#07111dfc');panel.addColorStop(1,'#0a1827e8');ctx.fillStyle=panel;ctx.fillRect(0,0,w,116);ctx.strokeStyle='#ad95634d';ctx.beginPath();ctx.moveTo(25,115);ctx.lineTo(w-25,115);ctx.stroke();
    ctx.textAlign='left';ctx.fillStyle='#e4d3a6';ctx.font='700 21px serif';ctx.fillText('一策之间',35,37);ctx.font='11px serif';ctx.fillStyle='#8bafa7';ctx.fillText(`${typeName} / 第 ${state.wave+1||1} 阵`,36,58);
    ctx.textAlign='right';ctx.fillStyle='#ecdbb0';ctx.font='700 19px serif';ctx.fillText(`${Math.ceil(state.battleTime)} 秒`,924,35);ctx.font='11px serif';ctx.fillStyle='#a3b8be';ctx.fillText(`${lightingAt(time).name}  ·  难度 ${state.difficulty}`,924,56);ctx.fillText(`敌军 ${alive}  /  待援 ${remaining}`,924,77);
    state.roster.filter(x=>x.slot==='back').forEach((unit,index)=>this.support(ctx,unit,state.testMode?(unit.formationPosition??index):index));this.drawSynergyStrip(ctx,state);
    ctx.font='10px serif';ctx.fillStyle='#b7d2ca99';ctx.textAlign='left';ctx.fillText('前军自动交战 · 后军蓄力施法',36,h-34);ctx.restore();
  }
  drawSynergyStrip(ctx,state){const active=state.synergyEffects?.active||[];if(!active.length)return;ctx.save();ctx.textAlign='left';ctx.font='10px serif';let x=42;for(const id of active){ctx.fillStyle='#c7a66a';ctx.fillRect(x,78,22,22);ctx.fillStyle='#1c2637';ctx.textAlign='center';ctx.fillText(id==='five-tigers'?'五':id==='dragon-phoenix'?'卧':id==='beauties'?'月':id==='rulers'?'君':id==='wei'?'魏':id==='shu'?'蜀':'吴',x+11,93);x+=29;}ctx.restore();}
  projectile(ctx,shot){ctx.save();ctx.translate(shot.x,shot.y);ctx.rotate(Math.atan2(shot.vy,shot.vx));ctx.globalAlpha=.2;ctx.strokeStyle=shot.color;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-24,0);ctx.lineTo(2,0);ctx.stroke();ctx.globalAlpha=1;ctx.strokeStyle=shot.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-9,0);ctx.lineTo(6,0);ctx.stroke();ctx.fillStyle='#e8d5a3';ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(2,-3);ctx.lineTo(2,3);ctx.closePath();ctx.fill();ctx.restore();}
  unit(ctx,unit,color,enemy=false){
    if(unit.dead){ctx.save();ctx.globalAlpha=Math.max(0,1-(unit.deathAge||0)/.8);ctx.translate(unit.x,unit.y-(unit.airHeight||0));ctx.rotate((unit.deathAge||0)*2*(unit.facing||1));this.drawSoldier(ctx,{...unit,x:0,y:0,airHeight:0,moving:false},color);ctx.restore();return;}
    if(unit.visual&&!this.gpuHeroesEnabled)drawHeroModel(ctx,unit,{enemy,team:enemy?'enemy':'ally',shadow:false,light:this.environment.light.light,scale:unit.boss?2.8:unit.elite?1.75:1});else if(!unit.visual)this.drawSoldier(ctx,unit,color);
    const size=unit.visual?(unit.boss?2.8:unit.elite?1.75:1):soldierScale(unit),bw=(enemy?31:51)*size,y=unit.y-(unit.airHeight||0)-(unit.visual?63:48)*size;ctx.fillStyle='#08131de0';ctx.fillRect(unit.x-bw/2-1,y-1,bw+2,6);ctx.fillStyle=enemy?'#ef4655':'#459cff';ctx.fillRect(unit.x-bw/2,y,bw*clamp(unit.currentHp/unit.maxHp,0,1),4);
    if(enemy&&unit.elite&&unit.entering){const pulse=1+Math.sin((unit.entranceAge||0)*9)*.16;ctx.save();ctx.globalAlpha=.65;ctx.strokeStyle='#ff5260';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(unit.x,unit.y+12*size,24*size*pulse,8*size*pulse,0,0,Math.PI*2);ctx.stroke();ctx.font='700 13px serif';ctx.textAlign='center';ctx.fillStyle='#ff8991';ctx.fillText('精英来袭',unit.x,y-25);ctx.restore();}
    if(!enemy||unit.elite||unit.boss){ctx.font=unit.boss?'700 15px serif':'11px serif';ctx.textAlign='center';ctx.strokeStyle='#07101c';ctx.lineWidth=3;const name=`${unit.name}${unit.star?` ${'★'.repeat(unit.star)}`:''}`;ctx.strokeText(name,unit.x,y-7);ctx.fillStyle=enemy?'#ff8995':'#8dc8ff';ctx.fillText(name,unit.x,y-7);}
    if(unit.shield>0){ctx.save();ctx.globalCompositeOperation='screen';ctx.strokeStyle=enemy?'#ff6c7c':'#91d6ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(unit.x,unit.y-4*size,24*size,35*size,0,0,Math.PI*2);ctx.stroke();glow(ctx,unit.x,unit.y,32*size,enemy?'#ff4055':'#4d9eff',.12);ctx.restore();}
    for(const status of unit.statuses||[]){if(status.type==='burn')glow(ctx,unit.x,unit.y-12,26,'#ff7c30',.3);if(status.type==='stun'){ctx.fillStyle='#ffe39b';ctx.font='14px serif';ctx.fillText('✦',unit.x,unit.y-45);}}
    if(unit.casting){ctx.save();ctx.globalCompositeOperation='screen';glow(ctx,unit.x,unit.y,60,'#ffeea4',.3);ctx.restore();}
  }
  drawSoldier(ctx,unit,color){drawSoldier(ctx,unit,color,this.environment.light.light);}
  support(ctx,unit,index){
    const width=210,x=259+index*225,y=23;
    ctx.save();ctx.fillStyle='#152636';ctx.fillRect(x,y,width,78);ctx.strokeStyle=unit.pendingCast?'#c8e9d2':'#627b7988';ctx.lineWidth=1;ctx.strokeRect(x,y,width,78);
    drawHeroModel(ctx,{...unit,x:x+29,y:y+49,airHeight:0},{team:'ally',scale:.63,light:this.environment.light.light});
    ctx.textAlign='left';ctx.fillStyle='#e6dbb5';ctx.font='700 12px serif';ctx.fillText(unit.name+' '+('★'.repeat(unit.star||1)),x+56,y+20);
    ctx.fillStyle=unit.pendingCast?'#a5f3e0':'#9bb6c4';ctx.font='11px serif';ctx.fillText(unit.pendingCast?'正在施展 · '+unit.skill.name:unit.skill.name,x+56,y+40);
    ctx.fillStyle='#273d50';ctx.fillRect(x+56,y+54,137,5);ctx.fillStyle=unit.pendingCast?'#b7e5d4':'#c4a86b';ctx.fillRect(x+56,y+54,137*(1-clamp(unit.skillCooldown/unit.skillDuration,0,1)),5);ctx.restore();
  }
  effects(ctx,effects){for(const effect of effects){const t=1-effect.life/effect.maxLife,alpha=clamp(effect.life/effect.maxLife,0,1),radius=effect.radius*(.6+t*1.4),colors={area:'#ef8b45',heal:'#77d69b',shield:'#72b8f2',burn:'#f15c36',stun:'#f0d36a',haste:'#d18bf0',drain:'#cf6e9c',chain:'#82d9e9',summon:'#e5ba66',single:effect.color};ctx.save();ctx.globalAlpha=alpha;ctx.translate(effect.x,effect.y);if(effect.type==='text'){ctx.font='900 15px serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#101827';ctx.strokeText(effect.text,0,-t*34);ctx.fillStyle=effect.color;ctx.fillText(effect.text,0,-t*34);}else if(effect.type==='synergy'){const names={'wei':'魏之铁壁','shu':'蜀汉同心','wu':'江东水师','five-tigers':'五虎上将','rulers':'君主羁绊','dragon-phoenix':'卧龙凤雏','beauties':'闭月羞花'};ctx.textAlign='center';ctx.font='900 17px serif';ctx.lineWidth=4;ctx.strokeStyle='#182338';ctx.strokeText(`✦ ${names[effect.id]||effect.id} 羁绊激活 ✦`,0,0);ctx.fillStyle='#ffe7a3';ctx.fillText(`✦ ${names[effect.id]||effect.id} 羁绊激活 ✦`,0,0);ctx.strokeStyle='#e7c777';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,14,Math.sin(t*Math.PI)*56,0,Math.PI*2);ctx.stroke();}else if(effect.type==='spawn'){ctx.strokeStyle=effect.color;ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,0,radius*(1-t*.45),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=effect.color;ctx.globalAlpha=alpha*.5;ctx.beginPath();ctx.arc(0,0,7+t*10,0,Math.PI*2);ctx.fill();}else if(effect.type==='skill'){const type=effect.skillType,color=colors[type]||effect.color;ctx.strokeStyle=color;ctx.lineWidth=type==='area'?5:3;
      if(type==='area'||type==='burn'){ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(0,0,radius*.72,0,Math.PI*2);ctx.stroke();for(let i=0;i<9;i++){const a=i*Math.PI*2/9+t*2;ctx.fillStyle=color;ctx.beginPath();ctx.arc(Math.cos(a)*radius*.85,Math.sin(a)*radius*.85,3+(i%3),0,Math.PI*2);ctx.fill();}}
      else if(type==='heal'){ctx.rotate(t*.4);ctx.strokeRect(-radius*.68,-radius*.68,radius*1.36,radius*1.36);ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-radius*.38,0);ctx.lineTo(radius*.38,0);ctx.moveTo(0,-radius*.38);ctx.lineTo(0,radius*.38);ctx.stroke();}
      else if(type==='shield'){for(let i=0;i<6;i++){const a=i*Math.PI/3+t*.7;ctx.beginPath();ctx.arc(0,0,radius,a,a+Math.PI/2);ctx.stroke();}ctx.globalAlpha*=.12;ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,0,radius*.8,0,Math.PI*2);ctx.fill();}
      else if(type==='stun'){for(let i=0;i<3;i++){const a=t*7+i*Math.PI*2/3;ctx.beginPath();ctx.arc(Math.cos(a)*radius*.55,Math.sin(a)*radius*.2,4,0,Math.PI*2);ctx.stroke();}}
      else if(type==='haste'){for(let i=0;i<5;i++){const x=-radius+t*radius*2+i*12;ctx.beginPath();ctx.moveTo(x,-8-i%2*5);ctx.lineTo(x+radius*.3,-8-i%2*5);ctx.stroke();}}
      else if(type==='drain'||type==='single'){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(effect.targetX-effect.x,effect.targetY-effect.y);ctx.stroke();ctx.beginPath();ctx.arc(effect.targetX-effect.x,effect.targetY-effect.y,radius*(.25+t*.5),0,Math.PI*2);ctx.stroke();}
      else if(type==='chain'){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(effect.targetX-effect.x,effect.targetY-effect.y);ctx.stroke();for(let i=0;i<5;i++){const x=(effect.targetX-effect.x)*i/4,y=(effect.targetY-effect.y)*i/4;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,3+(i%2)*2,0,Math.PI*2);ctx.fill();}}
      else if(type==='summon'){for(let i=0;i<3;i++){const a=t*5+i*Math.PI*2/3;ctx.beginPath();ctx.arc(Math.cos(a)*radius*.55,Math.sin(a)*radius*.55,5,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.arc(0,0,radius*.42,0,Math.PI*2);ctx.stroke();}
      if(effect.targetX!==effect.x&&!['single','drain','chain'].includes(type)){ctx.globalAlpha=alpha*.38;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(effect.targetX-effect.x,effect.targetY-effect.y);ctx.stroke();}
    }else{ctx.strokeStyle=effect.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.fillStyle=effect.color;for(let i=0;i<6;i++){const angle=i*Math.PI/3+t*4;ctx.fillRect(Math.cos(angle)*radius,Math.sin(angle)*radius,3,3);}}ctx.restore();}}
}
