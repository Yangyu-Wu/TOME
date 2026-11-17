import * as THREE from '../../../../vendor/three/three.module.min.js';
import {createSignatureWeapon} from './signature/index.js';

// Procedural, project-authored low-poly combat equipment for the CC0 base rig.
// Dimensions are in the source model's metres; each actor receives its own
// material instances so faction treatments never bleed between units.
const steel=new THREE.MeshPhysicalMaterial({color:'#b9c4ce',metalness:.78,roughness:.27,clearcoat:.38,clearcoatRoughness:.14});
const gold=new THREE.MeshPhysicalMaterial({color:'#bc9650',metalness:.72,roughness:.3,clearcoat:.42,clearcoatRoughness:.16});
const leather=new THREE.MeshStandardMaterial({color:'#513626',metalness:.08,roughness:.82});
const edge=new THREE.MeshStandardMaterial({color:'#eef5ff',metalness:.9,roughness:.18});
const gem=new THREE.MeshStandardMaterial({color:'#78b9ff',metalness:.35,roughness:.16,emissive:'#1a4f86',emissiveIntensity:.45});

function part(geometry,material,position){const mesh=new THREE.Mesh(geometry,material.clone());mesh.material.userData.authoredHeroPalette=true;mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}

export function createHeroWeapon(role='sword',heroId=null){
  const signature=role==='spear'?createSignatureWeapon(heroId):null;
  if(signature){signature.rotation.set(.08,0,-.12);signature.scale.setScalar(.78);signature.traverse(object=>{if(object.isMesh&&object.material?.emissiveIntensity!==undefined)object.userData.baseGlow=object.material.emissiveIntensity;});return signature;}
  const kind=role==='archer'?'bow':role==='spear'?'spear':role==='cavalry'?'sabre':role==='mage'||role==='support'?'staff':role==='assassin'?'twin-daggers':'sword',root=new THREE.Group();root.name=`weapon-${kind}`;
  if(kind==='spear'){
    root.add(part(new THREE.CylinderGeometry(.018,.024,.82,8),leather,[0,-.34,0]));
    root.add(part(new THREE.CylinderGeometry(.008,.07,.2,6),steel,[0,.16,0]));
    root.add(part(new THREE.CylinderGeometry(.035,.035,.055,8),gold,[0,.025,0]));
    const pennant=part(new THREE.PlaneGeometry(.19,.15,2,2),new THREE.MeshStandardMaterial({color:'#a83242',roughness:.78,side:THREE.DoubleSide}),[.09,.08,0]);pennant.rotation.y=.08;root.add(pennant);
  }else if(kind==='bow'){
    const arc=new THREE.TorusGeometry(.27,.018,5,20,Math.PI);arc.rotateZ(Math.PI/2);root.add(part(arc,leather,[0,0,0]));
    const string=part(new THREE.CylinderGeometry(.004,.004,.52,5),steel,[0,0,.008]);string.rotation.z=Math.PI/2;string.name='bowstring';root.add(string);
    const arrow=part(new THREE.CylinderGeometry(.006,.006,.44,5),gold,[.02,-.24,.025]);arrow.rotation.z=-.08;arrow.name='bow-arrow';root.add(arrow);root.userData.bowString=string;root.userData.bowArrow=arrow;root.userData.arrowRest=arrow.position.clone();
  }else if(kind==='staff'){
    root.add(part(new THREE.CylinderGeometry(.025,.033,.98,8),leather,[0,-.15,0]));
    root.add(part(new THREE.TorusGeometry(.1,.018,6,16),gold,[0,.34,0]));
    root.add(part(new THREE.SphereGeometry(.075,12,10),gem,[0,.34,0]));
  }else if(kind==='twin-daggers'){
    for(const side of [-1,1]){
      const dagger=new THREE.Group();dagger.position.x=side*.15;dagger.rotation.z=side*.32;
      dagger.add(part(new THREE.CylinderGeometry(.018,.022,.14,7),leather,[0,-.1,0]));
      dagger.add(part(new THREE.BoxGeometry(.12,.025,.045),gold,[0,-.015,0]));
      dagger.add(part(new THREE.BoxGeometry(.055,.31,.025),steel,[0,.15,0]));
      dagger.add(part(new THREE.ConeGeometry(.028,.08,4),steel,[0,.345,0]));root.add(dagger);
    }
  }else{
    root.add(part(new THREE.CylinderGeometry(.021,.025,.22,8),leather,[0,-.25,0]));
    const guard=part(new THREE.BoxGeometry(.22,.035,.07),gold,[0,-.115,0]);guard.rotation.z=-.08;root.add(guard);
    const blade=part(new THREE.BoxGeometry(kind==='sabre'?.075:.095,.55,.035),steel,[0,.17,0]);blade.rotation.z=kind==='sabre'?.12:0;root.add(blade);
    const fuller=part(new THREE.BoxGeometry(kind==='sabre'?.018:.024,.42,.008),edge,[0,.19,.021]);fuller.rotation.z=kind==='sabre'?.12:0;root.add(fuller);
    const tip=part(new THREE.ConeGeometry(.048,.13,4),steel,[0,.51,0]);root.add(tip);
    root.add(part(new THREE.SphereGeometry(.045,8,6),gold,[0,-.38,0]));
  }
  // Put the grip at the hand's origin, rather than attaching the blade's
  // midpoint to the palm. Keep blade anchors in that same local frame.
  const gripOffset=kind==='sword'||kind==='sabre'?.25:kind==='staff'?.15:kind==='spear'?.28:0;
  for(const child of root.children)child.position.y+=gripOffset;
  if(['sword','sabre','spear','twin-daggers'].includes(kind)){
    const base=new THREE.Object3D(),tip=new THREE.Object3D();base.name='blade-base';tip.name='blade-tip';
    const baseY=kind==='spear'?.06:kind==='twin-daggers'?0:-.09,tipY=kind==='spear'?.26:kind==='twin-daggers'?.385:.575;
    base.position.set(0,baseY+gripOffset,0);tip.position.set(kind==='sabre'?-.04:0,tipY+gripOffset,0);root.add(base,tip);root.userData.trailBase=base;root.userData.trailTip=tip;
  }
  // Hand poses vary between animation clips. A modest rotation aligns the grip
  // down the palm without changing the source rig or any animation data.
  root.rotation.set(.08,0,-.12);root.scale.setScalar(.78);root.userData.kind=kind;root.traverse(object=>{if(object.isMesh&&object.material?.emissiveIntensity!==undefined)object.userData.baseGlow=object.material.emissiveIntensity;});return root;
}

export function attachHeroWeapon(actor,role,heroId=null){
  const hand=actor.root.getObjectByName('hand_r');if(!hand)return null;
  const weapon=createHeroWeapon(role,heroId);hand.add(weapon);actor.weapon=weapon;return weapon;
}

/** Small procedural weapon follow-through layered on top of the source clips. */
export function animateHeroWeapon(actor,{time=0,dt=1/60,moving=false,attack=false,hit=false}={}){
  if(!actor.weapon)return;
  const attackPhase=attack&&actor.current?Math.max(0,Math.min(1,actor.current.time/Math.max(.001,actor.current.getClip().duration))):0;
  if(actor.weapon.userData.kind==='bow'){
    const draw=attack?Math.max(0,Math.min(1,attackPhase/.48)):0,release=attack?Math.max(0,Math.min(1,(attackPhase-.48)/.22)):0,string=actor.weapon.userData.bowString,arrow=actor.weapon.userData.bowArrow,rest=actor.weapon.userData.arrowRest;
    const previous=actor.weapon.userData.previousAttackPhase||0;
    if(attack&&previous<.48&&attackPhase>=.48)actor.weapon.userData.bowShotSequence=(actor.weapon.userData.bowShotSequence||0)+1;
    actor.weapon.userData.previousAttackPhase=attack?attackPhase:0;
    actor.weapon.userData.bowDraw=draw;actor.weapon.userData.bowRelease=release;
    if(string)string.position.x=-.13*draw;
    if(arrow){arrow.visible=!attack||attackPhase<.78;arrow.position.copy(rest);arrow.position.x+=-.13*draw+.5*release;}
  }
  // Distinct anticipation -> strike -> follow-through poses. The source clips
  // drive the hand/body while this local offset gives the weapon a readable
  // arc even when a generic animation is retargeted to a spear or staff.
  const anticipation=attack?Math.max(0,1-attackPhase/.27):0,strike=attack?Math.max(0,1-Math.abs(attackPhase-.55)/.3):0,follow=attack?Math.max(0,1-Math.abs(attackPhase-.82)/.2):0;
  const kind=actor.weapon.userData.kind,reach=kind==='spear'?.78:kind==='staff'?.46:kind==='twin-daggers'?.62:kind==='bow'?.12:.68;
  const locomotion=moving?Math.sin(time*1.05)*.035:Math.sin(time*1.7)*.012;
  const targetZ=-.12+locomotion-anticipation*reach*.55+strike*reach+follow*reach*.24+(hit?-.08:0);
  if(!actor.polearmRig){
    const smoothing=1-Math.exp(-Math.max(0,dt)*18);actor.weapon.rotation.z+=(targetZ-actor.weapon.rotation.z)*smoothing;
    actor.weapon.rotation.x=.08+(attack?-.12-anticipation*.08+strike*.1:0)+(moving?Math.sin(time*1.05)*.025:0);
  }
  actor.weapon.traverse(child=>{if(child.isMesh&&child.material?.emissiveIntensity!==undefined){const base=child.userData.baseGlow??child.material.emissiveIntensity;child.material.emissiveIntensity=base+(attack?.35:0);}});
}
