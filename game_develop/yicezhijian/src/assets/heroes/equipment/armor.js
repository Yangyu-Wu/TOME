import * as THREE from '../../../../vendor/three/three.module.min.js';
import {attachLowerGarments} from './lower-garments.js';
import {attachCapeWind} from './cape-wind.js';
import {attachTailoredUnderlayer} from './tailored-underlayer.js';

const metal=new THREE.MeshPhysicalMaterial({color:'#708499',metalness:.74,roughness:.3,clearcoat:.32,clearcoatRoughness:.2});
const trim=new THREE.MeshPhysicalMaterial({color:'#b99550',metalness:.68,roughness:.3,clearcoat:.45,clearcoatRoughness:.16});
const darkMetal=new THREE.MeshPhysicalMaterial({color:'#273849',metalness:.82,roughness:.38,clearcoat:.18,clearcoatRoughness:.24});
const cloth=new THREE.MeshStandardMaterial({color:'#26374a',metalness:.04,roughness:.8,side:THREE.DoubleSide});
const copy=m=>m.clone();
function mesh(g,m,p){const x=new THREE.Mesh(g,copy(m));x.material.userData.authoredHeroPalette=true;x.position.set(...p);x.castShadow=true;x.receiveShadow=true;return x;}

// A 1024² color/normal/roughness stack is expensive on an integrated GPU.
// Keep one immutable texture stack per palette and share it between actors;
// materials remain per-actor so tinting and roughness can still vary safely.
const armorTextureCache=new Map();
function lamellarMaps(faction,profile,heroId='generic'){
  // The armor is procedurally authored, so its canvas size is the effective
  // texel density of the close-up hero pass. 1024 keeps lamellar edges and
  // rivets readable on the GPU layer while remaining practical on this
  // machine's integrated WebGL path (the base character textures are 2048²).
  const heroPalette={guanyu:['#193f38','#2f8066','#8fc8a8'],zhouyu:['#173b5b','#3978a8','#9bc5e6'],zhugeliang:['#273765','#526ca8','#b2c9ef'],lvbu:['#252b4a','#564c91','#b2a0e8'],machao:['#24415d','#4e87aa','#b4d8e7']};
  const colors=faction==='enemy'?['#431d29','#8e3040','#cb5360']:heroPalette[heroId]||(profile==='mage'?['#263b5a','#496c9c','#8ea9d4']:['#293d4c','#526f85','#a8bdc9']);
  const cacheKey=colors.join('|');let cached=armorTextureCache.get(cacheKey);if(cached){cached.refs++;return cached.maps;}
  const size=1024,base=document.createElement('canvas'),normal=document.createElement('canvas'),rough=document.createElement('canvas');
  for(const canvas of [base,normal,rough]){canvas.width=size;canvas.height=size;}
  const ctx=base.getContext('2d'),nctx=normal.getContext('2d'),rctx=rough.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,size,size);gradient.addColorStop(0,colors[0]);gradient.addColorStop(.48,colors[1]);gradient.addColorStop(1,colors[0]);ctx.fillStyle=gradient;ctx.fillRect(0,0,size,size);
  nctx.fillStyle='rgb(128,128,255)';nctx.fillRect(0,0,size,size);rctx.fillStyle='rgb(145,145,145)';rctx.fillRect(0,0,size,size);
  const rows=12,cols=13,w=size/cols,h=size/rows;
  for(let y=0;y<rows;y++)for(let x=-1;x<cols;x++){
    const px=x*w+(y%2)*w*.5,py=y*h,shade=(x*7+y*11)%3;
    ctx.beginPath();ctx.moveTo(px+2,py+1);ctx.lineTo(px+w-2,py+1);ctx.lineTo(px+w-5,py+h-3);ctx.lineTo(px+w*.5,py+h-1);ctx.lineTo(px+4,py+h-3);ctx.closePath();ctx.fillStyle=colors[shade];ctx.fill();ctx.strokeStyle='rgba(226,231,232,.5)';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(px+5,py+4);ctx.lineTo(px+w-5,py+4);ctx.strokeStyle='rgba(255,255,255,.22)';ctx.lineWidth=1;ctx.stroke();
    const nx=px+w*.5,ny=py+h*.56;for(let yy=-2;yy<=2;yy++)for(let xx=-2;xx<=2;xx++){const shadeN=Math.max(0,Math.min(255,128-xx*20));nctx.fillStyle=`rgb(${shadeN},${Math.max(0,Math.min(255,128-yy*20))},${Math.max(0,Math.min(255,235-Math.abs(xx)*8-Math.abs(yy)*8))})`;nctx.fillRect(nx+xx,ny+yy,1,1);}rctx.fillStyle='rgb(112,112,112)';rctx.fillRect(px+2,py+2,w-4,h-4);
  }
  const colorMap=new THREE.CanvasTexture(base),normalMap=new THREE.CanvasTexture(normal),roughnessMap=new THREE.CanvasTexture(rough);
  for(const tex of [colorMap,normalMap,roughnessMap]){tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(2,2);tex.anisotropy=8;tex.generateMipmaps=true;tex.minFilter=THREE.LinearMipmapLinearFilter;}
  colorMap.colorSpace=THREE.SRGBColorSpace;normalMap.colorSpace=roughnessMap.colorSpace=THREE.NoColorSpace;
  const maps={colorMap,normalMap,roughnessMap};armorTextureCache.set(cacheKey,{maps,refs:1});return maps;
}

export function releaseHeroArmorMaps(actor){
  for(const maps of actor.armorMapLeases||[]){const entry=[...armorTextureCache.values()].find(candidate=>candidate.maps===maps);if(!entry)continue;if(--entry.refs===0){entry.maps.colorMap.dispose();entry.maps.normalMap.dispose();entry.maps.roughnessMap.dispose();for(const [key,value] of armorTextureCache)if(value===entry)armorTextureCache.delete(key);}}
  actor.armorMapLeases=[];
}

/** Attach readable silhouette pieces to the animated skeleton. */
export function attachHeroArmor(actor,role='spear',faction='ally',heroId='generic'){
  attachTailoredUnderlayer(actor,{heroId,enemy:faction==='enemy'});
  const chest=actor.root.getObjectByName('spine_03'),left=actor.root.getObjectByName('upperarm_l'),right=actor.root.getObjectByName('upperarm_r');
  if(!chest)return null;
  const root=new THREE.Group();root.name='armor-silhouette';
  const plate=metal.clone();plate.color.set('#dce5e8');plate.metalness=.58;plate.roughness=.48;plate.clearcoat=.1;const rivet=trim.clone();rivet.color.set(faction==='enemy'?'#d89a68':'#c4a45d');
  const maps=lamellarMaps(faction,role,heroId);plate.map=maps.colorMap;plate.normalMap=maps.normalMap;plate.roughnessMap=maps.roughnessMap;plate.normalScale.set(.72,.72);plate.needsUpdate=true;actor.armorMaps=maps;actor.armorMapLeases=[...(actor.armorMapLeases||[]),maps];
  const under=cloth.clone();under.color.set(faction==='enemy'?'#3a1d2b':role==='mage'?'#26375c':'#202d3a');
  // Layered lamellar cuirass: dark under-tunic, curved breast/back plates,
  // overlapping scales, collar and riveted seams create readable 3D relief.
  const tunic=mesh(new THREE.CylinderGeometry(.215,.235,.31,20),under,[0,-.015,0]);tunic.scale.z=.62;root.add(tunic);
  const breast=mesh(new THREE.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI*.57),plate,[0,.045,.085]);breast.scale.set(.235,.155,.13);root.add(breast);
  const back=mesh(new THREE.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI*.57),darkMetal,[0,.045,-.065]);back.scale.set(.23,.15,.1);root.add(back);
  for(let row=0;row<3;row++)for(let col=0;col<5;col++){
    const x=(col-2)*.075,y=.02-row*.065,z=.185-Math.abs(col-2)*.012;
    const scale=mesh(new THREE.BoxGeometry(.068,.047,.025),row%2?darkMetal:plate,[x,y,z]);scale.rotation.z=(col-2)*-.035;root.add(scale);
  }
  const collar=mesh(new THREE.TorusGeometry(.17,.027,6,12,Math.PI),trim,[0,.15,0]);collar.rotation.z=Math.PI;root.add(collar);
  for(const side of [-1,1])for(let i=0;i<3;i++){const stud=mesh(new THREE.SphereGeometry(.012,6,5),rivet,[side*(.155+i*.025),.105-i*.065,.205]);root.add(stud);}
  // Segmented waist faulds follow the hips and remain independent of the cape.
  const pelvis=actor.root.getObjectByName('pelvis')||actor.root.getObjectByName('spine_01');
  if(pelvis){
    const skirt=new THREE.Group();skirt.name='lamellar-fauld';
    for(const side of [-1,1])for(let i=0;i<5;i++){
      const x=(i-2)*.088,z=side*(.175-Math.abs(i-2)*.014),flap=mesh(new THREE.BoxGeometry(.083,.27,.025),i%2?darkMetal:plate,[x,-.125,z]);
      flap.rotation.z=x*-.4;skirt.add(flap);
    }
    pelvis.add(skirt);actor.fauld=skirt;
  }
  if(pelvis&&(role==='mage'||role==='support')){const robe=new THREE.Group();robe.name='caster-robe';for(let i=0;i<7;i++){const angle=i*Math.PI*2/7,panel=mesh(new THREE.PlaneGeometry(.16,.48,2,6),under,[Math.sin(angle)*.18,-.27,Math.cos(angle)*.12]);panel.geometry.translate(0,-.22,0);panel.rotation.y=angle;panel.userData.phase=i*.65;robe.add(panel);}pelvis.add(robe);actor.robePanels=robe.children;}
  chest.add(root);
  // Keep identity armor palettes readable when the GPU layer applies the
  // global ally/enemy tint to the neutral base character.
  root.traverse(obj=>{if(obj.isMesh){for(const material of (Array.isArray(obj.material)?obj.material:[obj.material]))material.userData.heroArmorPalette=true;}});
  actor.shoulderGuards=[];actor.bracers=[];for(const [index,arm] of [left,right].entries())if(arm){const guard=new THREE.Group();guard.name='shoulder-guard';const broad=role==='cavalry'||role==='shield',dome=mesh(new THREE.SphereGeometry(broad?.16:.13,10,7),plate,[0,.015,0]);dome.scale.set(broad?1.2:1,.78,broad?1.3:1.12);guard.add(dome);const rim=mesh(new THREE.TorusGeometry(broad?.125:.105,.018,5,10),rivet,[0,-.035,.015]);guard.add(rim);const ridge=mesh(new THREE.ConeGeometry(.035,broad?.2:.12,5),trim,[0,.11,0]);ridge.rotation.x=-.22;guard.add(ridge);arm.add(guard);actor.shoulderGuards.push(guard);const lower=actor.root.getObjectByName(index===0?'lowerarm_l':'lowerarm_r');if(lower){const bracer=mesh(new THREE.CylinderGeometry(.075,.095,.24,8),role==='archer'?under:plate,[0,.12,0]);bracer.name=`${role}-forearm-bracer`;if(role==='archer'){const seam=mesh(new THREE.TorusGeometry(.078,.012,5,12),rivet,[0,.09,0]);bracer.add(seam);}lower.add(bracer);actor.bracers.push(bracer);}}
  attachLowerGarments(actor,role,faction==='enemy');
  actor.armor=root;return root;
}

/** Lightweight articulated cloth panels for elite and boss silhouettes. */
export function attachHeroCape(actor,{boss=false,faction='ally'}={}){
  const spine=actor.root.getObjectByName('spine_03');if(!spine)return null;
  const root=new THREE.Group();root.name='battle-cape';root.position.set(0,-.1,-.11);
  const capeMat=cloth.clone();capeMat.color.set(faction==='enemy'?'#641f31':'#294f78');
  const panelCount=boss?5:3;
  for(let i=0;i<panelCount;i++){
    const width=boss?.11:.14,length=boss?.72:.5;
    const offset=(i-(panelCount-1)/2)*width;
    const panel=mesh(new THREE.PlaneGeometry(width,length,6,24),capeMat,[offset,.04,-.02]);
    panel.name=`cape-panel-${i}`;panel.geometry.translate(0,-length*.5,0);panel.rotation.x=-.16;panel.userData.baseRotation=panel.rotation.x;panel.userData.phase=0;
    attachCapeWind(panel,offset);root.add(panel);
  }
  spine.add(root);actor.cape=root;return root;
}

export function animateHeroCape(actor,{time=0,moving=false,attack=false,hit=false,airHeight=0,hitDirection=1,hitStrength=1}={}){
  const speed=moving?1:.28,impact=Math.min(1,hitStrength||1),hitKick=hit?-.45*impact:0,airKick=Math.min(.45,Math.max(0,airHeight)*.012);
  if(actor.cape)actor.cape.children.forEach(panel=>{const phase=time*5+panel.userData.phase;panel.rotation.x=panel.userData.baseRotation+Math.sin(phase)*.11*speed+hitKick+airKick+(attack ? .12 : 0);panel.rotation.z=Math.sin(phase*.65)*.07*speed;const uniforms=panel.userData.windUniforms;if(uniforms){uniforms.uCapeTime.value=time;uniforms.uCapeWind.value=(moving?.052:.026)+(attack?.018:0)+(hit?.025*impact:0)+airKick*.08;}});
  if(actor.fauld)actor.fauld.children.forEach((flap,i)=>{const phase=time*4.2+i*.7;flap.rotation.x=Math.sin(phase)*.09*speed+(attack?.06:0)+(hit?.12:0);});
  if(actor.robePanels)actor.robePanels.forEach(panel=>{const phase=time*4.2+panel.userData.phase;panel.rotation.x=Math.sin(phase)*.09*speed+(attack?.08:0)+(hit?.1*impact:0);});
  if(actor.cape)actor.cape.rotation.z+=((hit?hitDirection*.12*impact:0)-actor.cape.rotation.z)*.2;
}

/** Secondary armor motion keeps hard-surface attachments seated on the rig
 * while preserving a little inertia during strikes and impacts. */
export function animateHeroArmor(actor,{time=0,moving=false,attack=false,hit=false,dash=false}={}){
  const pulse=attack?.08:0,impact=hit?-.12:0,run=moving?Math.sin(time*2.1)*.025:0;
  actor.shoulderGuards?.forEach((guard,index)=>{const side=index?1:-1;guard.rotation.z=side*(pulse+run)+impact;guard.rotation.x=Math.sin(time*1.7+index)*.018*(moving?1:.35)+(dash?.06:0);});
  actor.bracers?.forEach((bracer,index)=>{bracer.rotation.z=(index?-.018:.018)*(moving?1:.35)+impact*.35;});
}
