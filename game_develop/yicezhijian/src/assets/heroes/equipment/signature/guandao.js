import * as THREE from '../../../../../vendor/three/three.module.min.js';
import {polearm,blade,anchors,add,metal} from './polearm.js';

export function createGuandao(){
  const {root,steel,brass}=polearm('qinglong-guandao','#204a3b');
  const shape=new THREE.Shape();shape.moveTo(-.035,0);shape.lineTo(.04,0);shape.bezierCurveTo(.29,.03,.35,.27,.075,.57);shape.bezierCurveTo(.16,.29,.05,.2,-.035,.19);shape.closePath();
  blade(root,shape,steel,[0,.69,-.009],'crescent-blade');
  const spine=new THREE.CatmullRomCurve3([new THREE.Vector3(.018,.72,.025),new THREE.Vector3(.08,.82,.025),new THREE.Vector3(.15,.98,.025),new THREE.Vector3(.09,1.17,.025)]);
  add(root,new THREE.TubeGeometry(spine,28,.009,6,false),brass,[0,0,0],'blade-ridge');
  add(root,new THREE.SphereGeometry(.055,16,10),metal('#4e8467',.4),[0,.7,0],'jade-collar');
  return anchors(root,[0,.72,0],[.075,1.26,0]);
}
