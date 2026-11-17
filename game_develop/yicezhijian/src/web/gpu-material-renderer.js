import * as THREE from '../../vendor/three/three.module.min.js';

const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragmentShader=`uniform sampler2D colorMap;uniform sampler2D normalMap;uniform float elapsed;uniform float opacity;uniform float tileRepeat;uniform float lightingMode;varying vec2 vUv;void main(){vec2 uv=vUv*vec2(tileRepeat,tileRepeat*.68)+vec2(elapsed*.00012,elapsed*.00007);vec4 tex=texture2D(colorMap,uv);vec3 tangentNormal=texture2D(normalMap,uv).xyz*2.0-1.0;/* The material is a camera-facing ground plane, so its UV tangent frame is stable. */vec3 n=normalize(vec3(tangentNormal.xy*.72,abs(tangentNormal.z)+.35));vec3 light=normalize(vec3(-.35,.45,.82)),viewDir=vec3(0.0,0.0,1.0),halfDir=normalize(light+viewDir);float ndl=max(0.0,dot(n,light)),ndh=max(0.0,dot(n,halfDir));float roughness=.58+.12*(1.0-tex.r);float specular=pow(ndh,mix(42.0,10.0,roughness))*(1.0-roughness)*.24;float fresnel=pow(1.0-max(0.0,dot(n,viewDir)),4.0);float diffuse=.52+.48*ndl;float grain=.985+.015*sin(vUv.x*410.0)*sin(vUv.y*360.0);vec3 cinematic=tex.rgb*(diffuse+specular)+vec3(.08,.11,.14)*fresnel*.32;vec3 legacy=tex.rgb*(.58+.42*max(0.0,dot(normalize(tangentNormal),light)));vec3 color=mix(legacy,cinematic,lightingMode)*grain;gl_FragColor=vec4(color,opacity);}`;
export class GpuMaterialRenderer{
 constructor(canvas,{lighting='cinematic'}={}){
  this.canvas=canvas;this.renderer=null;this.scene=null;this.camera=null;this.material=null;this.textureLoader=new THREE.TextureLoader();this.ready=false;this.mode='unavailable';this.capabilities={webgl2:false,renderer:'none'};
  try{
   this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});this.mode='webgl2';this.capabilities={webgl2:true,renderer:this.renderer.getContext().getParameter(this.renderer.getContext().RENDERER)||'WebGL2'};
   this.renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));this.renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);this.renderer.setClearColor(0x000000,0);
   this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);this.camera.position.z=2;
   const geometry=new THREE.PlaneGeometry(2,2);this.material=new THREE.ShaderMaterial({uniforms:{colorMap:{value:null},normalMap:{value:null},elapsed:{value:0},opacity:{value:.72},tileRepeat:{value:4},lightingMode:{value:lighting==='cinematic'?1:0}},vertexShader,fragmentShader,transparent:true,depthTest:false,depthWrite:false});this.lightingMode=lighting;
   this.scene.add(new THREE.Mesh(geometry,this.material));this.loadPromise=this.loadMaps().then(()=>{this.ready=true;return true;}).catch(error=>{this.ready=false;this.mode='canvas-fallback';this.capabilities={webgl2:false,renderer:'Canvas fallback'};document.documentElement.dataset.gpuRenderer=this.mode;console.warn('GPU material textures unavailable; Canvas renderer remains active.',error);return false;});window.addEventListener('resize',()=>this.resize());
  }catch(error){this.mode='canvas-fallback';this.capabilities={webgl2:false,renderer:'Canvas fallback'};console.warn('GPU material overlay unavailable; Canvas renderer remains active.',error);}
 }
 async loadMaps(){
  const base=new URL('../../src/assets/materials/',import.meta.url);const [color,normal]=await Promise.all(['stone_tiles_02_diff_2k.jpg','stone_tiles_02_nor_gl_2k.jpg'].map(file=>this.textureLoader.loadAsync(new URL(file,base).href)));
  for(const texture of [color,normal]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=texture===color?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.anisotropy=this.renderer.capabilities.getMaxAnisotropy();texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;}
  this.material.uniforms.colorMap.value=color;this.material.uniforms.normalMap.value=normal;this.material.uniformsNeedUpdate=true;this.textures=[color,normal];
 }
 resize(){if(!this.renderer)return;this.renderer.setSize(this.canvas.clientWidth,this.canvas.clientHeight,false);}
 render(time=0,state=null){if(!this.ready)return;this.material.uniforms.elapsed.value=time;const environment=state?.battlefield?.environment||state?.battlefield?.terrain?.environment;const surface=environment==='snow'?'snow':environment==='desert'?'desert':'stone';const maps=this.surfaceMaps?.[surface]||this.textures;this.material.uniforms.colorMap.value=maps?.[0]||this.textures[0];this.material.uniforms.normalMap.value=maps?.[1]||this.textures[1];this.material.uniforms.opacity.value=state?.phase==='battle'?.78:.42;this.material.uniforms.tileRepeat.value=surface==='stone'?5:4;this.renderer.render(this.scene,this.camera);}
 setLighting(mode='cinematic'){this.lightingMode=mode==='legacy'?'legacy':'cinematic';if(this.material)this.material.uniforms.lightingMode.value=this.lightingMode==='cinematic'?1:0;}
 dispose(){this.textures?.forEach(t=>t.dispose());this.material?.dispose();this.renderer?.dispose();}
}
