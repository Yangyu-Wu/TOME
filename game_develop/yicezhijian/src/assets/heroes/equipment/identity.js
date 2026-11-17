import * as THREE from '../../../../vendor/three/three.module.min.js';

const palette={guanyu:['#2c6b50','#bd3b35'],zhouyu:['#9d302d','#d39c55'],zhugeliang:['#4b6b9c','#d7c18b'],lvbu:['#6f2535','#b69b58']};
function identitySeed(id='generic'){let value=2166136261;for(const char of id){value^=char.charCodeAt(0);value=Math.imul(value,16777619);}return value>>>0;}
function generatedPalette(id,enemy,faction){const seed=identitySeed(id),factionHue={魏:.60,蜀:.34,吴:.08,群雄:.78}[faction]??((seed%360)/360),hue=(factionHue+(seed%19-9)*.004+(enemy?.025:0))%1,color=new THREE.Color().setHSL(hue,.42,.3),accent=new THREE.Color().setHSL((hue+.095)%1,.52,.58);return [color.getStyle(),accent.getStyle()];}
function mat(color,metalness=.25,roughness=.55){return new THREE.MeshStandardMaterial({color,metalness,roughness,side:THREE.DoubleSide});}
function piece(g,m,p){m.userData.authoredHeroPalette=true;const o=new THREE.Mesh(g,m);o.position.set(...p);o.castShadow=true;o.receiveShadow=true;return o;}

/** Hero-specific head silhouette, deliberately separate from the neutral base mesh. */
export function attachHeroIdentity(actor,heroId='generic',enemy=false,{role='spear',faction=null}={}){
  const head=actor.root.getObjectByName('Head');if(!head)return null;
  const colors=palette[heroId]||generatedPalette(heroId,enemy,faction),seed=identitySeed(heroId);
  const root=new THREE.Group();root.name=`identity-${heroId}`;root.userData={heroId,role,faction,enemy:Boolean(enemy)};
  // The neutral model's Head-weighted surface spans local Y=-.021..+.211m.
  // Seat the headgear above the brow instead of covering the entire face.
  root.scale.setScalar(.65);root.position.y=.14;
  if(heroId==='zhugeliang'){
    root.add(piece(new THREE.ConeGeometry(.22,.16,6),mat(colors[0],.05,.8),[0,.18,0]));
    const ribbon=piece(new THREE.BoxGeometry(.04,.55,.025),mat(colors[1],.05,.72),[.17,.02,-.02]);ribbon.rotation.z=.25;root.add(ribbon);
  }else{
    root.add(piece(new THREE.CylinderGeometry(.22,.27,.1,8),mat(colors[0],.65,.32),[0,.11,0]));
    root.add(piece(new THREE.ConeGeometry(.18,.16,6),mat(colors[1],.4,.4),[0,.22,0]));
    if(heroId==='guanyu'||heroId==='zhouyu'||heroId==='lvbu'){
      const plume=piece(new THREE.ConeGeometry(.035,.38,6),mat(colors[1],.08,.72),[0,.43,0]);plume.rotation.z=heroId==='guanyu'?-.13:heroId==='lvbu'?.12:0;root.add(plume);
    }
    if(heroId==='guanyu'){
      const beardMat=mat('#251c1a',.02,.9);
      for(const x of [-.09,0,.09]){const beard=piece(new THREE.ConeGeometry(.045,.38,9),beardMat,[x,-.42,.24]);beard.rotation.set(.12,0,Math.PI);root.add(beard);}
    }else if(heroId==='zhouyu'){
      const hair=piece(new THREE.TorusGeometry(.16,.035,6,16),mat('#171a22',.02,.88),[0,.08,-.01]);hair.rotation.x=Math.PI/2;root.add(hair);
    }else if(heroId==='lvbu'){
      const crest=piece(new THREE.ConeGeometry(.07,.26,5),mat(colors[1],.35,.4),[0,.55,0]);crest.rotation.z=.12;root.add(crest);
    }else{
      // Job-readable silhouettes: each combat discipline gets a different
      // historical headgear language instead of arbitrary per-ID spikes.
      const band=piece(new THREE.TorusGeometry(.205,.018,5,14),mat(colors[1],.18,.6),[0,.06,.01]);band.rotation.x=Math.PI/2;root.add(band);
      if(role==='cavalry'){
        const brow=piece(new THREE.BoxGeometry(.4,.075,.32),mat(colors[0],.62,.34),[0,.04,.015]);root.add(brow);
        for(const side of [-1,1]){const cheek=piece(new THREE.BoxGeometry(.065,.2,.22),mat(colors[0],.58,.4),[side*.19,-.045,.03]);cheek.rotation.z=side*-.12;root.add(cheek);}
        const plume=piece(new THREE.ConeGeometry(.035,.42,6),mat(colors[1],.08,.72),[(seed&1)?.055:-.055,.34,0]);plume.rotation.z=(seed&2)?.12:-.12;root.add(plume);
      }else if(role==='archer'){
        const hood=piece(new THREE.SphereGeometry(.23,10,7,0,Math.PI*2,0,Math.PI*.55),mat(colors[0],.04,.84),[0,.095,-.01]);root.add(hood);
        for(const side of [-1,1]){const feather=piece(new THREE.ConeGeometry(.025,.2,5),mat(colors[1],.06,.75),[side*.17,.2,.04]);feather.rotation.z=side*-.3;root.add(feather);}
      }else if(role==='mage'||role==='support'){
        const cap=piece(new THREE.ConeGeometry(.23,.31,8),mat(colors[0],.08,.74),[0,.25,-.015]);root.add(cap);
        const bead=piece(new THREE.SphereGeometry(.045,8,6),mat(colors[1],.24,.38),[0,.42,.02]);root.add(bead);
      }else if(role==='shield'){
        const helmet=piece(new THREE.SphereGeometry(.245,10,7,0,Math.PI*2,0,Math.PI*.56),mat(colors[0],.7,.33),[0,.095,0]);root.add(helmet);
        const nose=piece(new THREE.BoxGeometry(.055,.2,.06),mat(colors[1],.54,.38),[0,-.025,.205]);root.add(nose);
        const crest=piece(new THREE.BoxGeometry(.035,.28,.055),mat(colors[1],.25,.5),[(seed&1)?.055:-.055,.29,0]);crest.rotation.z=(seed&2)?.13:-.13;root.add(crest);
      }else if(role==='assassin'){
        const mask=piece(new THREE.BoxGeometry(.28,.11,.055),mat(colors[0],.12,.62),[0,-.09,.17]);root.add(mask);
        for(const side of [-1,1]){const fin=piece(new THREE.ConeGeometry(.035,.24,5),mat(colors[1],.3,.42),[side*.19,.12,0]);fin.rotation.z=side*-.6;root.add(fin);}
      }else{
        const crestHeight=.18+(seed%3)*.035,crest=piece(new THREE.ConeGeometry(.045,.3,5),mat(colors[1],.28,.42),[(seed&1)?.04:-.04,.29,0]);crest.scale.y=crestHeight/.3;crest.rotation.z=(seed&2)?.12:-.12;root.add(crest);
        const sidePlates=piece(new THREE.BoxGeometry(.38,.035,.045),mat(colors[0],.22,.66),[0,.105,-.16]);sidePlates.rotation.z=(seed&4)?.07:-.07;root.add(sidePlates);
      }
    }
  }
  root.traverse(object=>{object.userData.identityBaseRotationX=object.rotation.x;object.userData.identityBaseRotationY=object.rotation.y;object.userData.identityBaseRotationZ=object.rotation.z;});
  head.add(root);actor.identity=root;return root;
}

/** Secondary motion for silhouette-defining head ornaments and facial pieces. */
export function animateHeroIdentity(actor,{time=0,moving=false,attack=false,hit=false,airHeight=0,hitDirection=1,hitStrength=1}={}){
  const root=actor.identity;if(!root)return;
  const speed=moving?1:.28,impact=Math.min(1,hitStrength||1),lag=Math.sin(time*4.2)*.035*speed+(attack?.045:0)+(hit?-.09*impact:0)+Math.min(.06,airHeight*.002);
  root.rotation.z+=(lag-root.rotation.z)*.22;
  root.rotation.y+=((hit?hitDirection*.08*impact:0)-root.rotation.y)*.24;
  root.children.forEach((piece,index)=>{const phase=time*4.8+index*.73,base=piece.userData.identityBaseRotationX??0,target=base+Math.sin(phase)*.025*speed+(hit?-.035*impact:0);piece.rotation.x+=(target-piece.rotation.x)*.18;});
}
