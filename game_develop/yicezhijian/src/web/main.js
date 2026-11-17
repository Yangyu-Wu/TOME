import {GameApp} from '../core/game-app.js';
import {BrowserStorage} from '../platform/storage.js';
import {CanvasRenderer} from './canvas-renderer.js';
import {DeploymentView} from './deployment-view.js';
import {BattleAudio} from './battle-audio.js';
import {GpuHeroLayer} from './gpu-hero-layer.js';

const canvas=document.querySelector('#game');
const app=new GameApp({storage:new BrowserStorage(),testMode:true});
const renderer=new CanvasRenderer(canvas);
const gpuCanvas=document.querySelector('#gpu-heroes'),gpuEnabled=new URLSearchParams(location.search).get('gpuHeroes')!=='0';
let gpuHeroes=null;
const gpuUnits=state=>[
  ...state.enemies.filter(unit=>unit.visual).map(unit=>({...unit,enemy:true})),
  ...state.roster.filter(unit=>unit.slot==='front'&&unit.currentHp>0).map(unit=>({...unit,enemy:false})),
  ...(state.summons||[]).filter(unit=>unit.visual&&!unit.dead).map(unit=>({...unit,enemy:false}))
];
if(gpuEnabled&&gpuCanvas){
  document.querySelector('.stage-wrap')?.classList.add('gpu-heroes-enabled');renderer.gpuHeroesEnabled=true;
  gpuHeroes=new GpuHeroLayer(gpuCanvas);gpuHeroes.load('../src/assets/heroes/animations/quaternius-ual2/ual2-standard.glb','../src/assets/heroes/models/quaternius-base-male/Superhero_Male_FullBody.gltf').catch(error=>{console.warn('GPU hero layer unavailable; using Canvas heroes',error);gpuHeroes.dispose();gpuHeroes=null;renderer.gpuHeroesEnabled=false;document.querySelector('.stage-wrap')?.classList.remove('gpu-heroes-enabled');});
}
const deployment=new DeploymentView(document.querySelector('#deployment-root'),app);
const audio=new BattleAudio(),soundButton=document.querySelector('#sound-toggle');
document.addEventListener('pointerdown',()=>audio.unlock(),{once:true});
soundButton?.addEventListener('click',()=>{const enabled=audio.toggle();soundButton.textContent=enabled?'音效：开':'音效：关';soundButton.setAttribute('aria-pressed',String(enabled));});
let renderedPhase;
app.subscribe(state=>{
  // Commands update UI immediately; battle frames follow the display clock.
  // Multiple simulation ticks within one browser frame must not rasterize unseen HD frames.
    if(state.phase!=='battle'||renderedPhase!=='battle'){renderer.render(state);if(gpuHeroes&&state.phase==='battle')gpuHeroes.render(gpuUnits(state),state.projectiles,state.effects);}
  renderedPhase=state.phase;deployment.render(state);audio.sync(state);
});
app.load();
let last=performance.now();
function frame(now){
  const interval=app.state.phase==='battle'?1000/60:1000/30;
  if(now-last>=interval-.5){
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if(app.state.phase==='battle'){app.tick(dt);if(app.state.phase==='battle'){renderer.render(app.state);if(gpuHeroes)gpuHeroes.render(gpuUnits(app.state),app.state.projectiles,app.state.effects);}}
    else renderer.render(app.state);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

export {app,renderer,audio};
