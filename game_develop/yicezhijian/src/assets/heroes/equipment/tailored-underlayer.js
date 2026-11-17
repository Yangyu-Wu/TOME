import * as THREE from '../../../../vendor/three/three.module.min.js';

const coveredBone=name=>/^(pelvis|spine_0[123]|clavicle_[lr]|upperarm_[lr]|lowerarm_[lr]|thigh_[lr]|calf_[lr])$/.test(name);
const palettes={guanyu:'#214b3e',lvbu:'#392e48',zhaoyun:'#567380',zhouyu:'#293f5d',zhugeliang:'#38475c'};

// Derive the under-tunic from the licensed base's own skinned surface. Keeping
// its bind matrix, weights and skeleton makes the fabric cover the body at
// bent elbows, waist and knees where rigid cylinders leave gaps.
export function attachTailoredUnderlayer(actor,{heroId='generic',enemy=false}={}){
  const sources=[];actor.root.traverse(mesh=>{if(mesh.isSkinnedMesh&&mesh.material?.name==='MI_Superhero_Male')sources.push(mesh);});
  actor.underlayers=[];
  for(const source of sources){
    const original=source.geometry,skin=original.attributes.skinIndex,weights=original.attributes.skinWeight,index=original.index;
    const coverage=new Float32Array(skin.count);
    for(let v=0;v<skin.count;v++)for(let c=0;c<4;c++)if(coveredBone(source.skeleton.bones[skin.getComponent(v,c)]?.name||''))coverage[v]+=weights.getComponent(v,c);
    const triangles=[];
    for(let i=0;i<(index?.count||skin.count);i+=3){const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;if(Math.min(coverage[a],coverage[b],coverage[c])>.48)triangles.push(a,b,c);}
    if(!triangles.length)continue;
    const geometry=original.clone();geometry.setIndex(triangles);geometry.clearGroups();
    const positions=geometry.attributes.position,normals=geometry.attributes.normal;
    for(let v=0;v<positions.count;v++){positions.setXYZ(v,positions.getX(v)+normals.getX(v)*.006,positions.getY(v)+normals.getY(v)*.006,positions.getZ(v)+normals.getZ(v)*.006);}
    positions.needsUpdate=true;
    const material=new THREE.MeshStandardMaterial({color:palettes[heroId]|| (enemy?'#482832':'#283b50'),roughness:.93,metalness:0});
    material.name='tailored-cloth';material.userData.authoredHeroPalette=true;
    // The subtle source normal map retains folds/anatomical volume without
    // copying the bare-skin albedo onto the new cloth surface.
    material.normalMap=source.material.normalMap;material.normalScale.set(.28,.28);
    const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='tailored-underlayer';mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);mesh.bindMode=source.bindMode;mesh.bind(source.skeleton,source.bindMatrix);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
    mesh.userData.coverageTriangles=triangles.length/3;mesh.userData.derivedFrom='Quaternius Universal Base Characters (CC0)';source.parent.add(mesh);actor.underlayers.push(mesh);
  }
  return actor.underlayers;
}
