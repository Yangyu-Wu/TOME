import * as THREE from '../../../vendor/three/three.module.min.js';

const legNames=new Set(['thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r','ball_l','ball_r']);

// Sample only lower-body quaternion tracks. The attack mixer retains ownership
// of pelvis, torso, shoulders, hands and weapon timing.
function samplerFor(actor,clip){
  actor.lowerBodySamplers??=new Map();let sampler=actor.lowerBodySamplers.get(clip.uuid);
  if(!sampler){
    sampler=clip.tracks.filter(track=>track.name.endsWith('.quaternion')&&legNames.has(track.name.split('.')[0])).map(track=>({bone:actor.root.getObjectByName(track.name.split('.')[0]),interpolate:track.createInterpolant(new Float32Array(4)),target:new THREE.Quaternion()})).filter(item=>item.bone);
    actor.lowerBodySamplers.set(clip.uuid,sampler);
  }
  return sampler;
}

export function blendMovingAttack(actor,clip,dt){
  if(!clip)return;
  const active=actor.lastState==='attack'&&actor.wasMoving;
  const weight=actor.lowerBodyWeight||0;
  actor.lowerBodyWeight=weight+((active?1:0)-weight)*(1-Math.exp(-Math.max(0,dt)/.08));
  actor.lowerLocomotionPhase??=0;
  if(actor.lastState==='run'||actor.lastState==='walk'){
    actor.lowerLocomotionPhase=(actor.current.time/actor.current.getClip().duration)%1;
  }else if(active){
    actor.lowerLocomotionPhase=(actor.lowerLocomotionPhase+dt*(actor.locomotionRate||1)/clip.duration)%1;
  }
  // Hit/death own the complete body. Do not blend run legs into a fall.
  if(['hit','death','dash'].includes(actor.lastState)){actor.lowerBodyWeight=0;return;}
  if(!active&&actor.lastState!=='attack'&&actor.lastState!=='attackRecovery'){actor.lowerBodyWeight=0;return;}
  if(actor.lowerBodyWeight<.001)return;
  for(const sample of samplerFor(actor,clip)){
    sample.target.fromArray(sample.interpolate.evaluate(actor.lowerLocomotionPhase*clip.duration)).normalize();
    sample.bone.quaternion.slerp(sample.target,actor.lowerBodyWeight);
  }
  actor.lowerBodyClip=clip.name;
}
