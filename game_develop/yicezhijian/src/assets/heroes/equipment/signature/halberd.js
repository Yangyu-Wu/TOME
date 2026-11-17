import * as THREE from '../../../../../vendor/three/three.module.min.js';
import {polearm,blade,anchors,add,ridgedSpearhead} from './polearm.js';

export function createHalberd(){
  const {root,steel,brass}=polearm('fangtian-halberd','#35263e');
  add(root,ridgedSpearhead(.52,.045),steel,[0,.75,0],'central-spearhead');
  const shape=new THREE.Shape();shape.moveTo(.04,.03);shape.bezierCurveTo(.34,.03,.38,.35,.055,.51);shape.bezierCurveTo(.2,.33,.2,.17,.04,.14);shape.closePath();
  for(const side of [-1,1]){const wing=blade(root,shape,steel,[0,.68,-.009],'crescent-wing-'+side);wing.scale.x=side;}
  const crossbar=add(root,new THREE.CylinderGeometry(.018,.018,.44,12),brass,[0,.84,0],'crossbar');crossbar.rotation.z=Math.PI/2;
  add(root,new THREE.CylinderGeometry(.041,.041,.12,16),brass,[0,.69,0],'halberd-socket');
  return anchors(root,[0,.74,0],[0,1.27,0]);
}
