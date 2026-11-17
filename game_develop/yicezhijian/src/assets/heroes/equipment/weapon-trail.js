import * as THREE from '../../../../vendor/three/three.module.min.js';

export function updateBladeTrail(scene,actor,attacking,dt){
  const base=actor.weapon?.userData.trailBase,tip=actor.weapon?.userData.trailTip;
  if(!base||!tip)return; // Bows/staves use projectile or casting effects.
  const duration=actor.current?.getClip().duration||1,phase=(actor.current?.time||0)/duration;
  const window=actor.polearmRig?.profile.trail||[.25,.82];
  const active=attacking&&actor.root.visible&&phase>window[0]&&phase<window[1];
  let ribbon=actor.weaponTrail;
  if(active&&!ribbon){
    const geometry=new THREE.BufferGeometry(),positions=new Float32Array(8*6),colors=new Float32Array(8*6),indices=[];
    for(let i=0;i<7;i++){const v=i*2;indices.push(v,v+1,v+2,v+1,v+3,v+2);}
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);
    const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0,depthTest:false,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
    ribbon=new THREE.Mesh(geometry,material);ribbon.frustumCulled=false;actor.weaponTrail=ribbon;scene.add(ribbon);
  }
  if(!ribbon)return;
  if(active){
    // Updating the complete chain matters: the authored hand animation may
    // have changed since the previous GPU frame's matrices were computed.
    actor.root.updateMatrixWorld(true);
    const sample={base:base.getWorldPosition(new THREE.Vector3()),tip:tip.getWorldPosition(new THREE.Vector3())};
    const previous=actor.trailPoints[0];
    if(!previous||previous.tip.distanceToSquared(sample.tip)>.01||previous.base.distanceToSquared(sample.base)>.01){actor.trailPoints.unshift(sample);if(actor.trailPoints.length>8)actor.trailPoints.length=8;}
    ribbon.material.opacity=Math.min(.62,ribbon.material.opacity+dt*10);
  }else ribbon.material.opacity=Math.max(0,ribbon.material.opacity-dt*7);
  ribbon.visible=actor.root.visible&&actor.trailPoints.length>1&&ribbon.material.opacity>0;
  if(ribbon.material.opacity===0){actor.trailPoints.length=0;ribbon.visible=false;}
  if(!ribbon.visible)return;
  const positions=ribbon.geometry.attributes.position.array,colors=ribbon.geometry.attributes.color.array,color=new THREE.Color(actor.team==='enemy'?'#ff5364':'#66adff');
  for(let i=0;i<actor.trailPoints.length;i++){
    const sample=actor.trailPoints[i],fade=(1-i/Math.max(1,actor.trailPoints.length-1))**1.5;
    for(const [j,point] of [sample.base,sample.tip].entries()){
      const offset=i*6+j*3;positions[offset]=point.x;positions[offset+1]=point.y;positions[offset+2]=point.z+1;
      colors[offset]=color.r*fade;colors[offset+1]=color.g*fade;colors[offset+2]=color.b*fade;
    }
  }
  ribbon.geometry.attributes.position.needsUpdate=true;ribbon.geometry.attributes.color.needsUpdate=true;ribbon.geometry.setDrawRange(0,(actor.trailPoints.length-1)*6);ribbon.geometry.computeBoundingSphere();
}
