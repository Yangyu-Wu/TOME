import * as THREE from '../../../vendor/three/three.module.min.js';

// Small hot metal splinters, drawn as oriented analytic sprites. The combat
// effect's life is the clock: extra GPU frames never advance the impact.
export function createMeleeImpact(){
  const count=18,positions=new Float32Array(count*3),velocity=new Float32Array(count*3),sizes=new Float32Array(count);
  for(let i=0;i<count;i++){
    const angle=i*2.3999632297,speed=18+(i*17%35);
    velocity[i*3]=Math.cos(angle)*speed;velocity[i*3+1]=Math.sin(angle)*speed*.7+8;velocity[i*3+2]=i%3;
    sizes[i]=i%4===0?7:3+(i%3);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('velocity',new THREE.BufferAttribute(velocity,3));geometry.setAttribute('size',new THREE.BufferAttribute(sizes,1));
  const uniforms={uAge:{value:0},uRatio:{value:1},uZoom:{value:1},uFacing:{value:1}};
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
    vertexShader:`attribute vec3 velocity;attribute float size;uniform float uAge,uRatio,uZoom,uFacing;varying float vAngle,vAge;void main(){float t=uAge;vec3 p=position+velocity*vec3(uFacing,1.,1.)*t;p.y-=20.*t*t;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=max(1.,size*(1.-t*.65)*uRatio*uZoom);vAngle=atan(velocity.y,velocity.x*uFacing);vAge=t;}`,
    fragmentShader:`varying float vAngle,vAge;void main(){vec2 p=gl_PointCoord-.5;float c=cos(vAngle),s=sin(vAngle);vec2 q=mat2(c,s,-s,c)*p;float d=length(q*vec2(.8,2.7));float alpha=(1.-smoothstep(.16,.5,d))*pow(1.-vAge,1.8);if(alpha<.005)discard;vec3 color=mix(vec3(1.,.32,.045),vec3(1.,.98,.78),1.-smoothstep(.04,.32,d));gl_FragColor=vec4(color,alpha);}`
  });
  const sparks=new THREE.Points(geometry,material);sparks.frustumCulled=false;sparks.renderOrder=2500;return sparks;
}
export function updateMeleeImpact(sparks,effect,{height,pixelRatio,zoom=1}){
  sparks.position.set(effect.x,height-effect.y,25);
  sparks.material.uniforms.uAge.value=Math.max(0,Math.min(1,1-effect.life/effect.maxLife));
  sparks.material.uniforms.uRatio.value=pixelRatio;sparks.material.uniforms.uZoom.value=zoom;sparks.material.uniforms.uFacing.value=effect.direction<0?-1:1;
}
export function disposeMeleeImpact(sparks){sparks.removeFromParent();sparks.geometry.dispose();sparks.material.dispose();}
