/**
 * Semantic action map shared by the GPU rig preview and future in-battle rigs.
 * The names deliberately describe intent rather than a vendor's clip naming.
 * This keeps retargeting data separate from hero models and makes it possible
 * to replace the development Soldier sample with a licensed production rig.
 */
export const ACTION_LIBRARY = Object.freeze({
  idle: ['Idle','idle','idle_pose','idle_no_loop','zombie_idle_loop','stand'],
  walk: ['Walk','walk','walk_idle','walk_carry','walk_carry_loop','zombie_walk_fwd_loop'],
  // UAL1 locomotion supplements UAL2's combat clips in the battle renderer.
  run: ['Jog_Fwd_Loop','Sprint_Loop','Run','run','sprint'],
  dash: ['Dash','dash','slide_start','sword_dash','shield_dash'],
  attack: ['Attack','attack','melee_hook','sword_regular_a','sword_heavy_combo','sword_dash','overhand_throw'],
  attackRecovery: ['Attack_Recovery','attack_recovery','melee_hook_rec','sword_regular_a_rec','sword_regular_b_rec'],
  hit: ['Hit','hit','hit_knockback','knockback','damage'],
  // UAL2 includes LayToIdle; GPU playback reverses it to create a real
  // controlled fall-to-ground instead of leaving units upright.
  death: ['Death','death','die','laytoidle'],
});

/** Find the best case-insensitive clip match for a semantic action. */
export function findActionClip(clips = [], action) {
  const names = ACTION_LIBRARY[action] || [action];
  return clips.find(clip => names.some(name => clip.name.toLowerCase() === name.toLowerCase())) ||
    clips.find(clip => names.some(name => clip.name.toLowerCase().includes(name.toLowerCase())));
}

/** Return a serialisable inventory for asset QA and retargeting reports. */
export function actionInventory(clips = []) {
  return Object.fromEntries(Object.keys(ACTION_LIBRARY).map(action => {
    const clip = findActionClip(clips, action);
    return [action, clip ? {name: clip.name, duration: clip.duration, tracks: clip.tracks.length} : null];
  }));
}
