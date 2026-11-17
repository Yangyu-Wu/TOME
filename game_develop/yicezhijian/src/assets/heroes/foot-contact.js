// The boot sole is a transformed unit sphere (ellipsoid). Its lowest world Y
// can be computed from the Y row of its affine matrix, without scanning mesh
// vertices or allocating a Box3 for every actor every frame.
export function soleBottomY(sole){
  const e=sole.matrixWorld.elements;
  return e[13]-Math.hypot(e[1],e[5],e[9]);
}

export function applyFootContact(actor,dt){
  if(!actor.root.visible)return;
  if(actor.airborne||actor.lastState==='death'){actor.groundOffset=0;return;}
  actor.soleContacts??=['l','r'].map(side=>actor.root.getObjectByName('boot-sole-'+side)).filter(Boolean);
  if(!actor.soleContacts.length)return;
  actor.root.updateMatrixWorld(true);
  const lowest=Math.min(...actor.soleContacts.map(soleBottomY));
  const ground=actor.groundY??actor.root.position.y;
  // updateUnit resets root position each frame. Ground correction therefore
  // replaces last frame's offset instead of feeding back into the next pose.
  const maxCorrection=14*(actor.contactSize||1),target=Math.max(-maxCorrection,Math.min(maxCorrection,ground-lowest));
  actor.groundOffset=(actor.groundOffset||0)+(target-(actor.groundOffset||0))*(1-Math.exp(-24*Math.max(0,dt)));
  actor.root.position.y+=actor.groundOffset;
}
