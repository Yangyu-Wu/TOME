import * as THREE from '../../vendor/three/three.module.min.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {clone} from '../../vendor/three/SkeletonUtils.js';
import {findActionClip} from '../assets/heroes/action-library.js';
import {attachHeroWeapon,animateHeroWeapon} from '../assets/heroes/equipment/melee-weapons.js';
import {attachHeroArmor,attachHeroCape,animateHeroCape,animateHeroArmor,releaseHeroArmorMaps} from '../assets/heroes/equipment/armor.js';
import {attachHeroIdentity,animateHeroIdentity} from '../assets/heroes/equipment/identity.js';
import {blendMovingAttack} from '../assets/heroes/moving-attack.js';
import {applyCombatPose} from '../assets/heroes/combat-pose.js';
import {restoreAuthoredPose,captureAuthoredPose} from '../assets/heroes/pose-layer.js';
import {applyFootContact} from '../assets/heroes/foot-contact.js';
import {updateBladeTrail} from '../assets/heroes/equipment/weapon-trail.js';
import {createPolearmClips} from '../assets/heroes/animations/polearm/poses.js';
import {attachPolearmGrip,applyPolearmGrip,polearmProfileFor} from '../assets/heroes/equipment/polearm-grip.js';
import {retargetClips} from '../assets/heroes/retarget-clips.js';
import {createMeleeImpact,updateMeleeImpact,disposeMeleeImpact} from '../assets/effects/melee-impact.js';
import {attachPolearmStance,applyPolearmStance} from '../assets/heroes/polearm-stance.js';

function reverseClip(clip){
  if(!clip)return null;
  const tracks=clip.tracks.map(source=>{
    const track=source.clone(),times=source.times,values=source.values,size=source.getValueSize(),reversedTimes=new times.constructor(times.length),reversedValues=new values.constructor(values.length);
    for(let key=0;key<times.length;key++){
      const from=times.length-1-key;reversedTimes[key]=clip.duration-times[from];
      for(let component=0;component<size;component++)reversedValues[key*size+component]=values[from*size+component];
    }
    track.times=reversedTimes;track.values=reversedValues;return track;
  });
  return new THREE.AnimationClip(`${clip.name}_Reverse`,clip.duration,tracks,clip.blendMode);
}

function makeRadialShadowTexture(){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');
  const gradient=ctx.createRadialGradient(64,64,4,64,64,62);gradient.addColorStop(0,'rgba(0,0,0,.62)');gradient.addColorStop(.36,'rgba(0,0,0,.38)');gradient.addColorStop(.72,'rgba(0,0,0,.12)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;return texture;
}
function makeDashStreakTexture(){
  const c=document.createElement('canvas');c.width=128;c.height=32;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,128,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.45,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,32);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function makeHeroEnvironment(renderer){
  // A softbox studio cubemap gives armor and weapon metals structured
  // reflections instead of the flat tint produced by six 2x2 color faces.
  // It is generated once at load, then filtered to a PMREM for roughness LOD.
  const size=128,faces=[];
  const palettes=[['#26364b','#afc8df','#f1ba83'],['#364b60','#d8e4e9','#ffffff'],['#53392e','#d9b78d','#fff0d8'],['#1a2639','#829ab3','#d8e6f1'],['#172033','#546b87','#ecb67e'],['#30475e','#a6c2d5','#f8dbad']];
  for(let index=0;index<6;index++){
    const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d'),[low,mid,high]=palettes[index];
    const bg=ctx.createLinearGradient(0,0,size,size);bg.addColorStop(0,high);bg.addColorStop(.24,mid);bg.addColorStop(.62,low);bg.addColorStop(1,'#111827');ctx.fillStyle=bg;ctx.fillRect(0,0,size,size);
    // Broad vertical key and cool fill cards create readable elongated
    // highlights on curved metal without a costly external HDR image.
    for(const [x,y,w,h,color,alpha] of [[size*.12,size*.12,size*.16,size*.72,'#fff4dc',.9],[size*.68,size*.08,size*.1,size*.48,'#d9ecff',.72],[size*.4,size*.78,size*.4,size*.08,'#f1b77d',.65]]){
      const glow=ctx.createLinearGradient(x,0,x+w,0);glow.addColorStop(0,'rgba(255,255,255,0)');glow.addColorStop(.5,color);glow.addColorStop(1,'rgba(255,255,255,0)');ctx.globalAlpha=alpha;ctx.fillStyle=glow;ctx.fillRect(x,y,w,h);
    }
    ctx.globalAlpha=1;faces.push(canvas);
  }
  // Keep the generated cubemap as the scene environment. Three.js builds the
  // filtered PMREM lazily when the first frame actually needs it; eagerly
  // invoking PMREMGenerator here can synchronously stall headless/WebGL
  // contexts before GLTF requests even begin (and blocks the loading UI).
  const raw=new THREE.CubeTexture(faces);raw.colorSpace=THREE.SRGBColorSpace;raw.needsUpdate=true;raw.userData={sourceFaceSize:size,softboxCards:3,faces:faces.length};return raw;
}

// UAL1 supplies authored jog/sprint loops; UAL2 supplies combat actions.
// The default transparent GPU pass owns heroes; terrain, props and HUD
// remain in CanvasRenderer until depth/occlusion are unified.
export class GpuHeroLayer {
  constructor(canvas,{width=960,height=600,pixelRatio=2}={}){
    this.canvas=canvas;this.width=width;this.height=height;this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const gl=this.renderer.getContext(),maxTextureSize=gl.getParameter(gl.MAX_TEXTURE_SIZE)||2048,maxSamples=gl.getParameter(gl.MAX_SAMPLES)||0;
    const devicePixelRatio=globalThis.devicePixelRatio||1;
    this.qualityProfile=maxTextureSize>=8192&&maxSamples>=4?{tier:'ultra',pixelRatio:Math.min(pixelRatio,2),shadowSize:2048}:{tier:maxTextureSize>=4096? 'high':'balanced',pixelRatio:Math.min(pixelRatio,maxTextureSize>=4096?1.75:1.35),shadowSize:maxTextureSize>=4096?1024:512};
    // Keep a small amount of GPU supersampling even on a DPR=1 display. The
    // transparent hero pass is composited over a CSS-sized canvas, so this
    // improves silhouette/alpha edges without changing layout dimensions.
    const displayRatio=Math.max(1,devicePixelRatio||1);this.qualityProfile.pixelRatio=Math.min(this.qualityProfile.pixelRatio,Math.max(displayRatio,1.35));this.renderer.setPixelRatio(this.qualityProfile.pixelRatio);this.renderer.setSize(width,height,false);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    // ACES preserves highlight detail and gives the transparent hero layer a
    // more cinematic shadow roll-off on high-DPI displays.
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;this.renderer.setClearColor(0,0);
    this.scene=new THREE.Scene();this.scene.environment=makeHeroEnvironment(this.renderer);
    // Screen-space units use X right and Y up (height - battlefield Y).
    // Center both the camera and its symmetric frustum on that same plane.
    this.camera=new THREE.OrthographicCamera(-width/2,width/2,height/2,-height/2,.1,2000);
    this.camera.position.set(width/2,height/2,500);this.camera.lookAt(width/2,height/2,0);
    this.scene.add(new THREE.HemisphereLight('#d7edff','#33251e',2.1));const key=new THREE.DirectionalLight('#ffe0b0',2.4);key.position.set(width*.18,height*.9,460);key.target.position.set(width/2,height/2,0);key.castShadow=true;key.shadow.mapSize.set(this.qualityProfile.shadowSize,this.qualityProfile.shadowSize);key.shadow.camera.left=-width*.58;key.shadow.camera.right=width*.58;key.shadow.camera.top=height*.62;key.shadow.camera.bottom=-height*.62;key.shadow.camera.near=1;key.shadow.camera.far=1200;key.shadow.bias=-.00018;key.shadow.normalBias=.025;key.shadow.radius=this.qualityProfile.tier==='ultra'?5:3;this.scene.add(key,key.target);this.keyLight=key;const fill=new THREE.DirectionalLight('#6aa6ff',.65);fill.position.set(4,1,3);this.scene.add(fill);
    this.loader=new GLTFLoader();this.actors=new Map();this.projectileMeshes=new Map();this.ready=false;this.source=null;this.clips=[];this.clock=new THREE.Clock();this.frameSamples=[];this.qualityBaseRatio=this.qualityProfile.pixelRatio;
  }
  async load(url='../src/assets/heroes/animations/quaternius-ual2/ual2-standard.glb',modelUrl=null){
    const animationGltf=await this.loader.loadAsync(url),gltf=modelUrl?await this.loader.loadAsync(modelUrl):animationGltf;this.source=gltf.scene;this.clips=animationGltf.animations;this.deathClip=reverseClip(this.clips.find(clip=>clip.name.toLowerCase()==='laytoidle'));
    const locomotion=await Promise.all(['Jog_Fwd_Loop','Sprint_Loop'].map(async name=>{
      const response=await fetch(new URL(`../assets/heroes/animations/quaternius-ual1/${name}.json`,import.meta.url));
      if(!response.ok)throw new Error(`Locomotion asset ${name}: HTTP ${response.status}`);
      return THREE.AnimationClip.parse(await response.json());
    }));
    this.clips=retargetClips(animationGltf.scene,this.source,[...this.clips,...locomotion]);
    this.deathClip=reverseClip(this.clips.find(clip=>clip.name.toLowerCase()==='laytoidle'));
    this.polearmClips=createPolearmClips(this.clips);
    const maxAnisotropy=this.renderer.capabilities.getMaxAnisotropy();
    this.source.traverse(obj=>{if(obj.isMesh){obj.frustumCulled=false;obj.castShadow=true;obj.receiveShadow=true;
      // Keep the imported Standard materials and their source texture maps;
      // authored equipment uses Physical where its metal highlights benefit.
      const upgrade=sourceMaterial=>sourceMaterial.clone();
      obj.material=Array.isArray(obj.material)?obj.material.map(upgrade):upgrade(obj.material);
      const materials=Array.isArray(obj.material)?obj.material:[obj.material];
      for(const material of materials){
        // The neutral hair map is nearly white; supply its intended dark hair
        // tint without dyeing hair, eyes or authored equipment by team color.
        if(material.name==='MI_Hair_1')material.color.set('#241d19');
        if(material.name==='MI_Hair_1'||material.name==='MI_Eyes')material.userData.authoredHeroPalette=true;
        if('roughness'in material)material.roughness=Math.max(material.roughness??.58,.42);
        if(material.map){material.map.anisotropy=maxAnisotropy;material.map.minFilter=THREE.LinearMipmapLinearFilter;material.map.generateMipmaps=true;material.map.colorSpace=THREE.SRGBColorSpace;material.map.needsUpdate=true;}
        if(material.normalMap){material.normalMap.anisotropy=maxAnisotropy;material.normalMap.minFilter=THREE.LinearMipmapLinearFilter;material.normalMap.colorSpace=THREE.NoColorSpace;material.normalScale?.set(.9,.9);material.normalMap.needsUpdate=true;}
        if(material.roughnessMap){material.roughnessMap.anisotropy=maxAnisotropy;material.roughnessMap.colorSpace=THREE.NoColorSpace;material.roughnessMap.needsUpdate=true;}
        material.userData={...(material.userData||{}),hasBaseMap:Boolean(material.map),hasNormalMap:Boolean(material.normalMap),hasRoughnessMap:Boolean(material.roughnessMap),assetMaterialModel:material.isMeshPhysicalMaterial?'physical':'standard'};
      }
    }});
    const box=new THREE.Box3().setFromObject(this.source),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    // Match the battlefield's existing 63px visual-unit anchor; boss/elite
    // multipliers below then align their silhouettes with Canvas nameplates.
    this.source.position.sub(center);this.source.position.y+=size.y*.5;this.scale=70/size.y;this.ready=true;return {clips:this.clips.length,sourceHeight:size.y,modelMeshes:this.countMeshes(),renderedUnitHeight:70};
  }
  countMeshes(){let count=0;this.source.traverse(obj=>{if(obj.isMesh)count++;});return count;}
  actorFor(unit){
    const id=unit.id||unit.heroId||unit.name||String(unit.x)+':'+String(unit.y);let actor=this.actors.get(id);if(actor)return actor;
    const root=clone(this.source);root.scale.setScalar(this.scale);root.traverse(obj=>{if(obj.isMesh){obj.frustumCulled=false;obj.castShadow=true;obj.receiveShadow=true;if(obj.material){obj.material=obj.material.clone();obj.material.userData={...(obj.material.userData||{}),hasBaseMap:Boolean(obj.material.map)};}}});this.scene.add(root);
    // A soft contact shadow gives the transparent character pass a believable
    // connection to the Canvas battlefield. It is deliberately kept behind
    // the rig and uses no texture so it remains cheap on integrated GPUs.
    const shadowTexture=this.shadowTexture||(this.shadowTexture=makeRadialShadowTexture());const shadow=new THREE.Mesh(new THREE.PlaneGeometry(54,30),new THREE.MeshBasicMaterial({color:0x07101c,map:shadowTexture,transparent:true,opacity:.34,depthTest:false,depthWrite:false,toneMapped:false}));
    shadow.renderOrder=-10;this.scene.add(shadow);
    const mixer=new THREE.AnimationMixer(root),runtimeClips=[...this.clips,...this.polearmClips,...(this.deathClip?[this.deathClip]:[])];
    // The battlefield is the XY plane and the camera looks along -Z; keep the
    // ring coplanar with the ground so its full silhouette faces the camera.
    const aura=new THREE.Mesh(new THREE.TorusGeometry(unit.boss?25:19,unit.boss?1.8:1.15,8,40),new THREE.MeshBasicMaterial({color:unit.enemy?0xd83e58:0x4e9cff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false}));aura.visible=Boolean(unit.elite||unit.boss);aura.renderOrder=5;this.scene.add(aura);actor={id,root,shadow,aura,mixer,actions:new Map(runtimeClips.map(clip=>[clip.name,mixer.clipAction(clip)])),current:null,lastState:null,team:null,sizeClass:null,baseRotation:root.rotation.z,deathStarted:null,materialOpacity:[],trailPoints:[],weaponTrail:null,arrowProjectiles:[],seenBowShot:0,motionOffset:0,groundOffset:0,groundY:0,airborne:false};attachHeroWeapon(actor,unit.role,unit.heroId);attachPolearmGrip(actor,this.clips);attachHeroArmor(actor,unit.role,unit.enemy?'enemy':'ally',unit.heroId);attachHeroIdentity(actor,unit.heroId,unit.enemy,{role:unit.role,faction:unit.faction});attachPolearmStance(actor);if(unit.elite||unit.boss)attachHeroCape(actor,{boss:Boolean(unit.boss),faction:unit.enemy?'enemy':'ally'});
    actor.runBones={thighL:root.getObjectByName('thigh_l'),thighR:root.getObjectByName('thigh_r'),calfL:root.getObjectByName('calf_l'),calfR:root.getObjectByName('calf_r'),footL:root.getObjectByName('foot_l'),footR:root.getObjectByName('foot_r'),upperL:root.getObjectByName('upperarm_l'),upperR:root.getObjectByName('upperarm_r'),forearmL:root.getObjectByName('lowerarm_l'),forearmR:root.getObjectByName('lowerarm_r'),lowerL:root.getObjectByName('lowerarm_l'),lowerR:root.getObjectByName('lowerarm_r'),spine:root.getObjectByName('spine_03'),spineMid:root.getObjectByName('spine_02')};
    root.traverse(obj=>{if(obj.isMesh){obj.renderOrder=1;for(const material of (Array.isArray(obj.material)?obj.material:[obj.material]))actor.materialOpacity.push([material,material.opacity]);}});this.actors.set(id,actor);return actor;
  }
  stateFor(unit,actor){if(unit.dead)return 'death';if(actor.polearmRig&&unit.attackMotion){if(unit.attackMotion.active)return 'attack';if(unit.hitFlash>0)return 'hit';return unit.moving?((unit.speed||0)>65?'run':'walk'):'idle';}if(unit.hitFlash>0)return 'hit';if(unit.attackFlash>0||(actor.lastState==='attack'&&actor.current?.isRunning()))return 'attack';if(actor.lastState==='attack'&&actor.current&&!actor.current.isRunning())return 'attackRecovery';const fast=unit.role==='cavalry'||(unit.speed||0)>65;if(unit.moving&&fast){if(actor.lastState==='dash'&&actor.current?.isRunning())return 'dash';if(!actor.wasMoving&&this.dashClipFor(unit))return 'dash';return 'run';}return unit.moving?'walk':'idle';}
  dashClipFor(unit){const names=unit.role==='cavalry'?['Shield_Dash','Sword_Dash']:['Sword_Dash','Shield_Dash'];return names.map(name=>this.clips.find(clip=>clip.name===name)).find(Boolean)||findActionClip(this.clips,'dash');}
  runClipFor(unit){return this.clips.find(clip=>clip.name===((unit.speed||78)>=95?'Sprint_Loop':'Jog_Fwd_Loop'))||findActionClip(this.clips,'run');}
  attackClipFor(unit){const profile=polearmProfileFor(unit);if(profile){const clip=this.polearmClips.find(c=>c.name===profile.name);if(clip)return clip;}const preferences={archer:['OverhandThrow','Sword_Regular_A'],cavalry:['Sword_Regular_Combo','Sword_Regular_A','Melee_Hook'],spear:['Sword_Heavy_Combo','Melee_Hook'],sword:['Sword_Regular_Combo','Melee_Hook'],assassin:['Sword_Regular_A','Melee_Hook'],mage:['OverhandThrow','Melee_Hook'],support:['Melee_Hook','Sword_Regular_A']};const names=preferences[unit.role]||[];return names.map(name=>this.clips.find(clip=>clip.name===name)).find(Boolean)||findActionClip(this.clips,'attack');}
  updateUnit(unit,dt=1/60){if(!this.ready)return;const actor=this.actorFor(unit),state=this.stateFor(unit,actor),clip=state==='death'?(this.deathClip||findActionClip(this.clips,'death')):state==='attack'?this.attackClipFor(unit):state==='dash'?this.dashClipFor(unit):(state==='run'?this.runClipFor(unit)||findActionClip(this.clips,'walk'):findActionClip(this.clips,state));
    const motion=actor.polearmRig?unit.attackMotion:null;
    const repeatPolearm=actor.polearmRig&&state==='attack'&&(motion?actor.attackSequence!==motion.sequence:actor.current?.time>=clip?.duration);
    if(clip&&(actor.lastState!==state||actor.current?.getClip()!==clip||repeatPolearm)){
      const next=actor.actions.get(clip.name);
      if(next){
        const movingStates=['walk','run'];
        const matchStride=actor.current&&movingStates.includes(state)&&movingStates.includes(actor.lastState);
        const stride=matchStride?((actor.current.time/actor.current.getClip().duration)%1+1)%1:0;
        next.reset();
        if(matchStride)next.time=stride*clip.duration;
        if(['attack','attackRecovery','hit','death','dash'].includes(state)){next.setLoop(THREE.LoopOnce,1);next.clampWhenFinished=true;}
        else{next.setLoop(THREE.LoopRepeat,Infinity);next.clampWhenFinished=false;}
        actor.usesDeathClip=state==='death'&&clip.name.toLowerCase().includes('reverse');
        next.timeScale=state==='run'?Math.max(.8,Math.min(1.25,(unit.speed||78)/(clip.name==='Sprint_Loop'?105:78))):state==='walk'?Math.max(.86,Math.min(1.22,(unit.speed||58)/58)):1;
        next.setEffectiveWeight(1);
        if(actor.current&&actor.current!==next){const blend=(state==='hit'||state==='dash')?.07:state==='attackRecovery'?.18:.12;actor.lastBlendDuration=blend;next.crossFadeFrom(actor.current,blend,!matchStride&&!motion);}
        else{actor.lastBlendDuration=.12;next.fadeIn(.12);}
        next.play();actor.current=next;actor.lastState=state;
      }
    }
    if(motion?.active&&state==='attack'&&actor.current){
      actor.attackSequence=motion.sequence;actor.current.paused=true;
      actor.current.time=Math.min(1,Math.max(0,motion.age/motion.duration))*actor.current.getClip().duration;
    }
    actor.trailArmed=state==='attack'&&Boolean(unit.attackFlash>0);actor.wasMoving=Boolean(unit.moving);actor.locomotionSpeed=unit.speed||58;actor.runIntensity=Math.max(.72,Math.min(1.42,(unit.speed||58)/58));actor.runRole=unit.role||'spear';actor.facingSign=unit.facing<0?-1:1;actor.attackPhase=state==='attack'&&actor.current?Math.max(0,Math.min(1,actor.current.time/Math.max(.001,actor.current.getClip().duration))):0;actor.hitWeight=state==='hit'?Math.max(0,Math.min(1,(unit.hitFlash||0)/.14))*(unit.hitStrength||1):0;actor.runProfile=actor.runRole==='cavalry'?{cadence:.82,leg:1.2,arm:.78,lean:1.28}:actor.runRole==='assassin'?{cadence:1.28,leg:.78,arm:1.12,lean:.72}:{cadence:1,leg:1,arm:1,lean:1};
    const locomotionClip=actor.current?.getClip(),locomotionDuration=locomotionClip?.duration||1;
    if(state==='run'&&actor.current)actor.current.timeScale=Math.max(.8,Math.min(1.25,(unit.speed||78)/(locomotionClip.name==='Sprint_Loop'?105:78)));
    actor.locomotionPhase=actor.current?((actor.current.time/locomotionDuration)*Math.PI*2):0;actor.gaitPhase=Number.isFinite(unit.walkPhase)?unit.walkPhase:actor.locomotionPhase;
    actor.trailArmed=state==='attack'&&Boolean(unit.attackFlash>0);
    const team=unit.enemy?'enemy':'ally',sizeClass=unit.boss?'boss':unit.elite?'elite':'normal';
    if(actor.team!==team||actor.sizeClass!==sizeClass){const tint=team==='enemy'?'#ffd2d6':'#c9dcff';actor.root.traverse(obj=>{if(!obj.isMesh||!obj.material)return;for(const material of (Array.isArray(obj.material)?obj.material:[obj.material])){if(!material.userData.heroArmorPalette&&!material.userData.authoredHeroPalette&&material.color)material.color.set(tint);if('roughness'in material&&!material.userData.heroArmorPalette&&!material.userData.authoredHeroPalette)material.roughness=.5;if('metalness'in material&&!material.userData.heroArmorPalette&&!material.userData.authoredHeroPalette)material.metalness=.12;if('emissive'in material&&!material.userData.authoredHeroPalette){material.emissive.set(team==='enemy'?'#6d101b':'#123b78');material.emissiveIntensity=.12;}}});actor.shadow.material.color.set(team==='enemy'?0x3b0d18:0x071c3a);actor.team=team;actor.sizeClass=sizeClass;}
    // Keep hero silhouettes in step with CanvasRenderer's normal/elite/boss
    // scale classes (1 / 1.75 / 2.8) while using the higher quality rig.
    const size=sizeClass==='boss'?2.45:sizeClass==='elite'?1.58:1,dead=Boolean(unit.dead),deathAge=unit.deathAge||0;
    // Small anticipation/recoil offsets make attacks readable even when the
    // source library has only generic humanoid clips. The spring returns the
    // rig to its simulation position without introducing network-visible drift.
    const facing=unit.facing<0?-1:1,attackPhase=state==='attack'&&actor.current?Math.max(0,Math.min(1,actor.current.time/Math.max(.001,actor.current.getClip().duration))):0,attackProfile=unit.role==='cavalry'?{base:7,lunge:10,lean:.09}:unit.role==='assassin'?{base:5,lunge:6,lean:.075}:unit.role==='archer'||unit.role==='mage'||unit.role==='support'?{base:-1.5,lunge:-2,lean:.018}:{base:5,lunge:8,lean:.055},attackBase=attackProfile.base,attackLunge=state==='attack'?Math.sin(Math.PI*attackPhase)*attackProfile.lunge:0,targetOffset=actor.stance&&state==='attack'?0:state==='attack'?facing*(attackBase+attackLunge):state==='hit'?-facing*4:0;actor.motionOffset+=(targetOffset-actor.motionOffset)*Math.min(1,dt*18);
    const renderX=unit.x+actor.motionOffset,cycle=Number.isFinite(unit.walkPhase)?unit.walkPhase:this.clock.elapsedTime;
    const locomotionBob=unit.moving?-Math.abs(Math.sin(cycle*1.05))*1.8:Math.sin(cycle*1.7)*.55;
    const airBob=unit.airHeight?Math.sin(cycle*2.2)*Math.min(1.8,unit.airHeight*.035):0;
    actor.root.scale.setScalar(this.scale*size);if(state==='hit')actor.root.scale.y*=1-Math.max(0,Math.min(1,(unit.hitFlash||0)/.14))*.045;if(state==='dash'&&actor.current){const dashProgress=Math.max(0,Math.min(1,actor.current.time/Math.max(.001,actor.current.getClip().duration))),dashPulse=Math.sin(Math.PI*dashProgress);actor.root.scale.x*=1+dashPulse*.08;actor.root.scale.y*=1-dashPulse*.035;}const groundY=this.height-unit.y-(unit.airHeight||0)+locomotionBob+airBob;actor.groundY=this.height-unit.y;actor.contactSize=size;actor.airborne=Boolean((unit.airHeight||0)>2);actor.root.position.set(renderX,groundY,-(unit.y||0)*.01);actor.root.rotation.y=actor.polearmRig?(unit.facing<0?-Math.PI/2:Math.PI/2):(unit.facing<0?Math.PI:0);
    actor.aura.position.set(renderX,this.height-unit.y+8,-(unit.y||0)*.01-6);actor.aura.scale.setScalar(size*(1+Math.sin(cycle*2.2)*.035));actor.aura.material.opacity=dead?0:(unit.boss?.28:.18)+((state==='hit'?unit.hitFlash:state==='attack'?unit.attackFlash:0)||0)*.55;actor.aura.visible=Boolean((unit.elite||unit.boss)&&(!dead||deathAge<.8));
    const hitWeight=state==='hit'?Math.max(0,Math.min(1,(unit.hitFlash||0)/.14))*(unit.hitStrength||1):0,impactDirection=unit.hitDirection<0?-1:1,hitLean=-impactDirection*.12*hitWeight,attackLean=state==='attack'?unit.facing*(attackPhase<.32?-attackProfile.lean*(attackPhase/.32):attackProfile.lean*(1-Math.max(0,attackPhase-.32)/.68)):0;
    actor.root.rotation.z=actor.stance&&state==='attack'?actor.baseRotation:dead&&!actor.usesDeathClip?actor.baseRotation+Math.min(1,deathAge/.32)*Math.PI*.46:actor.baseRotation+(unit.moving?Math.sin(cycle*1.05)*.018:Math.sin(cycle*1.7)*.006)+attackLean+hitLean;
    /* Larger battlefield Y is closer to the viewer, matching Canvas sort. */actor.root.renderOrder=100+(unit.y||0);actor.root.traverse(obj=>{if(obj.isMesh)obj.renderOrder=actor.root.renderOrder+1;});actor.shadow.position.set(renderX,this.height-unit.y+12,-(unit.y||0)*.01-8);actor.shadow.renderOrder=actor.root.renderOrder-2;const shadowSpread=Math.min(.55,Math.max(0,(unit.airHeight||0)/220));const shadowScale=size*(1+shadowSpread);actor.shadow.scale.set(shadowScale,shadowScale*.56+size*.44,1);actor.shadow.material.opacity=dead?0:.34*Math.max(.18,1-shadowSpread*1.6);actor.shadow.visible=!dead||deathAge<.8;
    // Reverse LayToIdle into a fall. If a future library lacks it, the compact
    // root-tilt fallback remains available.
    animateHeroCape(actor,{time:cycle,moving:unit.moving,attack:state==='attack',hit:state==='hit',airHeight:unit.airHeight||0,hitDirection:impactDirection,hitStrength:hitWeight});animateHeroArmor(actor,{time:cycle,moving:unit.moving,attack:state==='attack',hit:state==='hit',dash:state==='dash'});animateHeroWeapon(actor,{time:cycle,dt,moving:unit.moving,attack:state==='attack',hit:state==='hit'});animateHeroIdentity(actor,{time:cycle,moving:unit.moving,attack:state==='attack',hit:state==='hit',airHeight:unit.airHeight||0,hitDirection:impactDirection,hitStrength:hitWeight});
    // Brief HDR pulse on impact/strike separates the action silhouette from
    // the terrain without washing out the model's base-color textures.
    const pulse=state==='hit'?Math.max(0,Math.min(1,(unit.hitFlash||0)/.14)):state==='attack'?Math.max(0,Math.min(1,(unit.attackFlash||0)/.2))*.35:state==='dash'&&actor.current?Math.sin(Math.PI*Math.max(0,Math.min(1,actor.current.time/Math.max(.001,actor.current.getClip().duration))))*.24:0;
    actor.root.traverse(obj=>{if(!obj.isMesh||!obj.material)return;for(const material of (Array.isArray(obj.material)?obj.material:[obj.material]))if('emissiveIntensity'in material){if(material.userData.baseEmissiveIntensity===undefined)material.userData.baseEmissiveIntensity=material.emissiveIntensity||0;material.emissiveIntensity=material.userData.baseEmissiveIntensity+pulse*.42;}});
    for(const [material,baseOpacity] of actor.materialOpacity){const transparent=dead||baseOpacity<1;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}material.opacity=dead?baseOpacity*Math.max(0,1-deathAge/.8):baseOpacity;}
    actor.root.visible=!dead||deathAge<.8;
  }
  spawnArrow(actor,facing){const source=actor.weapon?.userData.bowArrow;if(!source)return;const mesh=source.clone();mesh.geometry=source.geometry.clone();mesh.material=Array.isArray(source.material)?source.material.map(m=>m.clone()):source.material.clone();for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){material.transparent=true;material.depthWrite=false;material.toneMapped=false;}const position=new THREE.Vector3();source.getWorldPosition(position);mesh.position.copy(position);mesh.rotation.set(0,0,facing<0?Math.PI/2:-Math.PI/2);mesh.scale.setScalar(1.25);mesh.visible=true;mesh.renderOrder=actor.root.renderOrder+8;this.scene.add(mesh);actor.arrowProjectiles.push({mesh,age:0,facing});if(actor.arrowProjectiles.length>6){const old=actor.arrowProjectiles.shift();this.scene.remove(old.mesh);old.mesh.geometry.dispose();(Array.isArray(old.mesh.material)?old.mesh.material:[old.mesh.material]).forEach(m=>m.dispose());}}
  updateArrows(actor,dt){for(let i=actor.arrowProjectiles.length-1;i>=0;i--){const arrow=actor.arrowProjectiles[i];arrow.age+=dt;arrow.mesh.position.x+=arrow.facing*430*dt;arrow.mesh.position.y-=82*dt;for(const material of (Array.isArray(arrow.mesh.material)?arrow.mesh.material:[arrow.mesh.material]))material.opacity=Math.max(0,1-arrow.age/1.35);if(arrow.age>=1.35){this.scene.remove(arrow.mesh);arrow.mesh.geometry.dispose();(Array.isArray(arrow.mesh.material)?arrow.mesh.material:[arrow.mesh.material]).forEach(m=>m.dispose());actor.arrowProjectiles.splice(i,1);}}}
  updateBattleProjectiles(projectiles=[]){const active=new Set();for(const shot of projectiles){active.add(shot.id);let arrow=this.projectileMeshes.get(shot.id);if(!arrow){arrow=new THREE.Group();const color=shot.color||'#75baff',material=new THREE.MeshBasicMaterial({color,toneMapped:false});const shaft=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,18,6),material);shaft.rotation.z=-Math.PI/2;shaft.position.x=-2;const tip=new THREE.Mesh(new THREE.ConeGeometry(2.8,7,6),new THREE.MeshBasicMaterial({color:'#e9dfc1',toneMapped:false}));tip.rotation.z=-Math.PI/2;tip.position.x=9;arrow.add(shaft,tip);arrow.renderOrder=1100;this.scene.add(arrow);this.projectileMeshes.set(shot.id,arrow);}arrow.position.set(shot.x,this.height-shot.y,15);arrow.rotation.z=Math.atan2(-shot.vy,shot.vx);arrow.visible=true;}
    for(const [id,arrow] of this.projectileMeshes)if(!active.has(id)){this.scene.remove(arrow);arrow.traverse(part=>{if(part.isMesh){part.geometry.dispose();part.material.dispose();}});this.projectileMeshes.delete(id);}}
  updateWeaponTrail(actor,attacking,dt){updateBladeTrail(this.scene,actor,attacking,dt);}
  updateMeleeImpacts(effects=[]){
    this.meleeImpacts??=new Map();const active=new Set();
    for(const effect of effects){
      if(effect.kind!=='melee'||!effect.id||effect.life<=0)continue;
      active.add(effect.id);let sparks=this.meleeImpacts.get(effect.id);
      if(!sparks){sparks=createMeleeImpact();this.scene.add(sparks);this.meleeImpacts.set(effect.id,sparks);}
      updateMeleeImpact(sparks,effect,{height:this.height,pixelRatio:this.renderer.getPixelRatio(),zoom:this.camera.zoom});
    }
    for(const [id,sparks] of this.meleeImpacts)if(!active.has(id)){disposeMeleeImpact(sparks);this.meleeImpacts.delete(id);}
  }
  applyFootContact(actor,dt){
    applyFootContact(actor,dt);
  }
  render(units=[],projectiles=[],effects=[]){if(!this.ready)return;const dt=Math.min(.05,this.clock.getDelta()),active=new Set();for(const unit of units){this.updateUnit(unit,dt);active.add(this.actorFor(unit).id);}this.updateBattleProjectiles(projectiles);this.updateMeleeImpacts(effects);for(const [id,actor] of this.actors)if(!active.has(id)){actor.root.visible=false;actor.shadow.visible=false;if(actor.weaponTrail)actor.weaponTrail.visible=false;}for(const actor of this.actors.values()){restoreAuthoredPose(actor);actor.mixer.update(dt);actor.attackPhase=actor.lastState==='attack'&&actor.current?Math.max(0,Math.min(1,actor.current.time/actor.current.getClip().duration)):0;captureAuthoredPose(actor);this.updateArrows(actor,dt);const lowerClip=actor.locomotionSpeed>65?this.runClipFor({speed:actor.locomotionSpeed}):findActionClip(this.clips,'walk');actor.locomotionRate=Math.max(.8,Math.min(1.25,actor.locomotionSpeed/(lowerClip?.name==='Sprint_Loop'?105:78)));blendMovingAttack(actor,lowerClip,dt);applyCombatPose(actor,actor.attackPhase,actor.runRole||'spear',actor.lastState,actor.facingSign||1);this.applyFootContact(actor,dt);applyPolearmStance(actor);applyPolearmGrip(actor,dt);this.updateWeaponTrail(actor,actor.lastState==='attack',dt);}this.frameSamples.push(dt);if(this.frameSamples.length>=30){const avg=this.frameSamples.reduce((sum,value)=>sum+value,0)/this.frameSamples.length;this.frameSamples.length=0;const current=this.renderer.getPixelRatio(),minRatio=Math.min(1.35,this.qualityBaseRatio),maxRatio=this.qualityBaseRatio;if(avg>.041&&current>minRatio+.01)this.renderer.setPixelRatio(Math.max(minRatio,current-.1));else if(avg<.024&&current<maxRatio-.01)this.renderer.setPixelRatio(Math.min(maxRatio,current+.1));}/* Canvas owns the top HUD; keep the transparent hero pass below it. */this.renderer.setScissorTest(false);this.renderer.clear();this.renderer.setScissorTest(true);this.renderer.setScissor(0,0,this.width,Math.max(0,this.height-116));this.renderer.render(this.scene,this.camera);this.renderer.setScissorTest(false);}
  dispose(){for(const sparks of this.meleeImpacts?.values()||[])disposeMeleeImpact(sparks);this.meleeImpacts?.clear();for(const actor of this.actors.values()){this.scene.remove(actor.root);this.scene.remove(actor.shadow);this.scene.remove(actor.aura);this.scene.remove(actor.weaponTrail);for(const arrow of actor.arrowProjectiles||[]){this.scene.remove(arrow.mesh);arrow.mesh.geometry.dispose();(Array.isArray(arrow.mesh.material)?arrow.mesh.material:[arrow.mesh.material]).forEach(m=>m.dispose());}actor.mixer.stopAllAction();actor.root.traverse(obj=>obj.customDepthMaterial?.dispose());actor.shadow?.geometry.dispose();actor.shadow?.material.dispose();actor.aura?.geometry.dispose();actor.aura?.material.dispose();actor.weaponTrail?.geometry.dispose();actor.weaponTrail?.material.dispose();releaseHeroArmorMaps(actor);}this.actors.clear();this.shadowTexture?.dispose();this.scene.environment?.dispose?.();this.renderer.dispose();}
}
