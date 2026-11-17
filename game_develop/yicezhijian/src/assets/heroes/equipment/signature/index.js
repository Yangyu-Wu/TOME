import {createGuandao} from './guandao.js';
import {createHalberd} from './halberd.js';
import {createSilverSpear} from './silver-spear.js';

const makers={guanyu:createGuandao,lvbu:createHalberd,zhaoyun:createSilverSpear};
export function createSignatureWeapon(heroId){return makers[heroId]?.()||null;}
