// Restore the authored pose BEFORE the mixer runs. Removing last frame's
// Euler offsets after mixer.update() subtracts them from a new quaternion
// supplied by the clip, corrupting the next frame instead of undoing the old.
export function restoreAuthoredPose(actor){
  for(const [bone,quaternion] of actor.authoredPose||[])bone.quaternion.copy(quaternion);
  for(const [bone,position] of actor.authoredPositions||[])bone.position.copy(position);
  for(const bone of new Set([...Object.values(actor.runBones||{}),...(actor.poseBones||[])])){
    if(!bone)continue;
    for(const key of ['runMotionApplied','combatZ','combatMidZ','combatArmZ','combatElbowZ','combatOffArmZ'])delete bone.userData[key];
  }
}

export function captureAuthoredPose(actor){
  if(actor.posePositionBones){
    actor.authoredPositions??=new Map();
    for(const bone of actor.posePositionBones){let position=actor.authoredPositions.get(bone);if(position)position.copy(bone.position);else actor.authoredPositions.set(bone,bone.position.clone());}
  }
  actor.authoredPose??=new Map();
  for(const bone of new Set([...Object.values(actor.runBones||{}),...(actor.poseBones||[])])){
    if(!bone)continue;
    let pose=actor.authoredPose.get(bone);
    if(!pose){pose=bone.quaternion.clone();actor.authoredPose.set(bone,pose);}
    else pose.copy(bone.quaternion);
  }
  // Toe joints also participate in the masked locomotion overlay.
  for(const name of ['ball_l','ball_r']){
    const bone=actor.root?.getObjectByName(name);if(!bone)continue;
    let pose=actor.authoredPose.get(bone);
    if(!pose){pose=bone.quaternion.clone();actor.authoredPose.set(bone,pose);}else pose.copy(bone.quaternion);
  }
}
