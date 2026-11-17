import * as THREE from '../../../vendor/three/three.module.min.js';
import {solveTwoBoneIK} from './two-bone-ik.js';
import {soleBottomY} from './foot-contact.js';

const profiles={
  'qinglong-guandao':{back:-.045,forward:.09,drop:.052,roll:.10},
  'fangtian-halberd':{back:-.025,forward:.065,drop:.082,roll:.035},
  'longdan-silver-spear':{back:-.065,forward:.135,drop:.045,roll:.025}
};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

export function attachPolearmStance(actor){
  if(!actor.polearmRig)return;
  const pelvis=actor.root.getObjectByName('pelvis'),legs=['l','r'].map(side=>({upper:actor.root.getObjectByName('thigh_'+side),lower:actor.root.getObjectByName('calf_'+side),foot:actor.root.getObjectByName('foot_'+side),sole:actor.root.getObjectByName('boot-sole-'+side)}));
  if(!pelvis||legs.some(l=>!l.upper||!l.lower||!l.foot||!l.sole))return;
  actor.stance={pelvis,legs,profile:profiles[actor.weapon.userData.signature],anchors:null,previousPhase:0};
  actor.posePositionBones=new Set([...(actor.posePositionBones||[]),pelvis]);
  for(const leg of legs)actor.poseBones.add(leg.foot);
}

export function applyPolearmStance(actor){
  const stance=actor.stance;if(!stance)return;
  const active=actor.lastState==='attack'&&!actor.wasMoving&&!actor.airborne;
  if(!active){stance.anchors=null;stance.active=false;return;}
  const phase=actor.attackPhase,root=actor.root;
  root.updateWorldMatrix(true,true);
  const displaced=stance.origin&&root.position.distanceTo(stance.origin)>root.scale.x*.18;
  if(!stance.anchors||stance.sequence!==actor.attackSequence||phase<stance.previousPhase-.2||displaced){
    stance.anchors=stance.legs.map(leg=>{
      const position=leg.foot.getWorldPosition(new THREE.Vector3());position.y+=(actor.groundY??root.position.y)-soleBottomY(leg.sole);
      return {position,quaternion:leg.foot.getWorldQuaternion(new THREE.Quaternion())};
    });
    stance.sequence=actor.attackSequence;
    stance.origin=root.position.clone();
  }
  stance.previousPhase=phase;stance.active=true;
  // Load the rear leg, drive the pelvis forward through contact, then return
  // during recovery. Both feet remain in their original world-space seats.
  const load=smooth(phase/.25)*(1-smooth((phase-.30)/.22)),drive=smooth((phase-.31)/.23)*(1-smooth((phase-.68)/.32));
  const p=stance.profile,offset=new THREE.Vector3(p.roll*(drive-load)*.13,-p.drop*(load*.65+drive),p.back*load+p.forward*drive);
  const scale=root.getWorldScale(new THREE.Vector3()).x,worldOffset=offset.applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(scale);
  const pelvisWorld=stance.pelvis.getWorldPosition(new THREE.Vector3()).add(worldOffset);
  stance.pelvis.position.copy(stance.pelvis.parent.worldToLocal(pelvisWorld));root.updateWorldMatrix(true,true);
  const errors=[];
  for(let i=0;i<stance.legs.length;i++){
    const leg=stance.legs[i],anchor=stance.anchors[i],hip=leg.upper.getWorldPosition(new THREE.Vector3());
    const pole=hip.clone().add(new THREE.Vector3(i===0?.08:-.08,-.12,.65).applyQuaternion(root.quaternion).multiplyScalar(scale));
    const result=solveTwoBoneIK(leg.upper,leg.lower,leg.foot,anchor.position,pole,{endQuaternion:anchor.quaternion});
    errors.push(result?.error/scale||0);
  }
  stance.errors=errors;stance.offset=offset.length();
}
