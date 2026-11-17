export function motionPose(unit){
  const phase=unit.walkPhase||0,stride=unit.moving?Math.sin(phase):0;
  // attackFlash counts down: expose a readable anticipation -> strike -> recovery curve.
  const attackDuration=.2,attacking=unit.attackMotion?unit.attackMotion.active:unit.attackFlash>0,attackProgress=unit.attackMotion?.active?Math.min(1,unit.attackMotion.age/unit.attackMotion.duration):unit.attackMotion?0:unit.attackFlash>0?1-Math.min(1,unit.attackFlash/attackDuration):0;
  const strike=Math.sin(Math.PI*Math.max(0,Math.min(1,(attackProgress-.18)/.68)));
  const anticipation=attackProgress<.3?Math.sin((1-attackProgress/.3)*Math.PI*.5):0;
  const recovery=attackProgress>.76?Math.sin(Math.min(1,(attackProgress-.76)/.24)*Math.PI):0;
  const role=unit.role||'spear',weaponReach=role==='cavalry'?1.25:role==='spear'?1.12:role==='archer'?.58:role==='shield'?.72:role==='mage'||role==='support'?.82:1;
  const attack=attacking?strike*.95:0;
  const recoil=unit.hitFlash>0?Math.sin(Math.min(1,unit.hitFlash/.14)*Math.PI)*-2.2:0;
  const breath=Math.sin((unit.visualTime||phase)*1.7)*.45;
  const bodyLean=(-anticipation*.045)+(strike*.06)+(recovery*.018)+(recoil*.028);
  const squash=1+(strike*.045)-(anticipation*.022)+(recovery*.012);
  const armSwing=role==='archer'?-.34:role==='mage'||role==='support'?.14:.16;
  const capeLag=Math.sin(phase*.75)*4+(unit.moving?5:0)+strike*8+recovery*3;
  return {stride,leftFoot:stride*7,rightFoot:-stride*7,bob:unit.moving?-Math.abs(Math.cos(phase))*2.6+breath:breath,arm:stride*armSwing+recoil+anticipation*.3, cape:capeLag,attack,attackArc:(strike*weaponReach-anticipation*.28+recovery*.12)*1.35,recoil,breath,turn:Math.sin(phase*.5)*.025+bodyLean,squash,attackProgress,attackAnticipation:anticipation,attackRecovery:recovery,weaponReach};
}
