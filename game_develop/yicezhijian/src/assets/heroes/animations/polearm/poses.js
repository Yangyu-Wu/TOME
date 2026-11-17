import * as THREE from '../../../../../vendor/three/three.module.min.js';
import {SIGNATURE_ATTACKS} from '../../../../heroes/attack-timing.js';

// Project-authored control-rig keys, in metres relative to the shoulders.
// These are animation design data, not motion-capture recordings. The CC0
// shield guard supplies the underlying skeleton; IK controls the two hands.
const guard={p:[-.12,-.20,.08],yaw:.46,pitch:.22,grip:.38,twist:0,lean:0};
const key=(t,p,yaw,pitch,grip,twist=0,lean=0)=>({t,p,yaw,pitch,grip,twist,lean});
export const POLEARM_PROFILES={
  'qinglong-guandao':{
    ...SIGNATURE_ATTACKS.guanyu,
    keys:[{t:0,...guard},key(.22,[-.06,-.13,.02],-.85,.58,.36,-.32,-.04),key(.36,[-.08,-.04,.04],-.58,1.06,.36,-.38,-.07),key(.55,[-.02,-.24,.16],1.02,-.18,.36,.34,.10),key(.72,[.01,-.25,.12],1.35,-.39,.36,.48,.13),key(.89,[-.08,-.22,.08],.70,.08,.38,.12,.03),{t:1,...guard}]
  },
  'fangtian-halberd':{
    ...SIGNATURE_ATTACKS.lvbu,
    keys:[{t:0,...guard},key(.23,[-.09,-.05,.04],.26,1.15,.39,-.08,-.13),key(.38,[-.08,.01,.03],.12,1.30,.39,-.06,-.16),key(.56,[-.08,-.25,.18],.20,-.34,.34,.11,.22),key(.69,[-.08,-.27,.13],.25,-.52,.35,.12,.25),key(.88,[-.11,-.23,.10],.38,-.04,.38,.03,.05),{t:1,...guard}]
  },
  'longdan-silver-spear':{
    ...SIGNATURE_ATTACKS.zhaoyun,
    keys:[{t:0,...guard},key(.22,[-.18,-.25,-.05],.20,.06,.43,-.20,-.03),key(.34,[-.16,-.24,-.03],.12,.02,.40,-.16,-.02),key(.53,[-.06,-.18,.25],.10,.01,.28,.19,.12),key(.63,[-.06,-.19,.24],.12,.02,.29,.20,.12),key(.83,[-.13,-.23,.07],.27,.13,.39,.02,.03),{t:1,...guard}]
  }
};

function shaftQuaternion(yaw,pitch){
  const y=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  // A stable roll keeps the broad blade face readable through overhead arcs.
  const x=new THREE.Vector3(1,0,0).addScaledVector(y,-y.x).normalize(),z=new THREE.Vector3().crossVectors(x,y).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
}
for(const profile of Object.values(POLEARM_PROFILES))for(const k of profile.keys){k.position=new THREE.Vector3(...k.p);k.quaternion=shaftQuaternion(k.yaw,k.pitch);}

export function samplePolearmPose(profile,phase,attacking=true){
  const keys=profile.keys,t=attacking?Math.max(0,Math.min(1,phase)):0;
  let i=0;while(i<keys.length-2&&keys[i+1].t<t)i++;
  const a=keys[i],b=keys[i+1],linear=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))),s=linear*linear*(3-2*linear);
  return {position:a.position.clone().lerp(b.position,s),quaternion:a.quaternion.clone().slerp(b.quaternion,s),grip:THREE.MathUtils.lerp(a.grip,b.grip,s),twist:THREE.MathUtils.lerp(a.twist,b.twist,s),lean:THREE.MathUtils.lerp(a.lean,b.lean,s)};
}

export function createPolearmClips(clips){
  const guardClip=clips.find(c=>c.name==='Idle_Shield_Loop');if(!guardClip)return [];
  return Object.values(POLEARM_PROFILES).map(profile=>{
    const tracks=guardClip.tracks.map(source=>{const track=source.clone();for(let i=0;i<track.times.length;i++)track.times[i]*=profile.duration/guardClip.duration;return track;});
    return new THREE.AnimationClip(profile.name,profile.duration,tracks);
  });
}
