export function applyRunGait(actor,phase,intensity=1,role='spear'){
  const bones=actor.runBones;
  const profile=role==='cavalry'?{cadence:.82,leg:1.2,arm:.78,lean:1.28}:role==='assassin'?{cadence:1.28,leg:.78,arm:1.12,lean:.72}:{cadence:1,leg:1,arm:1,lean:1};
  const swing=Math.sin(phase*profile.cadence)*intensity,opposite=Math.sin(phase*profile.cadence+Math.PI)*intensity;
  const apply=(bone,amount)=>{if(!bone)return;const previous=bone.userData.runMotionApplied||0,base=bone.rotation.x-previous;bone.rotation.x=base+amount;bone.userData.runMotionApplied=amount;};
  apply(bones.thighL,swing*.34*profile.leg);apply(bones.thighR,opposite*.34*profile.leg);
  // Bend the actual calf/shin bones during the recovery portion of each step.
  // The previous mapping drove the forearms a second time and left knees stiff.
  apply(bones.calfL,Math.max(0,swing)*.42*profile.leg+Math.max(0,-swing)*.08*profile.leg);
  apply(bones.calfR,Math.max(0,opposite)*.42*profile.leg+Math.max(0,-opposite)*.08*profile.leg);
  apply(bones.footL,-Math.max(0,swing)*.24*profile.leg+Math.max(0,-swing)*.12*profile.leg);
  apply(bones.footR,-Math.max(0,opposite)*.24*profile.leg+Math.max(0,-opposite)*.12*profile.leg);
  apply(bones.upperL,opposite*.24*profile.arm);apply(bones.upperR,swing*.24*profile.arm);
  apply(bones.forearmL,Math.max(0,swing)*.18*profile.arm);apply(bones.forearmR,Math.max(0,opposite)*.18*profile.arm);
  apply(bones.spine,-.085*intensity*profile.lean+Math.sin(phase*profile.cadence*2)*.018);
  apply(bones.spineMid,.035*intensity);
  return profile;
}
