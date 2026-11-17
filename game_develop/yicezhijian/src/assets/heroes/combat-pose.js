// Additive combat posing layered after the authored clip. The source library
// supplies timing; this pass supplies readable silhouette and role weight.
export function applyCombatPose(actor,phase=0,role='spear',state='idle',facing=1){
  if(actor.polearmRig&&state!=='hit')return;
  const b=actor.runBones||{},attack=state==='attack',hit=state==='hit';
  const profile=role==='cavalry'?{twist:.13,shoulder:.12,elbow:.08}:role==='assassin'?{twist:.09,shoulder:.16,elbow:.12}:role==='archer'||role==='mage'||role==='support'?{twist:.035,shoulder:.07,elbow:.04}:{twist:.085,shoulder:.1,elbow:.07};
  const strike=attack?Math.sin(Math.PI*Math.max(0,Math.min(1,phase))):0,recoil=hit?Math.min(1,Math.max(0,actor.hitWeight||1)):0;
  const apply=(bone,amount,key)=>{if(!bone)return;const previous=bone.userData[key]||0,base=bone.rotation.z-previous;bone.rotation.z=base+amount;bone.userData[key]=amount;};
  apply(b.spine,facing*(attack?profile.twist*strike:-.08*recoil),'combatZ');
  apply(b.spineMid,facing*(attack?profile.twist*.52*strike:-.045*recoil),'combatMidZ');
  apply(b.upperR,-facing*(attack?profile.shoulder*strike:0),'combatArmZ');
  apply(b.lowerR,facing*(attack?profile.elbow*strike:0),'combatElbowZ');
  apply(b.upperL,facing*(attack?-profile.shoulder*.42*strike:0),'combatOffArmZ');
}
