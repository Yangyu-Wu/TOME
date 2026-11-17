import * as THREE from '../../../vendor/three/three.module.min.js';

function rigSnapshot(root){
  root.updateWorldMatrix(true,true);const bones=root.getObjectsByProperty('isBone',true),map=new Map();
  for(const bone of bones)map.set(bone.name,{bone,parent:bone.parent.isBone?bone.parent.name:null,position:bone.position.clone(),quaternion:bone.quaternion.clone().normalize(),scale:bone.scale.clone(),world:bone.getWorldQuaternion(new THREE.Quaternion()).normalize(),parentWorld:bone.parent.getWorldQuaternion(new THREE.Quaternion()).normalize()});
  return map;
}

// Matching names do not imply matching bind poses. Preserve the mesh's limb
// lengths and apply each source joint's world-space rotation delta to the
// target's own rest orientation. Only root/pelvis translation carries motion.
// Source and target are loaded in the same +Y-up glTF scene coordinates.
export function retargetClips(sourceRoot,targetRoot,clips){
  if(sourceRoot===targetRoot)return clips;
  const source=rigSnapshot(sourceRoot),target=rigSnapshot(targetRoot);
  const legLength=rig=>['calf_l','foot_l'].reduce((sum,name)=>sum+(rig.get(name)?.position.length()||0),0);
  const translationScale=legLength(target)/Math.max(1e-6,legLength(source));
  const targetBones=[...target].filter(([name])=>source.has(name));
  return clips.map(clip=>{
    const samples=new Map(),times=new Set([0,clip.duration]);
    for(const track of clip.tracks){
      const dot=track.name.lastIndexOf('.'),name=track.name.slice(0,dot),property=track.name.slice(dot+1);
      if(!source.has(name))continue;
      if(property==='quaternion'){samples.set(name,track.createInterpolant(new Float32Array(4)));for(const time of track.times)times.add(time);}
    }
    const keys=Float32Array.from([...times].sort((a,b)=>a-b)),values=new Map(targetBones.map(([name])=>[name,new Float32Array(keys.length*4)]));
    const sourceWorld=new Map(),targetWorld=new Map(),local=new THREE.Quaternion(),delta=new THREE.Quaternion(),desired=new THREE.Quaternion(),parent=new THREE.Quaternion();
    for(let i=0;i<keys.length;i++){
      sourceWorld.clear();targetWorld.clear();
      for(const [name,rest] of source){
        const sample=samples.get(name);if(sample)local.fromArray(sample.evaluate(keys[i])).normalize();else local.copy(rest.quaternion);
        const parentQ=rest.parent?sourceWorld.get(rest.parent):rest.parentWorld;
        sourceWorld.set(name,new THREE.Quaternion().copy(parentQ).multiply(local));
      }
      for(const [name,rest] of targetBones){
        delta.copy(sourceWorld.get(name)).multiply(source.get(name).world.clone().invert());desired.copy(delta).multiply(rest.world);
        parent.copy(rest.parent?(targetWorld.get(rest.parent)||target.get(rest.parent).world):rest.parentWorld);
        local.copy(parent).invert().multiply(desired).normalize();
        // Keep adjacent keys on the same quaternion hemisphere.
        const output=values.get(name);if(i>0&&local.dot(new THREE.Quaternion().fromArray(output,(i-1)*4))<0)local.set(-local.x,-local.y,-local.z,-local.w);
        local.toArray(output,i*4);targetWorld.set(name,desired.clone());
      }
    }
    const tracks=clip.tracks.map(track=>{
      const dot=track.name.lastIndexOf('.'),name=track.name.slice(0,dot),property=track.name.slice(dot+1),rest=target.get(name),sourceRest=source.get(name);
      if(!rest||!sourceRest)return track.clone();
      if(property==='quaternion')return new THREE.QuaternionKeyframeTrack(track.name,keys,values.get(name));
      if(property==='position'&&(name==='root'||name==='pelvis')){
        const output=track.values.slice();for(let i=0;i<output.length;i+=3){output[i]=rest.position.x+(output[i]-sourceRest.position.x)*translationScale;output[i+1]=rest.position.y+(output[i+1]-sourceRest.position.y)*translationScale;output[i+2]=rest.position.z+(output[i+2]-sourceRest.position.z)*translationScale;}
        return new THREE.VectorKeyframeTrack(track.name,track.times.slice(),output);
      }
      if(property==='position'||property==='scale'){
        const value=property==='position'?rest.position:rest.scale;return new THREE.VectorKeyframeTrack(track.name,[0,clip.duration],[value.x,value.y,value.z,value.x,value.y,value.z]);
      }
      return track.clone();
    });
    const retargeted=new THREE.AnimationClip(clip.name,clip.duration,tracks,clip.blendMode);retargeted.userData={sourceUuid:clip.uuid,retargeted:true,translationScale};return retargeted;
  });
}
