import * as THREE from '../../../../../vendor/three/three.module.min.js';

export function metal(color,roughness=.3){const m=new THREE.MeshPhysicalMaterial({color,metalness:.82,roughness,clearcoat:.16,clearcoatRoughness:.26});m.userData.authoredHeroPalette=true;return m;}
export function add(root,geometry,material,position=[0,0,0],name='weapon-part'){
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
export function polearm(name,shaftColor='#293c32'){
  const root=new THREE.Group();root.name='weapon-'+name;
  const steel=metal('#adbcc5'),brass=metal('#ad884b',.38),shaft=new THREE.MeshStandardMaterial({color:shaftColor,roughness:.72,metalness:.08});shaft.userData.authoredHeroPalette=true;
  add(root,new THREE.CylinderGeometry(.024,.027,1.65,16),shaft,[0,-.08,0],'pole-shaft');
  for(const y of [-.86,-.42,.28,.68])add(root,new THREE.CylinderGeometry(.032,.032,.045,16),brass,[0,y,0],'shaft-ferrule');
  // Visible spiral binding at the palm: tube geometry carries a real rounded
  // highlight instead of painting a stripe on a flat handle.
  const points=[];for(let i=0;i<=120;i++){const t=i/120,angle=t*Math.PI*16;points.push(new THREE.Vector3(Math.cos(angle)*.028,-.19+t*.38,Math.sin(angle)*.028));}
  add(root,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),120,.006,5,false),brass,[0,0,0],'grip-binding');
  add(root,new THREE.ConeGeometry(.028,.12,12),steel,[0,-.95,0],'butt-spike').rotation.z=Math.PI;
  root.userData.kind='spear';root.userData.signature=name;return {root,steel,brass};
}
export function blade(root,shape,mat,position,name){
  return add(root,new THREE.ExtrudeGeometry(shape,{depth:.018,steps:1,bevelEnabled:true,bevelSegments:3,bevelSize:.006,bevelThickness:.006,curveSegments:24}),mat,position,name);
}
export function anchors(root,base,tip){
  for(const [name,position] of [['trailBase',base],['trailTip',tip]]){const point=new THREE.Object3D();point.name=name==='trailBase'?'blade-base':'blade-tip';point.position.set(...position);root.add(point);root.userData[name]=point;}
  return root;
}

// A forged spearhead has a raised central spine and a thin cutting edge.
// Four separate face strips preserve that cross-section in the normals;
// a flat extruded silhouette cannot produce these changing metal highlights.
export function ridgedSpearhead(length=.5,halfWidth=.06){
  const positions=[],uvs=[],segments=32;
  function section(t){
    const y=t*length,width=Math.sin(Math.PI*t)*halfWidth*(1.4-.8*t),ridge=Math.sin(Math.PI*t)*.019;
    return [[-width,y,0],[0,y,ridge],[width,y,0],[0,y,-ridge]];
  }
  for(let i=0;i<segments;i++){
    const a=section(i/segments),b=section((i+1)/segments);
    for(let side=0;side<4;side++){
      const next=(side+1)%4;
      const triangles=[[[a[side],0,i/segments],[a[next],1,i/segments],[b[side],0,(i+1)/segments]],[[a[next],1,i/segments],[b[next],1,(i+1)/segments],[b[side],0,(i+1)/segments]]];
      for(const triangle of triangles){
        const [p,q,r]=triangle.map(([point])=>new THREE.Vector3(...point));
        if(q.sub(p).cross(r.sub(p)).lengthSq()<1e-18)continue;
        for(const [point,u,v] of triangle){positions.push(...point);uvs.push(u,v);}
      }
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
