import * as THREE from '../../../../vendor/three/three.module.min.js';

function material(color,metalness=0,roughness=.85){
  const value=new THREE.MeshStandardMaterial({color,metalness,roughness});
  value.userData.authoredHeroPalette=true;return value;
}
function part(geometry,mat,name){
  const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
// Fit the garment axis to the rig's child-bone translation. This source rig
// points its leg segments along local +Y, rather than world -Y.
function segment(bone,child,name){
  const group=new THREE.Group();group.name=name;
  const length=child.position.length();group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),child.position.clone().normalize());
  bone.add(group);return {group,length};
}
export function attachLowerGarments(actor,role='spear',enemy=false){
  const textile=material(enemy?'#351e26':'#1d2d40'),leather=material('#261d19',.02,.78),sole=material('#14171a',.02,.92);
  const steel=material(enemy?'#713642':'#365d7c',.62,.42),edge=material('#967746',.48,.5);
  const armored=!['mage','support','assassin'].includes(role);actor.lowerGarments=[];
  for(const side of ['l','r']){
    const thigh=actor.root.getObjectByName('thigh_'+side),calf=actor.root.getObjectByName('calf_'+side),foot=actor.root.getObjectByName('foot_'+side),ball=actor.root.getObjectByName('ball_'+side);
    if(!thigh||!calf||!foot||!ball)continue;
    const upper=segment(thigh,calf,'trousers-'+side),lower=segment(calf,foot,'gaiter-'+side),boot=segment(foot,ball,'boot-'+side);
    const pants=part(new THREE.CylinderGeometry(.118,.135,upper.length*1.02,20,5),textile,'trouser-leg-'+side);pants.position.y=upper.length*.49;upper.group.add(pants);
    const gaiter=part(new THREE.CylinderGeometry(.09,.105,lower.length*1.02,20,5),leather,'leather-gaiter-'+side);gaiter.position.y=lower.length*.5;lower.group.add(gaiter);
    // Leave the knee flexible: the greave begins below it and follows calf.
    if(armored){const greave=part(new THREE.CylinderGeometry(.104,.118,lower.length*.58,20,3,true,Math.PI/2,Math.PI),steel,'greave-'+side);greave.position.set(0,lower.length*.56,-.012);lower.group.add(greave);}
    for(const t of [.25,.78]){const strap=part(new THREE.CylinderGeometry(.109-t*.015,.109-t*.015,.023,20),edge,'gaiter-strap-'+side);strap.position.y=lower.length*t;lower.group.add(strap);}
    const shoe=part(new THREE.SphereGeometry(1,16,10),leather,'boot-upper-'+side);shoe.scale.set(.095,boot.length*.92,.086);shoe.position.y=boot.length*.62;boot.group.add(shoe);
    const outsole=part(new THREE.SphereGeometry(1,16,8),sole,'boot-sole-'+side);outsole.scale.set(.099,boot.length*.96,.026);outsole.position.set(0,boot.length*.63,-.069);boot.group.add(outsole);
    actor.lowerGarments.push(upper.group,lower.group,boot.group);
  }
  return actor.lowerGarments;
}
