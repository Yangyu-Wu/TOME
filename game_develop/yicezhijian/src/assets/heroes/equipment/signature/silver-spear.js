import * as THREE from '../../../../../vendor/three/three.module.min.js';
import {polearm,ridgedSpearhead,anchors,add} from './polearm.js';

export function createSilverSpear(){
  const {root,steel,brass}=polearm('longdan-silver-spear','#67818b');
  add(root,ridgedSpearhead(.5,.06),steel,[0,.72,0],'willow-spearhead');
  const cord=new THREE.MeshStandardMaterial({color:'#a22636',roughness:.9,side:THREE.DoubleSide});cord.userData.authoredHeroPalette=true;
  for(let i=0;i<7;i++){const strand=add(root,new THREE.PlaneGeometry(.018,.19,1,5),cord,[Math.sin(i)*.045,.66,Math.cos(i)*.04],'spear-tassel');strand.rotation.z=(i-3)*.12;}
  add(root,new THREE.CylinderGeometry(.045,.037,.07,16),brass,[0,.73,0],'spear-socket');
  return anchors(root,[0,.75,0],[0,1.22,0]);
}
