import * as THREE from '../../../../vendor/three/three.module.min.js';
import {POLEARM_PROFILES,samplePolearmPose} from '../animations/polearm/poses.js';
import {solveTwoBoneIK} from '../two-bone-ik.js';

const mount=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2),palm=new THREE.Vector3(0,.075,0);
const opposite=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
const signatures={guanyu:'qinglong-guandao',lvbu:'fangtian-halberd',zhaoyun:'longdan-silver-spear'};
export function polearmProfileFor(unit){return unit.role==='spear'?POLEARM_PROFILES[signatures[unit.heroId]]:null;}

export function attachPolearmGrip(actor,clips=[]){
  const profile=POLEARM_PROFILES[actor.weapon?.userData.signature];if(!profile)return;
  const bones={};for(const side of ['l','r'])for(const name of ['upperarm','lowerarm','hand'])bones[name+'_'+side]=actor.root.getObjectByName(name+'_'+side);
  if(Object.values(bones).some(b=>!b))return;
  const fingerPoses=[],guard=clips.find(c=>c.name==='Idle_Shield_Loop');
  for(const track of guard?.tracks||[]){
    if(!/^(index|middle|ring|pinky|thumb)_\d+_[lr]\.quaternion$/.test(track.name))continue;
    const bone=actor.root.getObjectByName(track.name.split('.')[0]);if(bone)fingerPoses.push({bone,quaternion:new THREE.Quaternion().fromArray(track.createInterpolant(new Float32Array(4)).evaluate(.2)).normalize()});
  }
  actor.polearmRig={profile,bones,fingerPoses,weight:0};
  actor.poseBones=new Set(Object.values(bones));
  for(const {bone} of fingerPoses)actor.poseBones.add(bone);
  actor.weapon.position.copy(palm);actor.weapon.quaternion.copy(mount);
}

function clampSphere(point,center,radius){
  const offset=point.clone().sub(center);if(offset.lengthSq()>radius*radius)point.copy(center).add(offset.setLength(radius));
}

export function applyPolearmGrip(actor,dt){
  const rig=actor.polearmRig;if(!rig)return;
  const blocked=['hit','death','dash'].includes(actor.lastState);
  if(blocked){rig.weight=0;rig.contact=null;return;}
  rig.weight+= (1-rig.weight)*(1-Math.exp(-Math.max(0,dt)/.065));
  if(rig.weight<.001)return;
  for(const {bone,quaternion} of rig.fingerPoses)bone.quaternion.slerp(quaternion,rig.weight);
  const attacking=actor.lastState==='attack',pose=samplePolearmPose(rig.profile,actor.attackPhase,attacking),{root,weapon}=actor;
  actor.runBones.spineMid?.rotateY(pose.twist*.4*rig.weight);
  actor.runBones.spine?.rotateY(pose.twist*.6*rig.weight);
  actor.runBones.spine?.rotateX(pose.lean*rig.weight);
  root.updateWorldMatrix(true,true);
  const localPosition=bone=>root.worldToLocal(bone.getWorldPosition(new THREE.Vector3())),b=rig.bones;
  const shoulderR=localPosition(b.upperarm_r),shoulderL=localPosition(b.upperarm_l),center=shoulderR.clone().add(shoulderL).multiplyScalar(.5);
  const x=shoulderL.clone().sub(shoulderR).normalize(),up=localPosition(root.getObjectByName('neck_01')).sub(localPosition(actor.runBones.spine)).normalize();
  const z=new THREE.Vector3().crossVectors(x,up).normalize();up.crossVectors(z,x).normalize();
  const frame=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up,z));
  const weaponQ=frame.clone().multiply(pose.quaternion),rightQ=weaponQ.clone().multiply(mount.clone().invert()),leftQ=weaponQ.clone().multiply(opposite).multiply(mount.clone().invert());
  const rightOffset=palm.clone().applyQuaternion(rightQ),leftOffset=palm.clone().applyQuaternion(leftQ),separation=new THREE.Vector3(0,pose.grip*weapon.scale.y,0).applyQuaternion(weaponQ);
  const primary=pose.position.clone().applyQuaternion(frame).add(center),requested=primary.clone();
  const length=side=>localPosition(b['upperarm_'+side]).distanceTo(localPosition(b['lowerarm_'+side]))+localPosition(b['lowerarm_'+side]).distanceTo(localPosition(b['hand_'+side]));
  // Translate the rigid weapon, rather than lengthening either arm, if a key
  // requests a point beyond reach. Both wrists remain attached to that weapon.
  const sphereR=shoulderR.clone().add(rightOffset),sphereL=shoulderL.clone().add(leftOffset).sub(separation),radiusR=length('r')*.975,radiusL=length('l')*.975;
  for(let i=0;i<12;i++){clampSphere(primary,sphereR,radiusR);clampSphere(primary,sphereL,radiusL);}
  const wristR=primary.clone().sub(rightOffset),wristL=primary.clone().add(separation).sub(leftOffset);
  const rootQ=root.getWorldQuaternion(new THREE.Quaternion()),poleR=center.clone().add(new THREE.Vector3(-.58,-.16,-.16).applyQuaternion(frame)),poleL=center.clone().add(new THREE.Vector3(.58,-.16,-.16).applyQuaternion(frame));
  const r=solveTwoBoneIK(b.upperarm_r,b.lowerarm_r,b.hand_r,root.localToWorld(wristR),root.localToWorld(poleR),{weight:rig.weight,endQuaternion:rootQ.clone().multiply(rightQ)});
  const l=solveTwoBoneIK(b.upperarm_l,b.lowerarm_l,b.hand_l,root.localToWorld(wristL),root.localToWorld(poleL),{weight:rig.weight,endQuaternion:rootQ.clone().multiply(leftQ)});
  weapon.position.copy(palm);weapon.quaternion.copy(mount);root.updateWorldMatrix(true,true);
  const handContact=b.hand_l.localToWorld(palm.clone()),shaftContact=weapon.localToWorld(new THREE.Vector3(0,pose.grip,0)),scale=root.getWorldScale(new THREE.Vector3()).x;
  rig.contact={error:handContact.distanceTo(shaftContact)/scale,rightError:r?.error/scale,leftError:l?.error/scale,projection:primary.distanceTo(requested),grip:pose.grip};
}
