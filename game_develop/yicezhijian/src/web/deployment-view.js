import {evaluateSynergies} from '../content/synergies.js';
import {HEROES,HERO_BY_ID,portraitMarkup,drawHeroPortrait} from '../heroes/index.js';
const ROLE_NAME={shield:'盾将',spear:'枪将',archer:'弓将',mage:'谋士',support:'辅助',cavalry:'骑将',assassin:'突袭'};

export class DeploymentView {
  constructor(root,app){this.root=root;this.app=app;this.shopOpen=false;this.search='';this.faction='';this.selected={slot:'front',position:0};}
  render(state){
    if(state.phase==='battle'){this.root.classList.add('hidden');return;}
    this.root.classList.remove('hidden');
    if(['reward','defeat'].includes(state.phase)){this.root.innerHTML=this.result(state);this.bindResult();return;}
    if(state.testMode){this.renderTestCamp(state);return;}
    const front=state.roster.filter(x=>x.slot==='front'),back=state.roster.filter(x=>x.slot==='back'),bench=state.roster.filter(x=>x.slot==='bench'),canBattle=front.length>0;
    this.root.innerHTML=`<section class="deployment"><aside><h3>羁绊谱</h3>${evaluateSynergies(state.roster.filter(unit=>unit.slot!=='bench')).map(x=>`<div class="bond ${x.active?'active':''}" title="${x.description||''}"><b>${x.icon}</b><span>${x.name}<small>${x.count}/${x.threshold}</small><em>${x.active?x.description||'已激活':'未激活'}</em></span></div>`).join('')}<button data-action="shop">商店</button></aside><main><h2>前军阵</h2><div class="slots">${this.slots(front,2,'front')}</div><h2>后军阵</h2><div class="slots">${this.slots(back,2,'back')}</div><h2>备战席</h2><div class="bench-slots">${this.slots(bench,9,'bench')}</div></main><footer><span>第 ${state.wave+1} 战 · 铜 ${state.gold}</span><button data-action="refresh" ${state.gold<2?'disabled':''}>刷新 2</button>${canBattle?'':'<button class="test-roster" data-action="test-roster">生成测试阵容</button>'}<div class="battle-select"><button data-battle="normal" ${canBattle?'':'disabled'}><b>普通战斗</b><small>基础围攻</small></button><button data-battle="encounter" ${canBattle?'':'disabled'}><b>遭遇战</b><small>高频精英</small></button><button data-battle="boss" ${canBattle?'':'disabled'}><b>Boss战</b><small>主将与援军</small></button></div></footer>${this.shopOpen?this.shop(state):''}</section>`;this.drawPortraits();this.bind(state);
  }
  renderTestCamp(state){
    const scroll=this.root.querySelector('.test-catalog-grid')?.scrollTop||0;
    const deployed=state.roster.filter(unit=>unit.slot!=='bench'),canBattle=deployed.some(unit=>unit.slot==='front');
    const selectedUnit=deployed.find(unit=>unit.slot===this.selected.slot&&unit.formationPosition===this.selected.position);
    this.root.innerHTML=`<section class="deployment test-deployment"><aside><p class="test-badge">测试环境</p><h3>羁绊谱</h3><div class="test-bonds">${evaluateSynergies(deployed).map(x=>`<div class="bond ${x.active?'active':''}" title="${x.description||''}"><b>${x.icon}</b><span>${x.name}<small>${x.count}/${x.threshold}</small><em>${x.active?x.description||'已激活':'未激活'}</em></span></div>`).join('')}</div><p class="test-owned">全武将已解锁<br>${new Set(state.roster.map(unit=>unit.heroId)).size} / ${HEROES.length} 位</p></aside><main class="test-camp-main"><section class="test-formation"><h2>上阵编队 <small>${deployed.length} / 4</small></h2><p class="test-hint">先选阵位，再点右侧武将替换。</p>${['front','back'].map(slot=>`<h3>${slot==='front'?'前军 · 场上战斗':'后军 · 技能支援'}</h3><div class="test-formation-slots">${this.testSlots(state,slot)}</div>`).join('')}<button class="test-withdraw" data-action="withdraw" ${selectedUnit?'':'disabled'}>撤下选中武将</button><button class="test-roster" data-action="test-roster">一键演出阵容</button></section><section class="test-collection"><div class="test-collection-heading"><h2>全武将名册</h2><span data-catalog-count></span></div><div class="test-filters"><input type="search" data-hero-search aria-label="搜索武将、技能或职业" placeholder="搜索姓名 / 技能 / 职业"><select data-hero-faction aria-label="筛选阵营"><option value="">全部阵营</option>${['魏','蜀','吴','群雄'].map(faction=>`<option value="${faction}">${faction}</option>`).join('')}</select></div><p class="test-target" aria-live="polite">点击武将放入：${this.selected.slot==='front'?'前军':'后军'} ${this.selected.position+1} · 无需招募</p><div class="test-catalog-grid" aria-label="已拥有的武将"></div></section></main><footer><span>第 ${state.wave+1} 战 · 至少一名前军可出战</span><div class="battle-select">${[['normal','普通战斗','基础围攻'],['encounter','遭遇战','高频精英'],['boss','Boss战','主将与援军']].map(([type,name,desc])=>`<button data-battle="${type}" ${canBattle?'':'disabled'}><b>${name}</b><small>${desc}</small></button>`).join('')}</div></footer></section>`;
    this.root.querySelector('[data-hero-search]').value=this.search;
    this.root.querySelector('[data-hero-faction]').value=this.faction;
    this.renderTestCatalog(state);
    this.root.querySelector('.test-catalog-grid').scrollTop=scroll;
    this.drawPortraits(this.root.querySelector('.test-formation'));
    this.root.querySelectorAll('[data-position]').forEach(node=>node.onclick=()=>{this.selected={slot:node.dataset.slot,position:Number(node.dataset.position)};this.render(state);});
    this.root.querySelector('[data-action=withdraw]').onclick=()=>{if(selectedUnit)this.app.deploy(state.roster.indexOf(selectedUnit),'bench');};
    this.root.querySelector('[data-action=test-roster]').onclick=()=>this.app.setupTestRoster();
    this.root.querySelectorAll('[data-battle]').forEach(node=>node.onclick=()=>this.app.startBattle({battleType:node.dataset.battle}));
    this.root.querySelector('[data-hero-search]').oninput=event=>{this.search=event.target.value;this.renderTestCatalog(state);};
    this.root.querySelector('[data-hero-faction]').onchange=event=>{this.faction=event.target.value;this.renderTestCatalog(state);};
  }
  testSlots(state,slot){
    return Array.from({length:2},(_,position)=>{
      const unit=state.roster.find(unit=>unit.slot===slot&&unit.formationPosition===position),selected=this.selected.slot===slot&&this.selected.position===position;
      const attr=`data-slot="${slot}" data-position="${position}" aria-pressed="${selected}" aria-label="选择${slot==='front'?'前军':'后军'}${position+1}${unit?'：'+unit.name:'空位'}"`;
      return `<div class="test-position ${selected?'selected':''}"><small>${slot==='front'?'前军':'后军'} ${position+1}${selected?' · 选中':''}</small>${unit?this.heroCard(unit,attr):`<button class="unit-card empty" ${attr}>点击选择阵位<br>从名册上阵</button>`}</div>`;
    }).join('');
  }
  renderTestCatalog(state){
    const query=this.search.trim().toLocaleLowerCase(),units=state.roster.filter(unit=>(!this.faction||unit.faction===this.faction)&&[unit.name,unit.heroId,unit.skill.name,unit.faction,ROLE_NAME[unit.role]||unit.role].some(text=>text.toLocaleLowerCase().includes(query)));
    const grid=this.root.querySelector('.test-catalog-grid');
    this.root.querySelector('[data-catalog-count]').textContent=`${units.length} / ${state.roster.length}`;
    grid.innerHTML=units.length?units.map(unit=>`<div class="test-catalog-item">${this.heroCard(unit,`data-select-unit="${unit.instanceId}" aria-label="上阵${unit.name}"`)}<span class="test-unit-status ${unit.slot==='bench'?'':'deployed'}">${unit.slot==='bench'?'已拥有':`${unit.slot==='front'?'前军':'后军'} ${(unit.formationPosition??0)+1}`} · ${unit.star}星</span></div>`).join(''):'<p class="test-no-match">没有匹配的武将，请更换关键词或阵营。</p>';
    this.drawPortraits(grid);
    grid.querySelectorAll('[data-select-unit]').forEach(node=>node.onclick=()=>{const index=state.roster.findIndex(unit=>unit.instanceId===node.dataset.selectUnit);this.app.deploy(index,this.selected.slot,this.selected.position);});
  }
  drawPortraits(root=this.root){for(const canvas of root.querySelectorAll('[data-portrait]')){const hero=HERO_BY_ID[canvas.dataset.portrait],ctx=canvas.getContext('2d');if(hero)drawHeroPortrait(ctx,hero,Number(canvas.dataset.star)||1);}}
  result(state){const victory=state.phase==='reward';return `<section class="battle-result ${victory?'victory':'defeat'}"><h2>${victory?'战斗胜利':'战斗失利'}</h2><p>${victory?'敌军已被击溃，可以领取军资并继续整备。':'前军已经失去战斗能力，请返回营地调整阵容。'}</p><button data-action="continue">${victory?'领取奖励并回营':'返回营地'}</button><button data-action="restart">重新开局</button></section>`;}
  bindResult(){this.root.querySelector('[data-action=continue]').onclick=()=>this.app.continueAfterBattle();this.root.querySelector('[data-action=restart]').onclick=()=>this.app.restart();}
  slots(units,count,type){const label={front:'前军',back:'后军',bench:'备战'}[type]||type;return Array.from({length:count},(_,index)=>units[index]?this.heroCard(units[index],`data-unit="${units[index].instanceId}"`):`<div class="empty">${label}空位</div>`).join('');}
  heroCard(hero,attr=''){return `<button class="unit-card hero-instance" ${attr} style="--rarity:${hero.rarityColor}">${portraitMarkup(hero,hero.star||1)}<b>${hero.name}</b><small>${hero.faction} · ${ROLE_NAME[hero.role]||hero.role}</small><span class="skill-label">${hero.skill.name}</span></button>`;}
  shop(state){return `<div class="shop-panel">${state.shop.map((id,index)=>{const hero=HERO_BY_ID[id];return hero?`<button class="shop-offer" data-buy="${index}" style="--rarity:${hero.rarityColor}">${portraitMarkup(hero)}<b>${hero.name}</b><small>${hero.faction} · ${ROLE_NAME[hero.role]||hero.role}</small><span>${hero.skill.name}</span><em>${hero.cost} 铜</em></button>`:'<div class="empty">已招募</div>';}).join('')}</div>`;}
  bind(state){
    this.root.querySelector('[data-action=shop]').onclick=event=>{event.stopPropagation();this.shopOpen=!this.shopOpen;this.render(state);};
    this.root.querySelector('[data-action=test-roster]')?.addEventListener('click',event=>{event.stopPropagation();this.app.setupTestRoster();});
    this.root.querySelector('[data-action=refresh]').onclick=()=>this.app.refresh();this.root.querySelectorAll('[data-battle]').forEach(node=>node.onclick=event=>{event.stopPropagation();this.app.startBattle({battleType:node.dataset.battle});});
    this.root.querySelectorAll('[data-buy]').forEach(node=>node.onclick=event=>{event.stopPropagation();this.app.buy(Number(node.dataset.buy));this.shopOpen=true;});
    this.root.querySelector('.shop-panel')?.addEventListener('click',event=>event.stopPropagation());
    this.root.querySelector('.deployment').onclick=()=>{if(this.shopOpen){this.shopOpen=false;this.render(state);}};
    this.root.querySelectorAll('[data-unit]').forEach(node=>node.onclick=event=>{event.stopPropagation();const index=state.roster.findIndex(x=>x.instanceId===node.dataset.unit),unit=state.roster[index];if(!unit)return;const frontCount=state.roster.filter(x=>x.slot==='front').length,backCount=state.roster.filter(x=>x.slot==='back').length,target=unit.slot==='bench'?(frontCount<2?'front':backCount<2?'back':'bench'):unit.slot==='front'?(backCount<2?'back':'bench'):'bench';this.app.deploy(index,target);});
  }
}
