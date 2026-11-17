import * as THREE from '../../../vendor/three/three.module.min.js';

function aim(bone,from,to,weight){
  if(from.lengthSq()<1e-12||to.lengthSq()<1e-12)return;
  const delta=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
  const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()),world=bone.getWorldQuaternion(new THREE.Quaternion());
  const local=parent.invert().multiply(delta.multiply(world)).normalize();
  bone.quaternion.slerp(local,weight);bone.updateWorldMatrix(false,true);
}

// Rotate joints only: do not translate or stretch the imported skeleton.
// The pole is a point defining the elbow's bend plane, not an Euler angle.
export function solveTwoBoneIK(upper,lower,end,target,pole,{weight=1,endQuaternion=null}={}){
  if(!upper||!lower||!end||weight<=0)return null;
  upper.updateWorldMatrix(true,true);
  const shoulder=upper.getWorldPosition(new THREE.Vector3()),elbow=lower.getWorldPosition(new THREE.Vector3()),wrist=end.getWorldPosition(new THREE.Vector3());
  const a=shoulder.distanceTo(elbow),b=elbow.distanceTo(wrist),axis=target.clone().sub(shoulder),requested=axis.length();
  if(a<1e-6||b<1e-6)return null;
  if(requested<1e-8)axis.copy(wrist).sub(shoulder);
  if(axis.lengthSq()<1e-12)axis.set(0,-1,0);axis.normalize();
  const reach=THREE.MathUtils.clamp(requested,Math.abs(a-b)+1e-5,a+b-1e-5),along=(a*a+reach*reach-b*b)/(2*reach),height=Math.sqrt(Math.max(0,a*a-along*along));
  const bend=pole.clone().sub(shoulder);bend.addScaledVector(axis,-bend.dot(axis));
  if(bend.lengthSq()<1e-10){bend.copy(elbow).sub(shoulder);bend.addScaledVector(axis,-bend.dot(axis));}
  if(bend.lengthSq()<1e-10){bend.set(Math.abs(axis.x)<.8?1:0,Math.abs(axis.x)<.8?0:1,0);bend.addScaledVector(axis,-bend.dot(axis));}
  bend.normalize();
  const goalElbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(bend,height),goalWrist=shoulder.clone().addScaledVector(axis,reach);
  aim(upper,elbow.clone().sub(shoulder),goalElbow.sub(shoulder),weight);
  const newElbow=lower.getWorldPosition(new THREE.Vector3()),newWrist=end.getWorldPosition(new THREE.Vector3());
  aim(lower,newWrist.sub(newElbow),goalWrist.sub(newElbow),weight);
  if(endQuaternion){const local=end.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(endQuaternion);end.quaternion.slerp(local.normalize(),weight);end.updateWorldMatrix(false,true);}
  return {error:end.getWorldPosition(new THREE.Vector3()).distanceTo(target),unreachable:requested>a+b||requested<Math.abs(a-b)};
}
