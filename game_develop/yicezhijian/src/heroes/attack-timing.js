// Shared simulation/render timing. No rendering imports: combat also runs in
// headless checks and the Canvas fallback must use the same impact events.
export const SIGNATURE_ATTACKS=Object.freeze({
  guanyu:Object.freeze({name:'Polearm_Guandao_Sweep',duration:1.02,impact:.51,trail:[.34,.71]}),
  lvbu:Object.freeze({name:'Polearm_Halberd_Cleave',duration:1.14,impact:.54,trail:[.36,.66]}),
  zhaoyun:Object.freeze({name:'Polearm_Spear_Thrust',duration:.78,impact:.51,trail:[.32,.61]})
});
export function signatureAttackFor(unit){return unit.role==='spear'?SIGNATURE_ATTACKS[unit.heroId]:null;}
