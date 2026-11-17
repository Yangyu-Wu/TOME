const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createBattlefield() {
  return {
    marks:[],
    waters:[{x:155,y:390,rx:112,ry:57},{x:807,y:237,rx:106,ry:47}],
    props:[
      ['rock',330,300,25],['rock',645,390,30],['rock',758,170,20],
      ['crate',420,400,18],['crate',550,270,18],['crate',715,470,17],
      ['barricade',270,210,30],['barricade',665,210,30],
      ['tree',90,185,23],['tree',840,480,25],['tree',185,485,21],
      ['torch',220,140,12],['torch',740,140,12],['torch',235,525,12],['torch',730,525,12],
    ].map(([kind,x,y,radius],id)=>({id,kind,x,y,radius,hp:kind==='rock'?150:80,maxHp:kind==='rock'?150:80,destroyed:false,heat:0,brokenAt:null})),
  };
}

export function scarGround(state,x,y,radius,theme,color) {
  const field=state.battlefield;if(!field)return;
  field.marks.push({x:clamp(x,32,928),y:clamp(y,100,568),radius:Math.min(110,radius),theme,color,born:state.visualTime||0,seed:field.marks.length*31+Math.round(x+y)});
  if(field.marks.length>72)field.marks.shift();
}

export function damageScenery(state,x,y,radius,power,theme) {
  const fragments=[];
  for(const prop of state.battlefield?.props||[]){
    if(prop.destroyed||Math.hypot(prop.x-x,prop.y-y)>radius+prop.radius)continue;
    prop.hp=Math.max(0,prop.hp-power);prop.heat=theme==='inferno'?1:.4;
    if(prop.hp===0){
      prop.destroyed=true;prop.brokenAt=state.visualTime;
      for(let i=0;i<10;i++){const a=i*2.399+prop.id;fragments.push({x:prop.x,y:prop.y,z:15,vx:Math.cos(a)*(40+i*10),vy:Math.sin(a)*(25+i*6),vz:100+i*11,life:2.8,maxLife:2.8,size:3+i%4,color:prop.kind==='rock'?'#9faaa9':'#bc8752',kind:'debris',rotation:a,spin:(i%2?1:-1)*5});}
      state.events?.push({type:'scenery-destroyed',id:prop.id,kind:prop.kind,theme});
    }
  }
  return fragments;
}

export function updateScenery(state,dt){for(const prop of state.battlefield?.props||[])prop.heat=Math.max(0,prop.heat-dt*.1);}
