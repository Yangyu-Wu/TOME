(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const $ = (s) => document.querySelector(s);
  const ui = {overlay:$('#overlay'),toast:$('#toast'),route:$('#route'),runMark:$('#run-mark')};
  const keys = new Set();
  const state = {
    phase: 'camp', run: 1, wave: 0, wavesPerRun: 3, player: null, enemies: [], projectiles: [], particles: [], pickups: [],
    keys, mouse: {x: W/2, y: H/2, down: false}, lastTime: 0, attackCd: 0, skillCd: 0, dashCd: 0, invuln: 0,
    supply: 12, forge: 0, tent: 0, memory: {style: null, confidence: 0, advice: 'unformed', scope: 'combat'}, troops:[], shopStock:null, routeChoice:null, moveTarget:null, interest:0,
    metrics: {attacks: 0, hits: 0, dodges: 0, commands: 0, adviceShown: 0, adviceAccepted: 0, damageTaken: 0},
    waveDamage: 0, enemiesKilled: 0, frame: 0, shake: 0, encounterSeed: 0, rewardChoice: null, advisorAsked: false, combatTimer: 60, difficulty: 1,
    ally: null,
    saveKey: 'yice-v0-save'
  };
  const rand = (min,max) => min + Math.random()*(max-min);
  function updateRearSkills(dt){for(const t of state.troops){if(t.slot!=='back'||t.hp<=0)continue;t.skillMax=t.skillMax||6;t.skillCd=(t.skillCd??t.skillMax)-dt;if(t.skillCd<=0){t.skillCd=t.skillMax;const targets=state.enemies.filter(e=>!e.dead);const target=targets.sort((a,b)=>a.hp-b.hp)[0];if(target){if(t.kind==='shield'){for(const f of state.troops.filter(x=>x.slot==='front'&&x.hp>0))f.hp=Math.min(f.maxHp,f.hp+Math.round(t.damage*.7));burst(t.x+35,t.y,'#8fcf9a',12);}else{hitEnemy(target,Math.round(t.damage*.9),0,0);burst(target.x,target.y,t.kind==='archer'?'#7db3c6':'#d1a15f',12);}toast(`${t.name} · ${t.skill||'军阵支援'}`);}}}}
  function updateFrontTroops(dt){for(const t of state.troops){if(t.slot!=='front'||t.hp<=0)continue;t.attackCd=Math.max(0,t.attackCd-dt);t.hitFlash=Math.max(0,t.hitFlash-dt);const target=state.enemies.filter(e=>!e.dead).sort((a,b)=>dist(t,a)-dist(t,b))[0];if(!target)continue;const d=dist(t,target),range=t.kind==='archer'?145:target.r+t.r+20;if(d>range){t.moveX=(target.x-t.x)/d;t.moveY=(target.y-t.y)/d;t.x+=t.moveX*(t.kind==='archer'?75:105)*dt;t.y+=t.moveY*(t.kind==='archer'?75:105)*dt;t.walk+=dt*10;}else if(t.attackCd<=0){t.attackCd=t.kind==='archer'?1.15:.85;hitEnemy(target,t.damage,t.moveX||1,t.moveY||0);if(target.hp<=0)killEnemy(target);}resolveObstacles(t);}}
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const obstacles=[
    {x:118,y:310,r:25,type:'rock'},{x:842,y:326,r:27,type:'rock'},
    {x:315,y:165,r:31,type:'barricade'},{x:658,y:435,r:31,type:'barricade'},
    {x:640,y:165,r:36,type:'cart'},{x:330,y:442,r:34,type:'cart'}
  ];
  function resolveObstacles(o){for(const q of obstacles){const dx=o.x-q.x,dy=o.y-q.y,d=Math.hypot(dx,dy),min=(o.r||12)+q.r;if(d<min){const n=d||1;o.x=q.x+dx/n*min;o.y=q.y+dy/n*min;}}o.x=clamp(o.x,35,W-35);o.y=clamp(o.y,58,H-28);}

  function log(text) { state.lastEvent=text; }
  let toastTimer;
  function toast(text) { ui.toast.textContent=text; ui.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1900); }
  function persist() {
    try { localStorage.setItem(state.saveKey, JSON.stringify({supply:state.supply,forge:state.forge,tent:state.tent,memory:state.memory,run:state.run})); } catch (_) {}
  }
  function restore() {
    try {
      const s=JSON.parse(localStorage.getItem(state.saveKey)||'null'); if (!s) return;
      state.supply=Number(s.supply)||0; state.forge=clamp(Number(s.forge)||0,0,2); state.tent=clamp(Number(s.tent)||0,0,2);
      state.memory=s.memory||state.memory; state.run=Math.max(1,Number(s.run)||1);
    } catch (_) {}
  }
  function updateUI() {
    ui.runMark.textContent=`第 ${state.run} 回`;
    ui.route.querySelectorAll('i').forEach(n=>{const w=Number(n.dataset.wave);n.className=w<state.wave?'done':w===state.wave&&state.phase!=='camp'?'current':'';});
  }
  function memoryScopeText(){return state.memory.scope==='combat'?'战斗建议':state.memory.scope==='archer'?'远程威胁':'尚待确认'}
  function enterCamp() {
    state.phase='camp';state.wave=0;state.enemies=[];state.projectiles=[];state.player=null;updateUI();showCampChoices();
  }
  function showModal(kicker,title,body,buttons,note='') {
    ui.overlay.classList.remove('hidden'); ui.overlay.innerHTML=`<div class="modal"><div class="kicker">${kicker}</div><h2>${title}</h2>${body}<div class="actions"></div>${note?`<div class="small-note">${note}</div>`:''}</div>`;
    const actions=ui.overlay.querySelector('.actions'); buttons.forEach(b=>{const el=document.createElement('button');el.textContent=b.label;if(b.secondary)el.className='secondary';el.onclick=()=>{ui.overlay.classList.add('hidden');b.action?.()};actions.append(el)});
  }
  function showIconModal(kicker,title,items,note='') {
    ui.overlay.classList.remove('hidden');ui.overlay.innerHTML=`<div class="modal"><div class="kicker">${kicker}</div><h2>${title}</h2><div class="actions icon-actions"></div>${note?`<div class="small-note">${note}</div>`:''}</div>`;
    const actions=ui.overlay.querySelector('.actions');items.forEach(item=>{const el=document.createElement('button');el.disabled=!!item.disabled;el.innerHTML=`${item.cost?`<span class="cost">${item.cost}</span>`:''}<span class="reward-icon">${item.icon}</span><span class="reward-name">${item.name}</span><span class="reward-desc">${item.desc||''}</span>`;el.onclick=()=>{if(item.keepOpen){item.action?.();showShop(state.phase==='camp');}else{ui.overlay.classList.add('hidden');item.action?.();}};actions.append(el);});
  }
  function showCampChoices(){
    showShop(true);
  }
  const troopTypes={shield:{name:'刀盾',icon:'盾',cost:3,hp:60,damage:7,color:'#81534a'},spear:{name:'枪将',icon:'枪',cost:4,hp:42,damage:11,color:'#78805d'},archer:{name:'弓将',icon:'弓',cost:4,hp:34,damage:8,color:'#9c7448'}};
  const heroes=[
    {id:'guanyu',name:'关羽',title:'武圣 · 美髯公',faction:'蜀',style:'#8e342c',mark:'忠',kind:'spear',cost:5,hp:105,damage:17,skill:'青龙偃月：近战重击'},
    {id:'zhangfei',name:'张飞',title:'猛将 · 万人敌',faction:'蜀',style:'#54312e',mark:'勇',kind:'shield',cost:4,hp:125,damage:15,skill:'当阳怒吼：承伤更强'},
    {id:'zhaoyun',name:'赵云',title:'常胜将军',faction:'蜀',style:'#526b78',mark:'龙',kind:'spear',cost:5,hp:90,damage:19,skill:'七进七出：迅捷突击'},
    {id:'zhugeliang',name:'诸葛亮',title:'卧龙 · 军师',faction:'蜀',style:'#607b69',mark:'策',kind:'archer',cost:6,hp:75,damage:20,skill:'八阵图：远程策应'},
    {id:'machao',name:'马超',title:'锦马超 · 西凉',faction:'蜀',style:'#9a793f',mark:'锦',kind:'spear',cost:5,hp:95,damage:18,skill:'铁骑冲锋：高速突进'},
    {id:'huangzhong',name:'黄忠',title:'老将 · 百步穿杨',faction:'蜀',style:'#8d6340',mark:'弓',kind:'archer',cost:4,hp:78,damage:17,skill:'百步穿杨：远程压制'},
    {id:'zhouyu',name:'周瑜',title:'美周郎 · 都督',faction:'吴',style:'#705145',mark:'火',kind:'archer',cost:5,hp:82,damage:19,skill:'火攻：远程灼击'},
    {id:'lvbu',name:'吕布',title:'飞将 · 天下无双',faction:'群雄',style:'#783d3a',mark:'无双',kind:'spear',cost:7,hp:130,damage:24,skill:'方天画戟：强力突击'},
    {id:'sunshangxiang',name:'孙尚香',title:'弓腰姬 · 吴郡',faction:'吴',style:'#805b7d',mark:'姬',kind:'archer',cost:4,hp:76,damage:16,skill:'灵弓：远程支援'},
    {id:'diaochan',name:'貂蝉',title:'倾城 · 连环计',faction:'群雄',style:'#90657b',mark:'舞',kind:'archer',cost:5,hp:78,damage:18,skill:'离间：扰乱敌阵'}
    ,{id:'caocao',name:'曹操',title:'魏武 · 枭雄',faction:'魏',style:'#334766',mark:'魏',kind:'shield',cost:6,hp:112,damage:18,skill:'唯才是举：全军增益'}
    ,{id:'xiahoudun',name:'夏侯惇',title:'独眼 · 虎将',faction:'魏',style:'#4e5e72',mark:'惇',kind:'shield',cost:4,hp:118,damage:14,skill:'拔矢啖睛：坚守反击'}
    ,{id:'simayi',name:'司马懿',title:'冢虎 · 晋基',faction:'魏',style:'#4a536c',mark:'懿',kind:'archer',cost:6,hp:84,damage:21,skill:'鹰视狼顾：谋略压制'}
    ,{id:'sunquan',name:'孙权',title:'吴王 · 仲谋',faction:'吴',style:'#426b66',mark:'吴',kind:'shield',cost:5,hp:102,damage:16,skill:'制衡：稳固阵线'}
    ,{id:'pangtong',name:'庞统',title:'凤雏 · 军师',faction:'蜀',style:'#6c644d',mark:'凤',kind:'archer',cost:5,hp:76,damage:19,skill:'连环计：牵制敌军'}
  ];
  function rollShop(){const pool=[...heroes];state.shopStock=[];while(state.shopStock.length<5&&pool.length){const i=Math.floor(Math.random()*pool.length);state.shopStock.push({...pool.splice(i,1)[0]});}}
  function synergyData(){const list=state.troops.map(t=>t.id);const count=(name)=>list.filter(id=>heroes.find(h=>h.id===id)?.faction===name).length;const has=(ids)=>ids.every(id=>list.includes(id));const tigers=['guanyu','zhangfei','zhaoyun','machao','huangzhong'].filter(id=>list.includes(id)).length;return [{icon:'魏',name:'魏之铁壁',need:`魏将 ${count('魏')}/2`,active:count('魏')>=2},{icon:'蜀',name:'蜀汉同心',need:`蜀将 ${count('蜀')}/3`,active:count('蜀')>=3},{icon:'吴',name:'江东水师',need:`吴将 ${count('吴')}/2`,active:count('吴')>=2},{icon:'五',name:'五虎上将',need:`关张赵马黄 ${tigers}/3`,active:tigers>=3},{icon:'君',name:'君主羁绊',need:`君主 ${['caocao','sunquan','liubei'].filter(id=>list.includes(id)).length}/1`,active:has(['caocao'])||has(['sunquan'])||has(['liubei'])},{icon:'卧',name:'卧龙凤雏',need:`诸葛亮/庞统 ${['zhugeliang','pangtong'].filter(id=>list.includes(id)).length}/2`,active:has(['zhugeliang','pangtong'])},{icon:'月',name:'闭月羞花',need:'貂蝉/孙尚香 0/2',active:has(['diaochan','sunshangxiang'])}];}
  function showShop(first=false){const interest=Math.min(5,Math.floor(state.supply/10));state.interest=interest;if(!state.shopStock)rollShop();const front=state.troops.filter(t=>t.slot==='front'),back=state.troops.filter(t=>t.slot==='back'),bench=state.troops.filter(t=>t.slot==='bench');
    const heroCard=(h,i,owned=false)=>`<button class="hero-card ${owned?'owned-card':''}" data-bond="${h.faction} · ${h.kind==='shield'?'护军':h.kind==='archer'?'谋射':'猛将'}" data-${owned?'troop':'offer'}="${owned?state.troops.indexOf(h):i}" ${!owned&&state.supply<h.cost?'disabled':''}><span class="hero-portrait" style="--portrait:${h.style}"><i>${h.mark}</i></span><span class="hero-name">${h.name}</span><span class="hero-title">${h.title}</span>${owned?`<span class="hero-role">${h.slot==='front'?'前排':h.slot==='back'?'后排':'备战'}</span>`:`<span class="hero-skill">${h.skill}</span><span class="hero-cost">铜 ${h.cost}</span>`}</button>`;
    const empty=(key)=>`<button class="unit-slot empty-slot" data-slot="${key}"><span>＋</span><small>空位</small></button>`;
    ui.overlay.classList.remove('hidden');ui.overlay.innerHTML=`<section class="war-camp strict-camp"><header class="camp-head"><div><small>汉末行军 · 第 ${Math.max(1,state.wave||1)} / ${state.wavesPerRun} 阵</small><h2>${first?'整军待发':'休战 · 军帐整备'}</h2></div><div class="route-strip"><b>营寨</b><i>⚔</i><b>山道</b><i>?</i><b>关隘</b><i>♜</i><b>洛阳</b></div><div class="camp-resources"><span>🪙 ${state.supply}</span><span>利息 +${interest}</span></div></header>
      <div class="camp-body"><aside class="synergy-rail"><div class="rail-title">羁绊谱</div>${synergyData().map(s=>`<div class="synergy ${s.active?'active':''}"><strong>${s.icon}</strong><span>${s.name}<small>${s.need}</small></span></div>`).join('')}<button class="shop-tab">☰<small>商店</small></button></aside>
      <main class="formation-main"><div class="formation-title">前军阵 · 四席出阵 <small>前军随统领出战，最多 2 名</small></div><div class="formation-grid front-grid">${front.map(h=>heroCard(h,0,true)).join('')}${Array.from({length:2-front.length},(_,i)=>empty(`front-${i}`)).join('')}</div><div class="formation-title rear-title">后军阵 · 技能支援 <small>后军不入场，按冷却释放技能，最多 2 名</small></div><div class="formation-grid rear-grid">${back.map(h=>heroCard(h,0,true)).join('')}${Array.from({length:2-back.length},(_,i)=>empty(`back-${i}`)).join('')}</div><div class="bench-title">备战席 <small>九格 · 未上阵武将留守中军</small></div><div class="bench-grid">${Array.from({length:9},(_,i)=>bench[i]?heroCard(bench[i],0,true):empty(`bench-${i}`)).join('')}</div></main></div>
      <footer class="camp-footer strict-footer"><div class="bench-summary">在册武将 <b>${state.troops.length}</b> · 出阵 <b>${front.length+back.length}/4</b></div><button class="refresh-btn">⟳ 刷新 <b>铜 2</b></button><button class="march-btn">${first?'行军路线 · 出征':state.wave>=state.wavesPerRun?'凯旋回营':'行军路线 · 下一阵'} <span>➜</span></button></footer><aside class="shop-drawer"><div class="drawer-head">酒馆招贤 <button class="close-shop">×</button></div><small>本轮名将 · 点击卡片招募至备战席</small><div class="drawer-list">${state.shopStock.map((h,i)=>h?heroCard(h,i):'<div class="shop-empty"><span>已招募</span><small>等待刷新</small></div>').join('')}</div></aside></section>`;
    ui.overlay.querySelector('.shop-tab').onclick=()=>ui.overlay.querySelector('.shop-drawer').classList.toggle('open');
    ui.overlay.querySelector('.close-shop').onclick=()=>ui.overlay.querySelector('.shop-drawer').classList.remove('open');
    ui.overlay.querySelectorAll('[data-offer]').forEach(el=>el.onclick=()=>buyTroop(Number(el.dataset.offer)));
    ui.overlay.querySelectorAll('[data-troop]').forEach(el=>el.onclick=()=>cycleTroop(Number(el.dataset.troop)));
    ui.overlay.querySelector('.refresh-btn').onclick=()=>{if(state.supply<2)return;state.supply-=2;rollShop();showShop(first);persist();};
    ui.overlay.querySelector('.march-btn').onclick=()=>first?showRoute(true):state.wave>=state.wavesPerRun?finishRun():showRoute(false);
    ui.overlay.querySelector('.strict-camp').onclick=e=>{const drawer=ui.overlay.querySelector('.shop-drawer');if(drawer.classList.contains('open')&&!e.target.closest('.shop-drawer')&&!e.target.closest('.shop-tab'))drawer.classList.remove('open');};
  }
  function slotCards(list,slot,render){return list.length?list.map(h=>render(h,0,true)).join(''):`<div class="empty-slot">空阵位 · 从备战席点击武将部署</div>`;}
  function cycleTroop(index){const t=state.troops[index];if(!t)return;const front=state.troops.filter(x=>x.slot==='front').length,back=state.troops.filter(x=>x.slot==='back').length;if(t.slot==='bench')t.slot=front<2?'front':back<2?'back':'bench';else if(t.slot==='front')t.slot=back<2?'back':'bench';else t.slot='bench';showShop(state.phase==='camp');}
  function buyTroop(index){const offer=state.shopStock[index];if(!offer||state.supply<offer.cost)return;state.supply-=offer.cost;const stats=troopTypes[offer.kind];state.troops.push({...offer,slot:'bench',x:W/2,y:H/2+145,r:12,hp:offer.hp,maxHp:offer.hp,damage:offer.damage,color:stats.color,attackCd:rand(0,.7),walk:0,moveX:0,moveY:0,hitFlash:0,knockX:0,knockY:0});state.shopStock[index]=null;toast(`${offer.name}入列备战`);showShop(state.phase==='camp');ui.overlay.querySelector('.shop-drawer')?.classList.add('open');persist();}
  function showRoute(first=false){const routes=[{kind:'battle',icon:'⚔',name:'山道遭遇',desc:'普通战 · 稳定军需'},{kind:'elite',icon:'♜',name:'精锐伏兵',desc:'精英战 · 高风险高回报'},{kind:'camp',icon:'⛺',name:'废营休整',desc:'恢复统领与部曲'}];showIconModal('行军图 · 选择下一站',`第 ${Math.min(state.wave+1,3)} 阵前方有数条道路`,routes.map(r=>({icon:r.icon,name:r.name,desc:r.desc,action:()=>{state.routeChoice=r.kind;if(r.kind==='camp'){if(state.player)state.player.hp=Math.min(state.player.maxHp,state.player.hp+25);state.troops.forEach(t=>t.hp=t.maxHp);}if(first)startRun();else advanceWave();}})),'分岔路线会影响遭遇强度与整备机会；最终一阵为首领战。');}
  function showHelp() {
    showModal('操练须知','鼠标即军令',`<p>点击战场：统领向目标行军；鼠标位置决定面向与自动攻击方向。<kbd>Shift</kbd>闪避，<kbd>空格</kbd>战技，<kbd>Q</kbd>军令压制，<kbd>F</kbd>命令裴烈集火。</p><p>每场战斗结束后获得金币和利息，在商店招募刀盾兵、长枪兵、弓兵或强化统领，再进入下一场。</p>`,[{label:'明白了',primary:true,action:()=>{if(state.phase==='camp')enterCamp()}}]);
  }
  function startRun() {
    state.phase='fight';state.wave=1;state.player=null;state.nextCommand=false;state.moveTarget=null;
    state.ally=null;
    state.metrics={attacks:0,hits:0,dodges:0,commands:0,adviceShown:0,adviceAccepted:0,damageTaken:0};state.waveDamage=0;state.enemiesKilled=0;state.advisorAsked=false;state.encounterSeed++;state.combatTimer=60;state.difficulty=Math.min(5,Math.max(1,state.wave+(state.routeChoice==='elite'?2:0)));
    state.troops.filter(t=>t.slot==='front').forEach((t,i,a)=>{t.x=W/2-(a.length-1)*38+i*76;t.y=H-118;t.hp=t.maxHp;t.hitFlash=0;t.attackCd=rand(0,.5);});state.troops.filter(t=>t.slot==='back').forEach((t,i)=>{t.x=72;t.y=130+i*105;t.hp=t.maxHp;t.skillCd=rand(2,5);t.skillMax=6;});log(`第 ${state.run} 次自动战斗开始。`);spawnWave();state.routeChoice=null;updateUI();
  }
  function spawnWave() {
    state.enemies=[];state.projectiles=[];state.waveDamage=0;state.advisorAsked=false;
    let kinds=state.wave===1?['shield','spear','shield']:state.wave===2?['archer','shield','spear','archer']:['spear','archer','elite'];const extra=Math.max(0,state.difficulty-1);for(let i=0;i<extra;i++)kinds.push(i%2?'shield':'spear');if(state.routeChoice==='elite'&&state.wave<3)kinds=[...kinds,'elite'];
    const points=[[170,170],[790,160],[200,420],[760,420],[480,120],[480,440]];
    kinds.forEach((kind,i)=>{const [x,y]=points[(i+(state.wave===2?1:0))%points.length];state.enemies.push(makeEnemy(kind,x+rand(-25,25),y+rand(-20,20)))});if(state.difficulty>=3&&Math.random()<.35)state.enemies.push(makeEnemy('hero',480+rand(-120,120),130+rand(-30,80)));
    updateUI();log(`遭遇第 ${state.wave} 阵：${kinds.length} 名敌军。`);
    // 纯自走棋模式不再触发针对玩家操作的战斗建议弹窗。
  }
  function makeEnemy(kind,x,y) {
    const conf={shield:{name:'刀盾兵',hp:48,speed:48,r:16,color:'#7b5546',damage:9},spear:{name:'长枪兵',hp:38,speed:58,r:14,color:'#78805d',damage:11},archer:{name:'弓手',hp:28,speed:35,r:13,color:'#9c7448',damage:8},elite:{name:'校尉',hp:125,speed:60,r:22,color:'#a64e3d',damage:15},hero:{name:'敌方名将',hp:180,speed:54,r:24,color:'#6d3b42',damage:19}}[kind];const mult=1+(state.difficulty-1)*.18;return {kind,x,y,...conf,hp:Math.round(conf.hp*mult),maxHp:Math.round(conf.hp*mult),damage:Math.round(conf.damage*mult),attackCd:rand(.4,1.4),windup:0,flash:0,slow:0,dead:false,aim:null,walk:rand(0,6),moveX:0,moveY:0,hitFlash:0,knockX:0,knockY:0};
  }
  function maybeAdvice() {
    if(state.phase!=='fight'||state.wave!==2||state.advisorAsked) return;
    const archers=state.enemies.filter(e=>e.kind==='archer'&&!e.dead); if(!archers.length)return;
    const danger=state.player.hp<70||state.metrics.damageTaken>=1;
    if(!danger && state.memory.confidence<.6) return;
    state.advisorAsked=true;state.metrics.adviceShown++;
    const memoryValid=state.memory.style&&state.memory.confidence>=.55;
    const relevant=state.memory.scope==='archer'||state.memory.scope==='combat';
    if(memoryValid&&relevant&&state.memory.advice==='abstain') {state.companionLine='我记得你希望战斗中保持安静。我只观察局势，不主动提醒。';return;}
    if(memoryValid&&relevant&&state.memory.advice==='observe'&&!danger) {state.companionLine='我记得你希望我先观察。我继续看弓手的行动，不急着献策。';return;}
    if(memoryValid&&relevant&&state.memory.advice==='act') {
      state.companionLine='两名弓手已拉弓。你此前允许我在远程威胁出现时提醒；我不替你消耗军令。';
      showModal('军情急报 · 依据旧记忆','后排弓手正在瞄准',`<p>军师根据你此前关于“远程威胁提醒”的偏好主动献策。要不要由你下令压制弓手？</p><div class="memory-quote">依据：${state.memory.style}；当前证据：弓手存活 ${archers.length} 名${danger?'，且你近期已受伤':''}。本次只提醒，不自动消耗军令。</div>`,[
        {label:'采纳：压制弓手',primary:true,action:()=>{state.metrics.adviceAccepted++;issueCommand(true)}},
        {label:'不用，我自己处理',secondary:true,action:()=>{state.memory.confidence=Math.max(.35,state.memory.confidence-.08);log('你谢绝了这次提醒，军师记下这是一次情境反馈。','warn');state.companionLine='明白，我不替你下令。你处理你的战局。';persist();updateUI()}},
        {label:'以后战斗中先别提醒',secondary:true,action:()=>{state.memory.advice='abstain';state.memory.confidence=.8;log('军师将战斗中主动提醒设为暂不介入。','warn');state.companionLine='记下了。以后我会等你在营地询问。';persist();updateUI()}}
      ]);
    } else if(danger) {
      state.companionLine='我记得你不喜欢被战斗提示打断，但你现在正承受弓手压力……';
      showModal('军情未明 · 先问再动','要我提醒远程威胁吗？',`<p>你当前生命 ${Math.ceil(state.player.hp)}，场上有 ${archers.length} 名弓手。但我还不能确定你现在是否愿意在战斗中听建议。</p><div class="memory-quote">我有“偏好自行处理”的旧记录，却没有证据证明它适用于这次高压战况。</div>`,[
        {label:'这次提醒我',primary:true,action:()=>{state.memory.style='高压战况下接受远程威胁提醒';state.memory.scope='archer';state.memory.advice='act';state.memory.confidence=.7;log('军师记下：高压战况下可提醒远程威胁。','good');state.companionLine='收到。我只标出威胁，不替你消耗军令。';persist();updateUI();toast('军师标出了后排弓手');}},
        {label:'先观察，不要替我决定',secondary:true,action:()=>{state.memory.style='高压战况下先观察再建议';state.memory.scope='archer';state.memory.advice='observe';state.memory.confidence=.62;log('军师暂不下判断，继续观察你的应对。');state.companionLine='好，我再看一阵。';persist();updateUI()}},
        {label:'战斗中不要提醒',secondary:true,action:()=>{state.memory.style='战斗中偏好不被打断';state.memory.scope='combat';state.memory.advice='abstain';state.memory.confidence=.8;log('军师记下：战斗中保持安静。','warn');state.companionLine='明白，战斗中我保持安静。';persist();updateUI()}}
      ]);
    } else {
      state.companionLine='弓手在后排，但旧记忆不一定适用于此刻。我先不贸然插话。';log('军师观察到远程威胁，但证据不足，选择暂不介入。');
    }
  }
  function issueCommand(fromAdvice=false) {
    const p=state.player;if(!p||p.commands<=0)return;
    p.commands--;state.metrics.commands++;const target=state.enemies.filter(e=>e.kind==='archer'&&!e.dead).sort((a,b)=>dist(p,a)-dist(p,b))[0]||state.enemies.filter(e=>!e.dead).sort((a,b)=>dist(p,a)-dist(p,b))[0];
    if(target){target.hp-=30+(state.player.commandBonus||0);target.flash=.3;target.slow=1.2;target.windup=0;burst(target.x,target.y,'#d7bd79',14);if(target.hp<=0)killEnemy(target);log(fromAdvice?'你采纳军师建议，军令压制了敌军。':'军令压制敌军，打断其攻势。','good');toast('军令：压制');}
    updateUI();
  }
  function allyFocus(){if(state.phase!=='fight')return;const t=state.enemies.filter(e=>!e.dead).sort((x,y)=>dist(state.player,x)-dist(state.player,y))[0];if(!t)return;state.troops.filter(u=>u.slot==='front').forEach(u=>u.commandTarget=t);log(`你下令前军集火${t.name}。`,'good');toast('前军集火');}
  function forgeUpgrade(){if(state.supply<8||state.forge>=2)return;state.supply-=8;state.forge++;log(`铁匠棚升至 Lv.${state.forge}，武器伤害提升。`,'good');persist();updateUI();}
  function tentUpgrade(){if(state.supply<8||state.tent>=2)return;state.supply-=8;state.tent++;log(`军师帐升至 Lv.${state.tent}，每次出征多一条军令。`,'good');persist();updateUI();}
  function attack() {
    const p=state.player;if(!p||state.phase!=='fight'||state.attackCd>0)return;
    state.attackCd=.28;p.attackAnim=.22;p.combo=(p.combo+1)%3;state.metrics.attacks++;burst(p.x+p.faceX*22,p.y+p.faceY*22,'#c5a766',3);
    const range=63,angle=Math.atan2(p.faceY,p.faceX);
    for(const e of state.enemies){if(e.dead)continue;const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy),da=Math.atan2(dy,dx);let diff=Math.atan2(Math.sin(da-angle),Math.cos(da-angle));if(d<range+e.r&&Math.abs(diff)<.9){const dmg=12+state.forge*3+(p.runDamage||0)+(p.combo===2?3:0);hitEnemy(e,dmg,p.faceX,p.faceY);state.metrics.hits++;p.rage=clamp(p.rage+7,0,100);if(e.kind==='shield'&&Math.abs(diff)<.55)e.hp+=dmg*.35;if(e.hp<=0)killEnemy(e);}}
    updateUI();
  }
  function hitEnemy(e,damage,kx=0,ky=0){e.hp-=damage;e.flash=.18;e.hitFlash=.2;e.slow=.12;e.knockX=kx*55;e.knockY=ky*55;burst(e.x,e.y,'#dfc17b',7);}
  function skill() {
    const p=state.player;if(!p||state.phase!=='fight'||p.rage<35||state.skillCd>0)return;
    p.rage-=35;p.skillAnim=.3;state.skillCd=.3;state.shake=8;let hit=0;
    for(const e of state.enemies){if(e.dead)continue;const d=dist(p,e);if(d<112+(p.skillBonus?18:0)){const dx=e.x-p.x,dy=e.y-p.y,len=Math.max(1,Math.hypot(dx,dy));hitEnemy(e,28+state.forge*5+(p.skillBonus||0),dx/len,dy/len);e.slow=.65;e.x+=dx/len*32;e.y+=dy/len*32;hit++;if(e.hp<=0)killEnemy(e);}}
    burst(p.x,p.y,'#d3ad67',27);log(`战技横扫命中 ${hit} 名敌军。`,hit?'good':'');if(hit)toast(`破阵横扫 · 命中 ${hit}`);updateUI();
  }
  function dash() {
    const p=state.player;if(!p||state.phase!=='fight'||state.dashCd>0)return;const dx=state.mouse.x-p.x,dy=state.mouse.y-p.y,len=Math.hypot(dx,dy)||1;p.x+=dx/len*88;p.y+=dy/len*88;resolveObstacles(p);state.dashCd=.85;state.invuln=.28;state.metrics.dodges++;burst(p.x,p.y,'#c3b589',6);}
  function killEnemy(e){if(e.dead)return;e.dead=true;state.enemiesKilled++;burst(e.x,e.y,e.color,12);state.shake=Math.max(state.shake,3);}
  function burst(x,y,color,count){for(let i=0;i<count;i++){const a=rand(0,Math.PI*2),s=rand(35,180);state.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.18,.55),max:.55,color,r:rand(1.5,4)})}}
  function damagePlayer(amount,source){const p=state.player;if(state.invuln>0||!p)return;p.hp-=amount;p.hitFlash=.24;p.knockX=(p.x<state.mouse.x?-1:1)*35;p.knockY=0;state.metrics.damageTaken++;state.waveDamage++;state.invuln=.55;state.shake=6;burst(p.x,p.y,'#b94739',12);burst(p.x,p.y+14,'#8b704c',5);toast(`-${amount}`);log(`${source}击中你，损失 ${amount} 点生命。`,'warn');if(p.hp<=0)runFailed();updateUI();}
  function damageAlly(amount,source){const target=state.troops.find(t=>t.slot==='front'&&t.hp>0);if(!target)return;target.hp-=amount;target.hitFlash=.24;target.knockX=-28;target.knockY=0;burst(target.x,target.y,'#aab786',10);toast(`${target.name} -${amount}`);log(`${source}击中前军${target.name}，损失 ${amount} 点战意。`,'warn');updateUI();}
  function runFailed(){state.phase='settle';const gained=Math.max(2,Math.floor(state.supply*.35));state.supply=gained;persist();updateUI();showModal('撤回山寨 · 整军再战','此番失利，军情仍有所得',`<p>小队带回 ${gained} 军需。失败没有抹去你的战斗记录；军师会把这次经历作为新证据，而非给你贴上“不会战斗”的标签。</p><div class="memory-quote">战报：出手 ${state.metrics.attacks} 次，命中 ${state.metrics.hits} 次，闪避 ${state.metrics.dodges} 次，承受伤害 ${state.metrics.damageTaken} 次。</div>`,[{label:'回到营地',primary:true,action:()=>{state.run++;persist();enterCamp()}}]);log('队伍撤回营地，保留部分军需。','warn');}
  function waveCleared(){if(state.phase!=='fight')return;state.phase='reward';const base=5+state.wave*2+(state.routeChoice==='elite'?3:0);const interest=Math.min(5,Math.floor(state.supply/10));state.supply+=base+interest;state.interest=interest;state.shopStock=null;updateUI();log(`第 ${state.wave} 阵肃清，收入 ${base} 金，利息 ${interest} 金。`,'good');showShop(false);}
  function showReward(opts){showIconModal(`第 ${state.wave} 阵`,'择一战利品',opts.map(o=>({icon:o.icon,name:o.name,desc:o.desc,action:()=>{o.effect();log(`战后选择：${o.name}。`,'good');if(state.wave>=state.wavesPerRun)finishRun();else if(state.wave===1&&!state.memory.style){askInitialMemory(()=>advanceWave());}else{advanceWave();}}})),'点击图标即选');}
  function advanceWave(){state.wave++;state.phase='fight';state.combatTimer=60;state.difficulty=Math.min(5,Math.max(1,state.wave+(state.routeChoice==='elite'?2:0)));state.troops.filter(t=>t.slot==='front').forEach((t,i,a)=>{t.x=W/2-(a.length-1)*38+i*76;t.y=H-118;t.hp=t.maxHp;t.attackCd=rand(0,.5);});state.troops.filter(t=>t.slot==='back').forEach((t,i)=>{t.x=72;t.y=130+i*105;t.hp=t.maxHp;t.skillCd=rand(2,5);t.skillMax=6;});state.shopStock=null;updateUI();spawnWave();state.routeChoice=null;}
  function askInitialMemory(done){const m=state.metrics;const observation=m.hits>=3?'你在第一阵主动贴近敌人，连续挥刀。':m.dodges>=2?'你在第一阵多次闪避，谨慎寻找时机。':'第一阵很短，我还看不出稳定的战斗习惯。';
    state.companionLine='我看见你刚才的打法了，但不想只凭一阵就替你下结论。';
    showModal('战后复盘 · 建立第一条记忆','刚才的打法，适用于下一阵吗？',`<p>徐砚说：“${observation}下一阵会出现弓手。我可以在远程威胁造成压力时提醒，但不会替你消耗军令。”</p><div class="memory-quote">这是一次偏好确认，不是性格定论；你之后随时可以修正。</div>`,[
      {label:'弓手造成压力时提醒我',primary:true,action:()=>{state.memory={style:'高压战况下接受远程威胁提醒',confidence:.64,advice:'act',scope:'archer'};log('形成暂定记忆：高压远程威胁下可提醒。','good');persist();updateUI();done()}},
      {label:'这次先问我，再给建议',secondary:true,action:()=>{state.memory={style:'战术建议先询问',confidence:.66,advice:'ask',scope:'archer'};log('形成暂定记忆：高压战术建议先询问。');persist();updateUI();done()}},
      {label:'只看了一阵，先别记成偏好',secondary:true,action:()=>{state.memory={style:null,confidence:.2,advice:'observe',scope:'combat'};log('军师选择继续观察，没有把单次行为写成稳定偏好。');updateUI();done()}}
    ]);
  }
  function finishRun(){state.phase='settle';const earned=10+Math.floor(state.enemiesKilled/2)+(state.nextCommand?5:0);state.supply+=earned;state.nextCommand=false;const p=state.player;const report=`本局击杀 ${state.enemiesKilled} 名敌军，出手 ${state.metrics.attacks} 次、命中 ${state.metrics.hits} 次、闪避 ${state.metrics.dodges} 次，承受伤害 ${state.metrics.damageTaken} 次。`;log(`任务完成，带回 ${earned} 军需。`,'good');
    showModal('军情已达 · 凯旋归营','断桥前哨已肃清',`<p>${report}</p><div class="memory-quote">${state.memory.style?`军师复盘：“我仍记得${state.memory.style}。这次的战况是否证明它适用？我会结合场景再判断。”`:'军师复盘：“我记录了你的出手、闪避与受伤情况，但一局还不足以断定你的战斗习惯。”'}</div>`,[{label:'回营整备',primary:true,action:()=>{state.run++;persist();enterCamp()}}], '军需可用于营地升级；战斗记录只在本机保存。');
    persist();updateUI();
  }
  function autoBattleUpdate(dt){state.frame++;if(state.phase!=='fight'||!ui.overlay.classList.contains('hidden'))return;state.combatTimer=Math.max(0,state.combatTimer-dt);if(state.combatTimer<=0){waveCleared();return;}updateFrontTroops(dt);updateRearSkills(dt);const living=state.troops.filter(t=>t.slot==='front'&&t.hp>0);for(const e of state.enemies){if(e.dead)continue;e.hitFlash=Math.max(0,e.hitFlash-dt);e.attackCd-=dt;const target=living.sort((a,b)=>dist(e,a)-dist(e,b))[0];if(!target){runFailed();return;}const d=dist(e,target);if(e.kind==='archer'&&d<250){if(e.attackCd<=0){target.hp-=e.damage;e.attackCd=1.5;target.hitFlash=.25;burst(target.x,target.y,'#b94739',8);}}else if(d>e.r+target.r+15){e.moveX=(target.x-e.x)/d;e.moveY=(target.y-e.y)/d;e.x+=e.moveX*e.speed*dt;e.y+=e.moveY*e.speed*dt;e.walk+=dt*9;}else if(e.attackCd<=0){target.hp-=e.damage;e.attackCd=e.kind==='hero'?.8:1.25;target.hitFlash=.25;burst(target.x,target.y,'#b94739',8);}resolveObstacles(e);}for(const q of state.particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.94;q.vy*=.94;q.life-=dt;}state.particles=state.particles.filter(q=>q.life>0);if(state.enemies.length&&state.enemies.every(e=>e.dead))waveCleared();}
  function update(dt){autoBattleUpdate(dt);return;
    state.attackCd=Math.max(0,state.attackCd-dt);state.skillCd=Math.max(0,state.skillCd-dt);state.dashCd=Math.max(0,state.dashCd-dt);state.invuln=Math.max(0,state.invuln-dt);p.attackAnim=Math.max(0,p.attackAnim-dt);p.skillAnim=Math.max(0,p.skillAnim-dt);p.hitFlash=Math.max(0,p.hitFlash-dt);p.x+=p.knockX*dt;p.y+=p.knockY*dt;p.knockX*=.82;p.knockY*=.82;resolveObstacles(p);
    const tx=state.moveTarget?.x||p.x,ty=state.moveTarget?.y||p.y,td=Math.hypot(tx-p.x,ty-p.y);let mx=td>12?(tx-p.x)/td:0,my=td>12?(ty-p.y)/td:0;let len=Math.hypot(mx,my);p.moveX=mx;p.moveY=my;if(len){p.walk+=dt*12;p.x+=mx*225*dt;p.y+=my*225*dt;resolveObstacles(p);if(state.frame%5===0){const q=state.particles.length;burst(p.x,p.y+12,'#8d7957',2);if(state.particles[q])state.particles[q].dust=true;if(state.particles[q+1])state.particles[q+1].dust=true;}}else p.walk+=dt*3;
    const a=Math.atan2(state.mouse.y-p.y,state.mouse.x-p.x);p.faceX=Math.cos(a);p.faceY=Math.sin(a);
    p.autoAttack=Math.max(0,p.autoAttack-dt);if(p.autoAttack<=0){p.autoAttack=.32;attack();}
    updateFrontTroops(dt);updateRearSkills(dt);
    if(state.combatTimer<=0){waveCleared();return;}
    for(const e of state.enemies){if(e.dead)continue;e.flash=Math.max(0,e.flash-dt);e.hitFlash=Math.max(0,e.hitFlash-dt);e.slow=Math.max(0,e.slow-dt);e.attackCd-=dt;e.x+=e.knockX*dt;e.y+=e.knockY*dt;e.knockX*=.82;e.knockY*=.82;if(e.windup>0){e.windup-=dt;if(e.windup<=0){const aimedAlly=!!e.aim?.ally;const target=aimedAlly?state.ally:p;if(e.kind==='archer'){if(target&&(!aimedAlly||target.hp>0)){const dx=target.x-e.x,dy=target.y-e.y,l=Math.hypot(dx,dy)||1;state.projectiles.push({x:e.x,y:e.y,vx:dx/l*245,vy:dy/l*245,life:2,damage:e.damage,r:5,targetAlly:aimedAlly});}}else if(target&&(!aimedAlly||target.hp>0)&&dist(e,target)<e.r+35){if(aimedAlly)damageAlly(e.damage,e.name);else damagePlayer(e.damage,e.name);}e.attackCd=e.kind==='elite'?1.05:1.4;}continue;}
      const ally=state.ally&&state.ally.hp>0?state.ally:null;const target=ally&&dist(e,ally)<dist(e,p)?ally:p;const d=dist(e,target);if(e.kind==='archer'){if(d>260){e.x+=(target.x-e.x)/d*e.speed*dt;e.y+=(target.y-e.y)/d*e.speed*dt;}else if(d<190){e.x-=(target.x-e.x)/d*e.speed*.75*dt;e.y-=(target.y-e.y)/d*e.speed*.75*dt;}if(e.attackCd<=0&&d<390){e.windup=.6;e.aim={x:target.x,y:target.y,ally:target===ally};}}
      else {const speed=e.speed*(e.slow>0?.48:1);if(d>e.r+target.r+15){e.x+=(target.x-e.x)/d*speed*dt;e.y+=(target.y-e.y)/d*speed*dt;}else if(e.attackCd<=0){e.windup=e.kind==='elite'?.55:.42;e.aim={ally:target===ally};}}
      resolveObstacles(e);
    }
    for(const b of state.projectiles){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(obstacles.some(o=>Math.hypot(b.x-o.x,b.y-o.y)<o.r+b.r)){b.life=0;burst(b.x,b.y,'#8e7953',3);continue;}const target=b.targetAlly?state.ally:p;if(target&&(!b.targetAlly||target.hp>0)&&Math.hypot(b.x-target.x,b.y-target.y)<target.r+b.r){if(b.targetAlly)damageAlly(b.damage,'弓矢');else damagePlayer(b.damage,'弓矢');b.life=0;}}
    state.projectiles=state.projectiles.filter(b=>b.life>0);for(const q of state.particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.94;q.vy*=.94;q.life-=dt;}state.particles=state.particles.filter(q=>q.life>0);state.shake=Math.max(0,state.shake-dt*24);
    if(state.enemies.length&&state.enemies.every(e=>e.dead))waveCleared();
  }
  function updateAlly(dt){const a=state.ally;if(!a||a.hp<=0)return;a.attackCd=Math.max(0,a.attackCd-dt);a.flash=Math.max(0,a.flash-dt);a.hitFlash=Math.max(0,a.hitFlash-dt);a.attackAnim=Math.max(0,a.attackAnim-dt);a.x+=a.knockX*dt;a.y+=a.knockY*dt;a.knockX*=.82;a.knockY*=.82;
    let target=a.commandTarget&&!a.commandTarget.dead?a.commandTarget:null;
    if(!target)target=state.enemies.filter(e=>!e.dead).sort((x,y)=>dist(a,x)-dist(a,y))[0]||null;
    a.target=target;
    if(!target){const d=dist(a,state.player);if(d>62){a.moveX=(state.player.x-a.x)/d;a.moveY=(state.player.y-a.y)/d;a.walk+=dt*11;a.x+=a.moveX*145*dt;a.y+=a.moveY*145*dt;}else{a.moveX=0;a.moveY=0;a.walk+=dt*3;}resolveObstacles(a);return;}
    const d=dist(a,target);if(d>target.r+a.r+12){a.moveX=(target.x-a.x)/d;a.moveY=(target.y-a.y)/d;a.walk+=dt*11;a.x+=a.moveX*155*dt;a.y+=a.moveY*155*dt;if(state.frame%7===0){const q=state.particles.length;burst(a.x,a.y+12,'#778060',2);if(state.particles[q])state.particles[q].dust=true;if(state.particles[q+1])state.particles[q+1].dust=true;}}
    else if(a.attackCd<=0){a.attackCd=.82;a.attackAnim=.25;const damage=13+(state.tent>=2?3:0);hitEnemy(target,damage,a.moveX||1,a.moveY||0);state.player.rage=clamp(state.player.rage+3,0,100);if(target.hp<=0)killEnemy(target);}
    resolveObstacles(a);
  }
  function updateTroops(dt){for(const t of state.troops){if(t.slot!=='front'||t.hp<=0)continue;t.attackCd=Math.max(0,t.attackCd-dt);t.hitFlash=Math.max(0,t.hitFlash-dt);let target=t.commandTarget&&!t.commandTarget.dead?t.commandTarget:state.enemies.filter(e=>!e.dead).sort((a,b)=>dist(t,a)-dist(t,b))[0];if(!target){const d=dist(t,state.player);if(d>90){t.moveX=(state.player.x-t.x)/d;t.moveY=(state.player.y-t.y)/d;t.x+=t.moveX*110*dt;t.y+=t.moveY*110*dt;t.walk+=dt*10;}resolveObstacles(t);continue;}const d=dist(t,target);if(d>target.r+t.r+20){t.moveX=(target.x-t.x)/d;t.moveY=(target.y-t.y)/d;t.x+=t.moveX*105*dt;t.y+=t.moveY*105*dt;t.walk+=dt*10;}else if(t.attackCd<=0){t.attackCd=t.kind==='archer'?1.1:.9;hitEnemy(target,t.damage,t.moveX||1,t.moveY||0);if(target.hp<=0)killEnemy(target);}resolveObstacles(t);}}
  function draw(){ctx.save();if(state.shake)ctx.translate(rand(-state.shake,state.shake),rand(-state.shake,state.shake));drawFloor();if(state.phase==='camp')drawCamp();else{obstacles.filter(o=>o.y<300).forEach(drawObstacle);state.enemies.forEach(drawEnemy);state.projectiles.forEach(drawProjectile);state.troops.filter(t=>t.slot==='front').forEach(drawTroop);drawRearSupport();obstacles.filter(o=>o.y>=300).forEach(drawObstacle);state.particles.forEach(drawParticle);drawCombatHud();}ctx.restore();requestAnimationFrame(loop);}
  function drawFloor(){const g=ctx.createLinearGradient(0,40,0,H);g.addColorStop(0,'#32362a');g.addColorStop(.55,'#3b3829');g.addColorStop(1,'#292b22');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.fillStyle='#3a392d';ctx.fillRect(35,52,W-70,H-80);ctx.strokeStyle='#5b5440';ctx.lineWidth=2;ctx.strokeRect(35,52,W-70,H-80);
    ctx.strokeStyle='#504a39';ctx.lineWidth=14;ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(40,365);ctx.bezierCurveTo(270,325,650,410,930,345);ctx.stroke();ctx.globalAlpha=1;
    for(let i=0;i<70;i++){const x=48+(i*137)%870,y=65+(i*83)%490,r=2+(i%5);ctx.fillStyle=i%4===0?'#6b6547':i%3===0?'#252a20':'#494634';ctx.beginPath();ctx.ellipse(x,y,r*2,r,((i%7)-3)*.12,0,Math.PI*2);ctx.fill();}
    for(let i=0;i<26;i++){const x=62+(i*199)%845,y=70+(i*151)%470;ctx.strokeStyle=i%2?'#6f6d47':'#474d35';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y+8);ctx.quadraticCurveTo(x-4,y,x-1,y-9);ctx.moveTo(x,y+5);ctx.quadraticCurveTo(x+6,y-1,x+5,y-7);ctx.stroke();}
    ctx.strokeStyle='#292820';ctx.lineWidth=3;for(let x=70;x<W;x+=72){ctx.beginPath();ctx.moveTo(x,53);ctx.lineTo(x,82);ctx.moveTo(x,H-28);ctx.lineTo(x,H-57);ctx.stroke();ctx.fillStyle='#554a35';ctx.beginPath();ctx.moveTo(x-6,62);ctx.lineTo(x,47);ctx.lineTo(x+6,62);ctx.fill();ctx.beginPath();ctx.moveTo(x-6,H-37);ctx.lineTo(x,H-22);ctx.lineTo(x+6,H-37);ctx.fill();}
  }
  function drawObstacle(o){ctx.save();ctx.translate(o.x,o.y);ctx.fillStyle='#11120e77';ctx.beginPath();ctx.ellipse(4,13,o.r+7,10,0,0,Math.PI*2);ctx.fill();if(o.type==='rock'){ctx.fillStyle='#4b4a40';ctx.beginPath();ctx.moveTo(-25,10);ctx.lineTo(-18,-11);ctx.lineTo(-2,-22);ctx.lineTo(20,-13);ctx.lineTo(27,9);ctx.lineTo(8,18);ctx.closePath();ctx.fill();ctx.strokeStyle='#6d6b59';ctx.beginPath();ctx.moveTo(-15,-7);ctx.lineTo(-2,-13);ctx.lineTo(13,-7);ctx.stroke();}else if(o.type==='barricade'){ctx.strokeStyle='#6b4c31';ctx.lineWidth=7;ctx.lineCap='round';for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(-30,i*9+8);ctx.lineTo(30,i*9-8);ctx.stroke();}ctx.strokeStyle='#a07b4e';ctx.lineWidth=2;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*14,-23);ctx.lineTo(i*14,23);ctx.stroke();}}else{ctx.strokeStyle='#624a31';ctx.lineWidth=6;ctx.strokeRect(-26,-15,52,25);ctx.beginPath();ctx.arc(-22,14,12,0,Math.PI*2);ctx.arc(22,14,12,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#4e3a28';ctx.fillRect(-28,-18,56,9);ctx.strokeStyle='#95805c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-18,-18);ctx.lineTo(23,10);ctx.moveTo(18,-18);ctx.lineTo(-23,10);ctx.stroke();}ctx.restore();}
  function drawCamp(){ctx.fillStyle='#151711aa';ctx.fillRect(35,52,W-70,H-80);drawTree(105,165);drawTree(845,150);drawTree(840,445);drawTree(95,440);ctx.fillStyle='#514a39';ctx.beginPath();ctx.ellipse(480,360,215,90,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#312d23';ctx.beginPath();ctx.ellipse(480,351,194,78,0,0,Math.PI*2);ctx.fill();
    drawTent(285,230,'粮秣');drawTent(660,230,'军师帐');drawTent(300,426,'铁匠棚');
    const t=state.frame*.05;ctx.fillStyle='#e18745';ctx.beginPath();ctx.moveTo(480,325);ctx.quadraticCurveTo(458,353,478,365);ctx.quadraticCurveTo(492,350,480,325);ctx.fill();ctx.fillStyle='#f3cd79';ctx.beginPath();ctx.arc(480,359,5+Math.sin(t)*1.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5c4732';ctx.fillRect(454,364,54,6);
    drawPerson(550,348,'#a69976',false);ctx.fillStyle='#bda876';ctx.font='13px serif';ctx.textAlign='center';ctx.fillText('徐砚',550,325);ctx.fillStyle='#d4c7a8';ctx.font='16px serif';ctx.fillText('营火照见归途，出征前还可整备营地。',480,500);
  }
  function drawTree(x,y){ctx.fillStyle='#171b15';ctx.beginPath();ctx.arc(x,y,27,0,Math.PI*2);ctx.fill();ctx.fillStyle='#333c2b';ctx.beginPath();ctx.arc(x-7,y-7,17,0,Math.PI*2);ctx.fill();}
  function drawTent(x,y,label){ctx.fillStyle='#574734';ctx.beginPath();ctx.moveTo(x-53,y+30);ctx.lineTo(x,y-38);ctx.lineTo(x+55,y+30);ctx.closePath();ctx.fill();ctx.fillStyle='#8b704b';ctx.beginPath();ctx.moveTo(x-42,y+26);ctx.lineTo(x,y-25);ctx.lineTo(x+42,y+26);ctx.closePath();ctx.fill();ctx.fillStyle='#29271f';ctx.beginPath();ctx.moveTo(x-14,y+29);ctx.lineTo(x,y+1);ctx.lineTo(x+14,y+29);ctx.closePath();ctx.fill();ctx.fillStyle='#c8b486';ctx.font='11px serif';ctx.textAlign='center';ctx.fillText(label,x,y+47);}
  function drawPerson(x,y,color,player=true){ctx.fillStyle='#10110f99';ctx.beginPath();ctx.ellipse(x,y+10,15,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,10,14,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=player?'#bc9a59':'#b9b09a';ctx.beginPath();ctx.arc(x,y-13,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#393326';ctx.fillRect(x-8,y-18,16,5);}
  function drawBar(x,y,w,h,value,color){ctx.fillStyle='#0a0b09d9';ctx.fillRect(x-w/2-1,y-1,w+2,h+2);ctx.fillStyle='#34352c';ctx.fillRect(x-w/2,y,w,h);ctx.fillStyle=color;ctx.fillRect(x-w/2,y,w*clamp(value,0,1),h);}
  function drawArmoredBody(x,y,scale,armor,cloth,helmet,flash=false,walk=0,moving=false,hitFlash=0){const bob=moving?Math.abs(Math.sin(walk))*.9:Math.sin(walk)*.25,leg=Math.sin(walk)*3*scale;y-=bob;ctx.fillStyle='#090a0877';ctx.beginPath();ctx.ellipse(x+3,y+12,20*scale,8*scale,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=cloth;ctx.lineWidth=5*scale;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-6*scale,y+7*scale);ctx.lineTo(x-7*scale+leg,y+17*scale);ctx.moveTo(x+6*scale,y+7*scale);ctx.lineTo(x+7*scale-leg,y+17*scale);ctx.stroke();ctx.fillStyle=cloth;ctx.beginPath();ctx.moveTo(x-13*scale,y-2*scale);ctx.lineTo(x-17*scale,y+18*scale);ctx.lineTo(x+17*scale,y+18*scale);ctx.lineTo(x+13*scale,y-2*scale);ctx.closePath();ctx.fill();ctx.fillStyle=hitFlash>0&&Math.floor(state.frame/2)%2?'#fff4d8':flash?'#eee2bd':armor;ctx.beginPath();ctx.moveTo(x-15*scale,y-9*scale);ctx.lineTo(x-10*scale,y-18*scale);ctx.lineTo(x+10*scale,y-18*scale);ctx.lineTo(x+15*scale,y-9*scale);ctx.lineTo(x+11*scale,y+8*scale);ctx.lineTo(x-11*scale,y+8*scale);ctx.closePath();ctx.fill();ctx.strokeStyle='#28261f';ctx.lineWidth=2*scale;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(x+i*7*scale,y-15*scale);ctx.lineTo(x+i*7*scale,y+5*scale);ctx.stroke();}ctx.strokeStyle='#c5a56a';ctx.lineWidth=1.5*scale;ctx.beginPath();ctx.moveTo(x-12*scale,y-3*scale);ctx.lineTo(x+12*scale,y-3*scale);ctx.stroke();ctx.fillStyle='#c9ad78';ctx.beginPath();ctx.arc(x,y-23*scale,8*scale,0,Math.PI*2);ctx.fill();ctx.fillStyle=helmet;ctx.beginPath();ctx.arc(x,y-26*scale,10*scale,Math.PI,Math.PI*2);ctx.lineTo(x+10*scale,y-22*scale);ctx.lineTo(x-10*scale,y-22*scale);ctx.closePath();ctx.fill();ctx.fillRect(x-11*scale,y-24*scale,22*scale,4*scale);}
  function drawPlayer(p){ctx.save();if(state.invuln>0&&Math.floor(state.frame/4)%2)ctx.globalAlpha=.45;const moving=Math.abs(p.moveX)+Math.abs(p.moveY)>0;drawArmoredBody(p.x,p.y,1.05,'#9e493b','#5d2526','#3a3026',false,p.walk,moving,p.hitFlash);ctx.fillStyle='#b33d32';ctx.beginPath();ctx.moveTo(p.x-7,p.y-35);ctx.lineTo(p.x,p.y-51);ctx.lineTo(p.x+7,p.y-35);ctx.fill();
    const angle=Math.atan2(p.faceY,p.faceX),swing=p.attackAnim>0?1-p.attackAnim/.22:0,windup=swing<.25&&p.attackAnim>0?-.65:.25;ctx.save();ctx.translate(p.x,p.y-2);ctx.rotate(angle+windup+(swing>.25?(swing-.25)*2.8:0));ctx.strokeStyle='#6d5135';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(39,0);ctx.stroke();ctx.strokeStyle='#e4d2a6';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(24,0);ctx.lineTo(64,0);ctx.stroke();ctx.fillStyle='#d9c58f';ctx.beginPath();ctx.moveTo(64,0);ctx.lineTo(52,-5);ctx.lineTo(52,5);ctx.fill();ctx.restore();
    if(p.attackAnim>0&&swing>.2){ctx.strokeStyle='#f5dc9c';ctx.globalAlpha=clamp(1-swing,0,1);ctx.lineWidth=6;ctx.beginPath();ctx.arc(p.x,p.y,48,angle-.9+windup,angle+.9+windup);ctx.stroke();ctx.globalAlpha=.55;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,56,angle-.75+windup,angle+.75+windup);ctx.stroke();}
    if(p.skillAnim>0){ctx.strokeStyle='#e9c76e';ctx.globalAlpha=clamp(p.skillAnim/.3,0,1);ctx.lineWidth=8;ctx.beginPath();ctx.arc(p.x,p.y,93,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;drawBar(p.x,p.y-48,54,5,p.hp/p.maxHp,'#bd5544');drawBar(p.x,p.y-41,54,3,p.rage/100,'#d6ad55');ctx.fillStyle='#e9d6ad';ctx.font='9px serif';ctx.textAlign='center';ctx.fillText('统领',p.x,p.y-53);ctx.restore();}
  function drawAlly(a){if(a.hp<=0)return;ctx.save();const moving=Math.abs(a.moveX)+Math.abs(a.moveY)>0;drawArmoredBody(a.x,a.y,1,'#64774f','#35432e','#303329',a.flash>0,a.walk,moving,a.hitFlash);ctx.fillStyle='#83975f';ctx.beginPath();ctx.moveTo(a.x-6,a.y-33);ctx.lineTo(a.x,a.y-45);ctx.lineTo(a.x+6,a.y-33);ctx.fill();const aa=Math.atan2(a.target?.y-a.y||1,a.target?.x-a.x||1),thrust=a.attackAnim>0?Math.sin((1-a.attackAnim/.25)*Math.PI)*19:0;ctx.save();ctx.translate(a.x,a.y);ctx.rotate(aa);ctx.strokeStyle='#735334';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(3,2);ctx.lineTo(36+thrust,2);ctx.stroke();ctx.strokeStyle='#d9cda8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(27+thrust,2);ctx.lineTo(52+thrust,2);ctx.stroke();ctx.fillStyle='#c7b17e';ctx.beginPath();ctx.moveTo(54+thrust,2);ctx.lineTo(44+thrust,-3);ctx.lineTo(44+thrust,7);ctx.fill();ctx.restore();if(a.attackAnim>0){ctx.strokeStyle='#d7d6a0';ctx.globalAlpha=a.attackAnim/.25;ctx.lineWidth=3;ctx.beginPath();ctx.arc(a.x,a.y,35,aa-.4,aa+.4);ctx.stroke();}drawBar(a.x,a.y-48,48,4,a.hp/a.maxHp,'#8da36c');ctx.fillStyle='#e4d6ad';ctx.font='9px serif';ctx.textAlign='center';ctx.fillText('裴烈',a.x,a.y-54);ctx.restore();}
  function drawTroop(t){if(t.hp<=0)return;const moving=Math.abs(t.moveX)+Math.abs(t.moveY)>0;ctx.save();drawArmoredBody(t.x,t.y,.86,t.kind==='archer'?'#756344':t.kind==='spear'?'#657050':'#72483d','#332c25','#342f29',false,t.walk,moving,t.hitFlash);const target=state.enemies.filter(e=>!e.dead)[0],aa=Math.atan2((target?.y||t.y)-t.y,(target?.x||t.x)-t.x);ctx.save();ctx.translate(t.x,t.y);ctx.rotate(aa);if(t.kind==='archer'){ctx.strokeStyle='#b38a51';ctx.lineWidth=2;ctx.beginPath();ctx.arc(3,0,13,-1.2,1.2);ctx.stroke();}else{ctx.strokeStyle='#bfa375';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(2,0);ctx.lineTo(32,0);ctx.stroke();}ctx.restore();drawBar(t.x,t.y-44,52,5,t.hp/t.maxHp,'#65a86d');ctx.fillStyle='#f0dfba';ctx.font='700 10px serif';ctx.textAlign='center';ctx.fillText(t.name||'武将',t.x,t.y-51);ctx.restore();}
  function drawRearSupport(){state.troops.filter(t=>t.slot==='back').forEach((t,i)=>{const x=54,y=125+i*105,w=120;ctx.fillStyle='#111a25dd';ctx.fillRect(x-34,y-39,w,74);ctx.strokeStyle='#9b814e';ctx.strokeRect(x-34,y-39,w,74);ctx.fillStyle=t.style||'#5f6b78';ctx.beginPath();ctx.arc(x,y-5,22,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f0dfb7';ctx.font='700 11px serif';ctx.textAlign='left';ctx.fillText(t.name,x+29,y-15);ctx.fillStyle='#9facbf';ctx.font='8px serif';ctx.fillText(t.skill?.split('：')[0]||'支援技',x+29,y);const progress=1-clamp((t.skillCd||0)/(t.skillMax||6),0,1);ctx.fillStyle='#26334a';ctx.fillRect(x+29,y+10,48,6);ctx.fillStyle='#d1ad58';ctx.fillRect(x+29,y+10,48*progress,6);ctx.fillStyle='#c7b989';ctx.font='8px sans-serif';ctx.fillText(`${Math.max(0,t.skillCd||0).toFixed(1)}s`,x+29,y+27);});}
  function drawAutoEnemy(e){if(e.dead)return;ctx.save();if(e.hitFlash>0&&Math.floor(state.frame/2)%2)ctx.globalAlpha=.55;const scale=e.kind==='hero'?1.25:e.kind==='elite'?1.12:.82,armor=e.kind==='hero'?'#713843':e.kind==='elite'?'#8f3e32':e.kind==='archer'?'#756344':e.kind==='spear'?'#657050':'#72483d';drawArmoredBody(e.x,e.y,scale,armor,'#33242a','#30282a',false,e.walk,Math.abs(e.moveX)+Math.abs(e.moveY)>0,e.hitFlash);if(e.kind==='archer'){ctx.strokeStyle='#c49a5c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x+4,e.y,16,-1.2,1.2);ctx.stroke();}else{ctx.strokeStyle='#cbb17b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(e.x+3,e.y);ctx.lineTo(e.x+32,e.y-8);ctx.stroke();}drawBar(e.x,e.y-e.r-28,e.kind==='hero'?64:42,4,e.hp/e.maxHp,e.kind==='hero'?'#d24f5c':'#b85b4a');if(e.kind==='hero'){ctx.fillStyle='#f2d09a';ctx.font='700 10px serif';ctx.textAlign='center';ctx.fillText(e.name,e.x,e.y-e.r-34);}ctx.restore();}
  function drawEnemy(e){return drawAutoEnemy(e);
    const flash=e.flash>0;if(e.kind==='elite'){drawArmoredBody(e.x,e.y,1.28,'#8f3e32','#481e22','#30231f',flash);ctx.fillStyle='#a53028';ctx.beginPath();ctx.moveTo(e.x-8,e.y-42);ctx.lineTo(e.x,e.y-61);ctx.lineTo(e.x+8,e.y-42);ctx.fill();ctx.strokeStyle='#b9a36f';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(e.x-19,e.y+5);ctx.lineTo(e.x+28,e.y-20);ctx.stroke();ctx.fillStyle='#a94c36';ctx.beginPath();ctx.arc(e.x-20,e.y+5,13,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d4a75e';ctx.stroke();}
    else{const armor=e.kind==='archer'?'#756344':e.kind==='spear'?'#657050':'#72483d';drawArmoredBody(e.x,e.y,.83,armor,'#332c25','#342f29',flash,e.walk,Math.abs(e.moveX)+Math.abs(e.moveY)>0,e.hitFlash);if(e.kind==='shield'){ctx.fillStyle='#6b3f35';ctx.beginPath();ctx.arc(e.x-13,e.y+1,13,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a27c56';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#b79a6b';ctx.fillRect(e.x-15,e.y-7,4,16);ctx.strokeStyle='#c7b17e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(e.x+7,e.y);ctx.lineTo(e.x+24,e.y+8);ctx.stroke();}else if(e.kind==='spear'){ctx.strokeStyle='#8d714c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(e.x-24,e.y+18);ctx.lineTo(e.x+27,e.y-28);ctx.stroke();ctx.fillStyle='#c8b27d';ctx.beginPath();ctx.moveTo(e.x+24,e.y-26);ctx.lineTo(e.x+35,e.y-36);ctx.lineTo(e.x+29,e.y-22);ctx.fill();}else{const target=e.aim?.ally?state.ally:state.player,aa=Math.atan2(target.y-e.y,target.x-e.x),pull=e.windup>0?10+Math.sin(state.frame*.35)*2:0;ctx.save();ctx.translate(e.x+3,e.y);ctx.rotate(aa);ctx.strokeStyle='#b38a51';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,18,-1.25,1.25);ctx.stroke();ctx.strokeStyle='#cbb991';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(5,-17);ctx.lineTo(5+pull,0);ctx.lineTo(5,17);ctx.stroke();ctx.strokeStyle='#cfb882';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-pull,0);ctx.lineTo(26,0);ctx.stroke();ctx.fillStyle='#d7c89f';ctx.beginPath();ctx.moveTo(29,0);ctx.lineTo(22,-3);ctx.lineTo(22,3);ctx.fill();ctx.restore();}}
    if(e.windup>0&&e.kind!=='archer'){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(Math.atan2((e.aim?.ally?state.ally.y:state.player.y)-e.y,(e.aim?.ally?state.ally.x:state.player.x)-e.x));ctx.strokeStyle=e.kind==='elite'?'#dbc27d':'#bca576';ctx.lineWidth=e.kind==='elite'?5:3;ctx.beginPath();ctx.moveTo(5,2);ctx.lineTo(e.kind==='elite'?52:35,2);ctx.stroke();ctx.restore();}if(e.kind==='elite'||e.hp<e.maxHp)drawBar(e.x,e.y-e.r-26,e.r*2.5,4,e.hp/e.maxHp,e.kind==='elite'?'#bd604a':'#a57c59');ctx.restore();}
  function drawProjectile(b){ctx.fillStyle='#e5c77f';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e5c77f66';ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx*.04,b.y-b.vy*.04);ctx.stroke();}
  function drawParticle(q){ctx.globalAlpha=clamp(q.life/q.max,0,1);ctx.fillStyle=q.color;ctx.beginPath();if(q.dust){ctx.ellipse(q.x,q.y,q.r*1.8,q.r,0,0,Math.PI*2)}else ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  function drawCombatHud(){ctx.fillStyle='#111711cc';ctx.fillRect(W/2-105,12,210,34);ctx.strokeStyle='#a68b55';ctx.strokeRect(W/2-105,12,210,34);ctx.fillStyle='#f0d58e';ctx.font='700 14px serif';ctx.textAlign='center';ctx.fillText(`自动战斗 · ${Math.ceil(state.combatTimer)} 秒 · 难度 ${state.difficulty}`,W/2,34);
  }
  function loop(now){const dt=Math.min(.033,(now-(state.lastTime||now))/1000);state.lastTime=now;update(dt);draw();}
  function pointer(e){const rect=canvas.getBoundingClientRect();state.mouse.x=(e.clientX-rect.left)*W/rect.width;state.mouse.y=(e.clientY-rect.top)*H/rect.height;}
  window.addEventListener('keydown',e=>keys.add(e.key.toLowerCase()));window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));canvas.addEventListener('contextmenu',e=>e.preventDefault());
  restore();updateUI();if(new URLSearchParams(location.search).has('battle'))startRun();else enterCamp();requestAnimationFrame(loop);
})();
