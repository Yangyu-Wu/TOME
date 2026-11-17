import * as THREE from '../../../../vendor/three/three.module.min.js';

const declarations=`
uniform float uCapeTime;
uniform float uCapePhase;
uniform float uCapeWind;
// Shared by the color and shadow passes, with an analytically differentiated
// normal. Squared drop keeps both displacement and slope zero at the collar.
vec3 capeSurface(vec3 p) {
  float d=clamp(-p.y,0.0,1.0);
  float wave=sin(uCapeTime*4.4-p.y*8.0+p.x*7.0+uCapePhase);
  return vec3(p.xy,p.z+wave*d*d*uCapeWind);
}
vec3 capeNormal(vec3 p) {
  float d=clamp(-p.y,0.0,1.0);
  float phase=uCapeTime*4.4-p.y*8.0+p.x*7.0+uCapePhase;
  float dx=7.0*cos(phase)*d*d*uCapeWind;
  float dd=(p.y<0.0 && p.y>-1.0)?-1.0:0.0;
  float dy=(-8.0*cos(phase)*d*d+2.0*sin(phase)*d*dd)*uCapeWind;
  return normalize(vec3(-dx,-dy,1.0));
}
`;

export function attachCapeWind(panel,offset=0){
  const uniforms={uCapeTime:{value:0},uCapePhase:{value:offset*7},uCapeWind:{value:.035}};
  const patch=(material,normalPass)=>{
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+declarations)
        .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed = capeSurface(position);');
      if(normalPass)shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal = capeNormal(position);');
      material.userData.capeShader=shader;
    };
    // Uniform values do not change program source: all panels share a program.
    material.customProgramCacheKey=()=>`hero-cape-wind-v2-${normalPass?'surface':'depth'}`;
  };
  patch(panel.material,true);
  panel.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
  patch(panel.customDepthMaterial,false);
  panel.userData.windUniforms=uniforms;
}
