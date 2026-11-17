import * as THREE from '../../vendor/three/three.module.min.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {clone} from '../../vendor/three/SkeletonUtils.js';
import {findActionClip,actionInventory} from '../assets/heroes/action-library.js';

export class RigPreview{
 constructor(canvas){
  this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#182432');this.scene.fog=new THREE.Fog('#182432',8,18);
  this.camera=new THREE.PerspectiveCamera(34,canvas.clientWidth/canvas.clientHeight,.1,50);this.camera.position.set(0,2.5,10.5);this.camera.lookAt(0,1,0);
  this.scene.add(new THREE.HemisphereLight('#c7e5ff','#44352d',1.35));
  const key=new THREE.DirectionalLight('#ffe5bd',3.1);key.position.set(-3,6,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.bias=-.00025;this.scene.add(key);
  const fill=new THREE.DirectionalLight('#9bb5d4',.9);fill.position.set(3,2,5);this.scene.add(fill);
  const rim=new THREE.DirectionalLight('#628fff',2.2);rim.position.set(4,3,-4);this.scene.add(rim);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(4,64),new THREE.MeshStandardMaterial({color:'#354248',roughness:.92,metalness:.02}));ground.rotation.x=-Math.PI/2;ground.position.y=-.04;ground.receiveShadow=true;this.scene.add(ground);
  this.clock=new THREE.Clock();this.loader=new GLTFLoader();this.ready=false;
 }
 async load(url='../src/assets/heroes/humanoid-rig.glb'){
  const gltf=await this.loader.loadAsync(url);this.source=gltf.scene;this.clips=gltf.animations;
  this.source.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;obj.frustumCulled=true;obj.material=obj.material.clone();if(obj.material.color)obj.material.color.set('#d7c4a0');if('roughness'in obj.material)obj.material.roughness=.62;if('metalness'in obj.material)obj.material.metalness=.18;}});
  const box=new THREE.Box3().setFromObject(this.source),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());this.source.position.sub(center);this.source.position.y+=size.y*.5;this.source.scale.setScalar(2.65/size.y);this.scene.add(this.source);
  this.mixer=new THREE.AnimationMixer(this.source);this.actions=new Map(this.clips.map(clip=>[clip.name,this.mixer.clipAction(clip)]));this.currentAction=null;
  this.actors=[{root:this.source,mixer:this.mixer,actions:this.actions}];
  const positions=[[-2.4,0,-.8],[0,0,-1.1],[2.4,0,-.8],[-1.2,0,-2.1],[1.2,0,-2.1],[-3.5,0,-3.2],[0,0,-3.4],[3.5,0,-3.2]];
  for(const [index,[x,y,z]] of positions.entries()){
   const actor=clone(this.source);actor.position.set(x,this.source.position.y+y,z);actor.scale.copy(this.source.scale);actor.rotation.y=index%2?-.12:.12;actor.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}});this.scene.add(actor);
   const mixer=new THREE.AnimationMixer(actor),actions=new Map(this.clips.map(clip=>[clip.name,mixer.clipAction(clip)]));this.actors.push({root:actor,mixer,actions});
  }
  this.play(this.clips[0]?.name);this.ready=true;
  const grid=new THREE.GridHelper(8,24,'#8996a3','#394650');grid.position.y=-.03;this.scene.add(grid);
  return {clips:this.clips.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length})),actions:actionInventory(this.clips),height:size.y,meshes:this.countMeshes(),actors:this.actors.length,shadowMap:this.renderer.shadowMap.enabled};
 }
 countMeshes(){let count=0;this.source.traverse(o=>{if(o.isMesh)count++;});return count;}
 play(name){const first=this.actions.get(name);if(!first)return false;for(const actor of this.actors){const next=actor.actions.get(name);if(!next)continue;next.reset().fadeIn(.22).play();if(actor.currentAction)actor.currentAction.fadeOut(.22);actor.currentAction=next;}this.currentAction=first;return true;}
 playState(state){const clip=findActionClip(this.clips,state);return clip?this.play(clip.name):false;}
 resize(){this.renderer.setSize(this.canvas.clientWidth,this.canvas.clientHeight,false);this.camera.aspect=this.canvas.clientWidth/this.canvas.clientHeight;this.camera.updateProjectionMatrix();}
 render(){if(!this.ready)return;this.resize();const dt=Math.min(.05,this.clock.getDelta()),now=performance.now()*.001;for(const [index,actor] of this.actors.entries()){actor.mixer.update(dt);if(index>0){actor.root.position.y=Math.sin(now*2.1+index)*.035;actor.root.rotation.y=(index%2?-.12:.12)+Math.sin(now*.7+index)*.06;}}this.source.rotation.y=Math.sin(now*.45)*.22;this.renderer.render(this.scene,this.camera);}
}
