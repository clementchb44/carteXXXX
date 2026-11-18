import { CARTES, RARETES } from './catalog.mjs?v=26';
import { COSMOS, COSMOS_RARETES, ULTIME_CHANCE, COSMOS_COLLECTIONS } from './cosmos.mjs?v=26';
import { EVENTS, EVENT_CARDS, activeEvent, nextEvent, dayBonus } from './events.mjs?v=26';
const ALL_RAR={...RARETES,...COSMOS_RARETES},ALL_ORDER=[...Object.keys(RARETES),...Object.keys(COSMOS_RARETES)],BIG_RARETES=['mythique','cristal','eclipse','singularite','omega','ultime'];
import { shopPrice, initial, action as playAction, levelInfo, XP, RACES, RACE_COST, intervalFor, bonusOf, SHOP, DAILY_REWARDS, dailyStatus, ANIMALS, BOMB_MULTS, BOMB_CELLS, MYSTERY_GAIN, DICE_GAINS, SELL_VALUES, MAX_OPEN, TRADES, TRADES_COSMOS, DISCOVER_PER_DAY, discoverLeft, FISH_MAX, FISH_INTERVAL, FISH_LOOT, normalizeFish, COLLECTIONS, ACHIEVEMENTS, SECRETS, TITLES, THEMES, BACKS, themeUnlocked } from './game.mjs?v=26';
// Le jeu tourne dans le navigateur : la partie est sauvegardée sur cet appareil (localStorage).
const SAVE_KEY='cartex-save-v1';
const loadSave=()=>{try{return JSON.parse(localStorage.getItem(SAVE_KEY));}catch{return null;}};
const writeSave=s=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));}catch{}};
const random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/2**32;
const $=id=>document.getElementById(id);
const format=n=>n.toLocaleString('fr-FR',{maximumFractionDigits:2});
let state=null, busy=false, offset=0, initialized=false, questDefinitions=[];
const SECRET_RARETE={label:'Secrète',couleur:'#ff4fd8'};
function card(c,preview=false,isNew=false){
 const n=state?.collection[c.id]||0, locked=!preview&&!n;
 const image=CARTES.find(item=>item.id===c.id)?.image;
 const art=locked?'?':image?`<img src="${image}" alt="Illustration de ${c.nom}" width="240" height="180" loading="${preview?'eager':'lazy'}" decoding="async">`:(locked?'◇':c.emoji);
 const el=document.createElement('article'); const rar=c.secret?SECRET_RARETE:ALL_RAR[c.rarete];
 const foil=locked?null:c.secret?'arc':(preview?c.foil:state?.foils?.[c.id]);
 el.className=`card ${c.rarete}${c.cosmos?' cosmos':''}${locked?' locked':''}${foil?' foil-'+foil:''}`;
 el.style.setProperty('--accent',rar.couleur);
 el.innerHTML=`<div class="card-top"><span>${rar.label}</span><b>${locked?'?? PV':c.pv+' PV'}</b></div><div class="art">${art}</div>${foil?`<span class="foil-tag">${c.secret?'✦ SECRÈTE':foil==='or'?'✦ DORÉE':'✦ ARC-EN-CIEL'}</span>`:''}<small>N° ${locked?'???':c.cosmos?'C-'+String(c.id-300).padStart(3,'0'):c.evt?'E-'+String(c.id%100).padStart(2,'0'):String(c.id).padStart(3,'0')}</small><h3>${locked?'???':c.nom}</h3><div class="card-bottom"><span>${locked?'À DÉCOUVRIR':c.secret?'SECRÈTE':isNew?'NOUVEAU':n?'× '+n:'APERÇU'}</span><span>✦</span></div>`;
 el.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=el.getBoundingClientRect();const x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;el.style.transform=`perspective(800px) rotateY(${(x-.5)*16}deg) rotateX(${(.5-y)*16}deg)`;el.style.setProperty('--shine',`${x*100}%`);el.style.setProperty('--shiney',`${y*100}%`);});
 el.addEventListener('pointerleave',()=>el.style.transform='');return el;
}
let colSet='collection';
const COL_TABS=['collection','cosmos','evenements'];
function renderColPicker(){document.querySelectorAll('.col-picker').forEach(el=>{const ev=activeEvent(Date.now()+offset);if(!el.children.length)el.replaceChildren(...[['collection','classic','Classique','147 cartes'],['cosmos','cosmos','Cosmos ✦','200 cartes · nouvelles raretés'],['evenements','event','Événements 🎉','Éditions limitées']].map(([id,set,nom,sub])=>{const b=document.createElement('button');b.dataset.set=set;b.dataset.col=id;b.innerHTML=`<b>${nom}</b><small>${sub}</small>`;b.onclick=()=>tab(id);return b;}));el.querySelectorAll('button').forEach(b=>{b.classList.toggle('on',b.dataset.col===colSet);if(b.dataset.col==='evenements'){const sm=b.querySelector('small');if(sm)sm.textContent=ev?`${ev.emoji} ${ev.nom} en cours`:'Éditions limitées';}});});}
function tab(name){if(COL_TABS.includes(name)){colSet=name;renderColPicker();}const navName=COL_TABS.includes(name)?'collection':name;document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('visible',el.id===name));document.querySelectorAll('[data-tab]').forEach(el=>{const on=el.dataset.tab===navName;el.classList.toggle('active',on);el.setAttribute('aria-current',on?'page':'false');});}
document.querySelectorAll('nav [data-tab="collection"]').forEach(b=>b.onclick=()=>tab(colSet));
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>tab(b.dataset.go));document.querySelectorAll('nav [data-tab="collection"]').forEach(b=>b.onclick=()=>tab(colSet));renderColPicker();
function timer(){if(!state)return;const now=Date.now()+offset,interval=intervalFor(state);const added=Math.max(0,Math.floor((now-state.anchor)/interval));const reserve=Math.min(10,state.boosters+added),bonus=state.bonus||0,available=reserve+bonus;$('reserve').textContent=`${reserve} / 10 boosters${bonus?` + ${bonus} bonus`:''}`;renderOpenButton(available);$('play').disabled=busy||state.jetons<Number($('bet').value);$('reserve-track').innerHTML=Array.from({length:10},(_,i)=>`<i class="${i<reserve?'filled':''}"></i>`).join('');const left=Math.max(0,Math.ceil((interval-((now-state.anchor)%interval))/1000));$('timer').textContent=reserve===10?'Réserve pleine':`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;}
function render(){ $('balance').textContent=format(state.jetons);$('diamonds').textContent=state.diamants||0;$('count').textContent=`${CARTES.filter(c=>state.collection[c.id]>0).length} / ${CARTES.length} cartes découvertes`;$('sell').disabled=busy||!Object.values(state.collection).some(n=>n>1);renderCollection();renderQuests();renderLevel();renderRaces();renderShop();renderCasino();renderProfile();renderAch();renderCosmos();renderEvents();renderSetPicker();renderColPicker();renderTrade();renderFish();renderEvent();renderShowcase();timer(); }
function renderShowcase(){
 const el=document.querySelector('.display-card');if(!el||!state)return;
 const found=(state.collection[145]||0)>0;
 el.classList.toggle('mystery',!found);
 el.innerHTML=found
  ?'<div class="display-top">CRISTAL <span>420 PV</span></div><div class="gem"><img src="art/145.svg" alt="Illustration de Bouzelouf" width="240" height="180"></div><p>N° 145 / 147</p><h2>Bouzelouf</h2><div class="display-bottom">ÉDITION CRISTAL <span>✦</span></div>'
  :'<div class="display-top">CRISTAL <span>?? PV</span></div><div class="gem"><span class="mystery-mark">?</span></div><p>N° ??? / 147</p><h2>???</h2><div class="display-bottom">ÉDITION CRISTAL <span>✦</span></div>';
}
// ---------- COLLECTION COSMOS ----------
const COSMOS_ORDER=['ultime','omega','singularite','eclipse','pulsar','nova','astral'];
let cSellRarities=[...COSMOS_ORDER];
let cThemeFilter=null;
function renderCThemes(){
 const el=$('c-themes');if(!el)return;
 el.replaceChildren(...COSMOS_COLLECTIONS.map(c=>{const n=c.ids.filter(id=>state.collection[id]>0).length,full=n===c.ids.length,b=document.createElement('button');b.className='theme-chip'+(cThemeFilter===c.id?' on':'')+(full?' full':'');
  b.innerHTML=`<span>${c.icon}</span><b>${c.nom}</b><small>${n} / ${c.ids.length}${full?' ✓':` · +${c.diamants} ◆`}</small><i style="width:${Math.round(100*n/c.ids.length)}%"></i>`;
  b.onclick=()=>{cThemeFilter=cThemeFilter===c.id?null:c.id;renderCosmos();};return b;}));
}
function renderCosmos(){
 if(!state||!$('c-cards'))return;renderCThemes();const cTheme=COSMOS_COLLECTIONS.find(c=>c.id===cThemeFilter);
 const sel=$('c-rarity');if(sel.options.length<2)for(const k of COSMOS_ORDER){const o=document.createElement('option');o.value=k;o.textContent=COSMOS_RARETES[k].label;sel.append(o);}
 const sf=$('c-sell-filter');if(!sf.children.length){sf.replaceChildren(Object.assign(document.createElement('span'),{textContent:'Vendre les doublons de :'}),...COSMOS_ORDER.filter(k=>k!=='ultime').reverse().map(k=>{const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=cSellRarities.includes(k);box.onchange=()=>{cSellRarities=box.checked?[...new Set([...cSellRarities,k])]:cSellRarities.filter(x=>x!==k);};label.append(box,' '+COSMOS_RARETES[k].label);return label;}));}
 $('c-odds').innerHTML=COSMOS_ORDER.slice().reverse().map(k=>{const t=COSMOS_RARETES[k];return `<p><span><i style="background:${t.couleur}"></i>${t.label}</span><b>${k==='ultime'?'1 sur 150 000':t.chance+' %'}</b></p>`;}).join('');
 const v=k=>format(COSMOS_RARETES[k].vente*(1+bonusOf(state).resale));
 $('c-sell-note').textContent=`Un doublon rapporte (en jetons) : astral ${v('astral')} · nova ${v('nova')} · pulsar ${v('pulsar')} · éclipse ${v('eclipse')} · singularité ${v('singularite')} · oméga ${v('omega')} · ultime ${v('ultime')}. Les cartes verrouillées 🔒 ne sont jamais vendues.`;
 const owned=COSMOS.filter(c=>state.collection[c.id]>0).length;
 $('c-count').textContent=`${owned} / ${COSMOS.length} cartes découvertes`;
 $('c-sell').disabled=busy;
 const query=$('c-search').value.toLocaleLowerCase('fr'),rarity=$('c-rarity').value,only=$('c-owned').checked,zone=$('c-cards');zone.replaceChildren();let found=0;
 for(const key of COSMOS_ORDER){if(rarity&&rarity!==key)continue;
  const list=COSMOS.filter(c=>c.rarete===key&&(!cTheme||cTheme.ids.includes(c.id))&&(!query||(state.collection[c.id]>0&&c.nom.toLocaleLowerCase('fr').includes(query)))&&(!only||state.collection[c.id]>0));if(!list.length)continue;found+=list.length;
  const heading=document.createElement('h2');heading.className='rarity-heading';heading.textContent=`${COSMOS_RARETES[key].label} / ${list.filter(c=>state.collection[c.id]>0).length} sur ${list.length}`;
  const grid=document.createElement('div');grid.className='grid';
  grid.append(...list.map(c=>{const el=card(c);if(state.collection[c.id]>0){const locked=!!state.locks?.[c.id],b=document.createElement('button');b.className='lock-btn'+(locked?' on':'');b.textContent=locked?'🔒':'🔓';b.title=locked?'Carte verrouillée':'Verrouiller cette carte';b.onclick=e=>{e.stopPropagation();request('lock',{id:c.id,locked:!locked});};el.append(b);if(locked)el.classList.add('is-locked');}return el;}));
  zone.append(heading,grid);}
 if(!found)zone.innerHTML='<p class="empty">Aucune carte ne correspond à ces filtres.</p>';
}
$('c-sell').onclick=()=>request('sell',{set:'cosmos',rarities:cSellRarities});
['c-search','c-rarity','c-owned'].forEach(id=>{$(id).oninput=()=>{if(state)renderCosmos();};});
let sellRarities=['commun','rare','epique','legendaire','mythique','cristal'];
function renderSellFilter(){
 const el=$('sell-filter');if(!el)return;
 el.replaceChildren(Object.assign(document.createElement('span'),{textContent:'Vendre les doublons de :'}),...['commun','rare','epique','legendaire','mythique','cristal'].map(k=>{
  const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=sellRarities.includes(k);
  box.onchange=()=>{sellRarities=box.checked?[...new Set([...sellRarities,k])]:sellRarities.filter(x=>x!==k);};
  label.append(box,' '+RARETES[k].label);return label;}));
}
let themeFilter=null;
function renderThemes(){
 const el=$('themes');if(!el)return;
 el.replaceChildren(...COLLECTIONS.map(c=>{const n=c.ids.filter(id=>state.collection[id]>0).length,full=n===c.ids.length,b=document.createElement('button');b.className='theme-chip'+(themeFilter===c.id?' on':'')+(full?' full':'');
  b.innerHTML=`<span>${c.icon}</span><b>${c.nom}</b><small>${n} / ${c.ids.length}${full?' ✓':` · +${c.diamants} ◆`}</small><i style="width:${Math.round(100*n/c.ids.length)}%"></i>`;
  b.onclick=()=>{themeFilter=themeFilter===c.id?null:c.id;renderCollection();};return b;}));
}
function renderCollection(){if(!state)return;if(!$('sell-filter').children.length)renderSellFilter();renderThemes();const theme=COLLECTIONS.find(c=>c.id===themeFilter),query=$('search').value.toLocaleLowerCase('fr'),rarity=$('rarity').value,owned=$('owned').checked;const zone=$('cards');zone.replaceChildren();let found=0;for(const key of ['cristal','mythique','legendaire','epique','rare','commun']){if(rarity&&rarity!==key)continue;const list=CARTES.filter(c=>c.rarete===key&&(!theme||theme.ids.includes(c.id))&&(!query||(state.collection[c.id]>0&&c.nom.toLocaleLowerCase('fr').includes(query)))&&(!owned||state.collection[c.id]>0));if(!list.length)continue;found+=list.length;const heading=document.createElement('h2');heading.className='rarity-heading';heading.textContent=`${RARETES[key].label} / ${list.filter(c=>state.collection[c.id]>0).length} sur ${list.length}`;const grid=document.createElement('div');grid.className='grid';grid.append(...list.map(c=>{const el=card(c);if(state.collection[c.id]>0){const locked=!!state.locks?.[c.id],b=document.createElement('button');b.className='lock-btn'+(locked?' on':'');b.textContent=locked?'🔒':'🔓';b.title=locked?'Carte verrouillée : jamais vendue ni échangée':'Verrouiller cette carte';b.onclick=e=>{e.stopPropagation();request('lock',{id:c.id,locked:!locked});};el.append(b);if(locked)el.classList.add('is-locked');}return el;}));zone.append(heading,grid);}if(!found)zone.innerHTML='<p class="empty">Aucune carte ne correspond à ces filtres.</p>';}
for(const [key,r] of Object.entries(RARETES)){const o=document.createElement('option');o.value=key;o.textContent=r.label;$('rarity').append(o);}['search','rarity','owned'].forEach(id=>$(id).addEventListener('input',renderCollection));$('bet').onchange=timer;
function legacy(){try{const saved=JSON.parse(localStorage.getItem('mon-jeu-de-cartes'));return saved||{collection:JSON.parse(localStorage.getItem('ma-collection'))||{}};}catch{return {};}}
async function request(action,extra={}){if(busy)return;busy=true;timer();$('sell').disabled=true;document.querySelectorAll('[data-claim]').forEach(b=>b.disabled=true);$('status').textContent='Sauvegarde en cours…';try{const saved=loadSave();if(saved)state=saved;else if(!state)state=initial(Date.now(),legacy());const data=playAction(state,{action,...extra},Date.now(),random);writeSave(state);if(action==='casino')await new Promise(resolve=>setTimeout(resolve,650));if(action==='race')await new Promise(resolve=>setTimeout(resolve,1100));if(action==='animals')await new Promise(resolve=>setTimeout(resolve,1400));if(action==='mystery')await new Promise(resolve=>setTimeout(resolve,600));if(action==='dice')await new Promise(resolve=>setTimeout(resolve,800));state=data.state;offset=0;initialized=true;questDefinitions=data.quests||questDefinitions;$('status').textContent=data.message||'Ta collection est sauvegardée sur cet appareil.';if((action==='open'||(action==='buy'&&data.cards.length))){await playOpening(data.cards,data.count||1);$('resultat').replaceChildren(...data.cards.slice(-10).map((c,i)=>{const el=card(c,true,c.new);el.classList.add('reveal');el.style.animationDelay=`${i*.13}s`;return el;}));
 const rare=data.cards.filter(c=>['legendaire','mythique','cristal'].includes(c.rarete)||c.foil);
 $('pack-cards').replaceChildren(...data.cards.map((c,i)=>{const el=card(c,true,c.new);el.classList.add('reveal');if(rare.includes(c))el.classList.add('rare-pull');el.style.animationDelay=`${Math.min(i*.08,.9)}s`;return el;}));
 {const order=ALL_ORDER,best=data.cards.reduce((a,c)=>order.indexOf(c.rarete)>order.indexOf(a.rarete)?c:a,data.cards[0]),fresh=data.cards.filter(c=>c.new).length;$('pack-title').textContent=`Tes ${data.cards.length} cartes`;$('rare-message').textContent=`${fresh} nouvelle${fresh>1?'s':''} · meilleure trouvaille : ${best.foil?(best.foil==='or'?'dorée ':'arc-en-ciel '):''}${ALL_RAR[best.rarete].label} · ${best.nom}`;}
 if(!$('pack-dialog').open)$('pack-dialog').showModal();
 if(rare.length)celebrate('rare');
 }if(action==='casino'){$('casino-message').textContent=data.message;[...$('reels').children].forEach((el,i)=>el.textContent=data.symbols[i]);$('casino-card').replaceChildren(...data.cards.map(c=>{const el=card(c,true,c.new);el.classList.add(['legendaire','mythique','cristal'].includes(c.rarete)?'rare-pull':'reveal');return el;}));
 if(data.symbols.every(s=>s===data.symbols[0])){celebrate('win');const machine=document.querySelector('.machine');machine.classList.remove('winner');void machine.offsetWidth;machine.classList.add('winner');}
 }if(data.race&&(action==='race'||action==='buy')){if(action==='buy')tab('races');showRaceResult(data.race);}if(action==='claim'||action==='daily')celebrate('win');if(action==='bomb_start')lastBomb=null;else if(data.bomb)lastBomb=data.bomb.over?data.bomb:null;if(action==='animals')lastRace=data.order;if(action==='mystery')lastMystery={reveal:data.reveal,pick:data.pick};if(action==='dice')lastDice=data.dice;
 const msgId={bomb_start:'msg-bomb',bomb_pick:'msg-bomb',bomb_cash:'msg-bomb',animals:'msg-animals',mystery:'msg-mystery',dice:'msg-dice',fish:'fish-msg'}[action];if(msgId){$(msgId).textContent=data.message;if(data.win||data.bomb?.cashed)celebrate('win');}
 if(action==='trade'&&data.cards?.length){tradePicks={};$('trade-result').replaceChildren(Object.assign(document.createElement('p'),{className:'race-new',textContent:'✦ NOUVELLE CARTE'}),card(data.cards[0],true,data.cards[0].new));if(['epique','legendaire','mythique','cristal','pulsar','eclipse','singularite','omega'].includes(data.cards[0].rarete))celebrate('rare');}
 if(data.achievements?.length){showToast(data.achievements);celebrate('rare');}
 if(data.levelUps?.length)announceLevel(data.levelUps);render();}catch(e){$('status').textContent=e.message;if(action==='casino')$('casino-message').textContent=e.message;if(action==='race')$('race-result').replaceChildren(); if(!initialized){const retry=document.createElement('button');retry.textContent='Réessayer';retry.className='retry';retry.onclick=()=>request('sync');$('status').append(' ',retry);}}finally{busy=false;$('reels').classList.remove('spinning');if(state)render();}}
$('shop-list').onclick=e=>{const b=e.target.closest('[data-buy]');if(b)request('buy',{item:b.dataset.buy,set:shopSet});};$('open').onclick=()=>request('open',{count:openTarget(available()),set:openSet});$('sell').onclick=()=>request('sell',{rarities:sellRarities});$('roll-race').onclick=()=>{if(busy)return;$('race-result').innerHTML='<div class="race-spin" aria-label="Tirage en cours"><span>🎲</span></div>';request('race');};$('play').onclick=()=>{if(busy)return;$('reels').classList.add('spinning');request('casino',{bet:Number($('bet').value)});};
function celebrate(kind){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const zone=$('celebration');zone.replaceChildren();zone.className=kind;
 for(let i=0;i<32;i++){const spark=document.createElement('i');spark.style.setProperty('--x',`${Math.random()*100}vw`);spark.style.setProperty('--drift',`${(Math.random()-.5)*220}px`);spark.style.setProperty('--delay',`${Math.random()*.35}s`);spark.style.setProperty('--turn',`${Math.random()*720}deg`);zone.append(spark);}
 setTimeout(()=>zone.replaceChildren(),2200);
}
function renderLevel(){
 const info=levelInfo(state.xp||0);
 $('level-num').textContent=`Niv. ${info.level}`;
 $('xp-text').textContent=info.need?`${info.into} / ${info.need} XP`:'Niveau max';
 $('xp-fill').style.width=info.need?`${Math.min(100,info.into/info.need*100)}%`:'100%';
}
// ---------- LES RACES ----------
function bonusLines(r){const l=[];if(r.speed)l.push(`⏱ Boosters ${Math.round(r.speed*100)} % plus rapides`);if(r.luck)l.push(`✦ Chance de raretés +${Math.round(r.luck*100)} %`);if(r.resale)l.push(`◉ Doublons vendus ${Math.round(r.resale*100)} % plus cher`);return l;}
function raceCard(r,{locked=false,equipped=false,owned=0}={}){
 const el=document.createElement('article');el.className=`race-card ${r.rarete}${locked?' locked':''}${equipped?' equipped':''}`;
 el.style.setProperty('--accent',RARETES[r.rarete].couleur);
 el.innerHTML=`<span class="race-rarity">${RARETES[r.rarete].label} · ${r.limited?'Limitée 🎉':r.chance+' %'}</span><div class="race-emoji">${locked?'?':r.emoji}</div><h3>${locked?'???':r.nom}</h3><ul>${locked?'<li>Avantage inconnu</li>':bonusLines(r).map(l=>`<li>${l}</li>`).join('')}</ul>`;
 if(!locked&&owned){
  const b=document.createElement('button');b.className=equipped?'secondary':'primary';b.disabled=busy||equipped;b.textContent=equipped?'Équipée ✓':'Équiper';
  b.onclick=()=>request('equip',{race:r.id});el.append(b);
  if(owned>1){const n=document.createElement('small');n.className='race-count';n.textContent=`× ${owned}`;el.append(n);
   const v=(owned-1)*SELL_VALUES[r.rarete]*(1+bonusOf(state).resale);
   const sell=document.createElement('button');sell.className='secondary';sell.disabled=busy;sell.textContent=`Vendre ${owned-1} doublon${owned>2?'s':''} · ${format(Math.round(v*100)/100)} jeton${v>1?'s':''}`;
   sell.onclick=()=>request('sellrace',{race:r.id});el.append(sell);}
 }
 return el;
}
function formatDuration(ms){const total=Math.round(ms/1000),m=Math.floor(total/60),s=total%60;return s?`${m} min ${s} s`:`${m} min`;}
function renderRaces(){
 const rs=state.races||{owned:{},equipped:null,free:1,rolls:0},b=bonusOf(state);
 const free=rs.free>0;
 $('roll-race').textContent=free?'Tirer ma race (offert) ↗':`Tirer une race · ${RACE_COST} jetons ↗`;
 $('roll-race').disabled=busy||(!free&&state.jetons<RACE_COST);
 $('race-cost').textContent=free?'Ton premier tirage est offert.':`Un doublon de race te rend 0,5 jeton. Tu as ${format(state.jetons)} jetons.`;
 const equippedRace=RACES.find(r=>r.id===rs.equipped);
 $('race-equipped').replaceChildren(equippedRace?raceCard(equippedRace,{equipped:true,owned:rs.owned[equippedRace.id]}):Object.assign(document.createElement('p'),{className:'empty',textContent:'Aucune race équipée. Tire ta première race !'}));
 $('race-list').replaceChildren(...[...RACES].filter(r=>!r.limited||rs.owned[r.id]||activeEvent(Date.now()+offset)?.id===r.event).reverse().map(r=>raceCard(r,{locked:!rs.owned[r.id],equipped:rs.equipped===r.id,owned:rs.owned[r.id]||0})));
 const tiers={};for(const r of RACES)if(!r.limited)tiers[r.rarete]=(tiers[r.rarete]||0)+r.chance;
 $('race-odds').innerHTML=Object.entries(RARETES).filter(([k])=>tiers[k]).reverse().map(([k,t])=>`<p><span><i style="background:${t.couleur}"></i>${t.label}</span><b>${tiers[k]} %</b></p>`).join('');
 $('race-chip').textContent=equippedRace?`${equippedRace.emoji} ${equippedRace.nom}`:'Aucune';
 $('rate-note').textContent=`+1 booster / ${formatDuration(intervalFor(state))} · Même hors connexion · +10 XP par booster ouvert`;
 {const v=k=>format(SELL_VALUES[k]*(1+b.resale));$('sell-rate').textContent=`Un doublon rapporte (en jetons) : commun, rare, épique ${v('commun')} · légendaire ${v('legendaire')} · mythique ${v('mythique')} · cristal ${v('cristal')}.`;}
}
function showRaceResult(race){
 const rs=state.races;
 const el=raceCard(race,{equipped:rs.equipped===race.id,owned:rs.owned[race.id]});el.classList.add('pop');
 const tag=document.createElement('p');tag.className='race-new';tag.textContent=race.new?'✦ NOUVELLE RACE':'Déjà connue · 0,5 jeton remboursé';
 $('race-result').replaceChildren(tag,el);
 if(['epique','legendaire','mythique'].includes(race.rarete))celebrate('rare');
}
let levelTimer=0;
function rewardText(r){return [r.jetons&&`${r.jetons} ◉`,r.diamants&&`${r.diamants} ◆`,r.boosters&&`${r.boosters} booster${r.boosters>1?'s':''}`].filter(Boolean).join(' + ');}
function renderDaily(){
 const now=Date.now()+offset,st=dailyStatus(state,now),day=st.claimed?(st.streak-1)%7:st.nextIndex;
 const left=Math.max(0,new Date(st.today+'T00:00:00Z').getTime()+86400000-now),h=Math.floor(left/3600000),m=Math.floor(left%3600000/60000);
 const days=DAILY_REWARDS.map((r,i)=>`<div class="daily-day${i<day||(st.claimed&&i===day)?' done':''}${!st.claimed&&i===day?' today':''}"><span>Jour ${i+1}</span><b>${rewardText(r)}</b></div>`).join('');
 $('daily').innerHTML=`<h2>Récompense du jour</h2><div class="daily-days">${days}</div>`;
 const btn=document.createElement('button');btn.className=st.claimed?'secondary':'primary';btn.disabled=busy||st.claimed;
 btn.textContent=st.claimed?`Reviens dans ${h} h ${String(m).padStart(2,'0')} min`:'Récupérer ma récompense';btn.onclick=()=>request('daily');
 const note=document.createElement('p');note.className='fine';note.textContent=`Série : ${st.streak} jour${st.streak>1?'s':''}. Si tu rates un jour, elle repart de zéro.`;
 $('daily').append(btn,note);
}
let shopSet='classic';
function pickerRow(el,cur,pick,sub){ if(!el)return; el.replaceChildren(...[['classic','Classique','147 cartes'],['cosmos','Cosmos ✦',sub||'200 cartes']].map(([id,nom,s2])=>{const b=document.createElement('button');b.dataset.set=id;b.className=cur===id?'on':'';b.innerHTML=`<b>${nom}</b><small>${s2}</small>`;b.onclick=()=>pick(id);return b;})); }
function renderShop(){
 renderDaily();
 pickerRow($('shop-picker'),shopSet,id=>{shopSet=id;renderShop();},'200 cartes · jamais d’Ultime ici');
 const now=Date.now(),d=state.diamants||0,b=state.boosts||{};
 $('shop-jetons').textContent=format(state.jetons);$('shop-diamants').textContent=d;
 const act=[];if((b.xp||0)>now)act.push(`Double XP : ${Math.ceil((b.xp-now)/60000)} min`);if((b.luck||0)>now)act.push(`Chance +50 % : ${Math.ceil((b.luck-now)/60000)} min`);
 $('shop-boosts').textContent=act.length?'En cours : '+act.join(' · '):'Tu gagnes 2 diamants à chaque niveau.';
 $('shop-list').replaceChildren(...SHOP.map(i=>{const el=document.createElement('article');el.className='shop';const money=i.monnaie==='jetons'?state.jetons:d;
  el.innerHTML=`<span class="shop-icon">${i.monnaie==='jetons'?'◉':'◆'}</span><h2>${i.nom}</h2><p>${i.desc}</p>`;
  const btn=document.createElement('button');btn.className='secondary';btn.dataset.buy=i.id;const left=i.id==='decouverte'?discoverLeft(state,now):null;const px=shopPrice(i,now);btn.disabled=busy||money<px||left===0;btn.textContent=`Acheter · ${px}${px<i.prix?' (−50 %)':''} ${i.monnaie}${left!==null?` (${left}/${DISCOVER_PER_DAY} aujourd’hui)`:''}`;el.append(btn);return el;}));
}
// ---------- CASINO : AUTRES JEUX ----------
const FACES=['⚀','⚁','⚂','⚃','⚄','⚅'];
let game='slots',lastBomb=null,lastRace=null,lastMystery=null,lastDice=null;
const betValue=()=>Number($('bet').value);
function setGame(g){
 game=g;
 document.querySelectorAll('[data-game]').forEach(b=>b.classList.toggle('active',b.dataset.game===g));
 document.querySelectorAll('[data-stage]').forEach(el=>el.hidden=el.dataset.stage!==g);
 document.querySelectorAll('[data-for]').forEach(el=>el.hidden=el.dataset.for!==g);
}
document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>{setGame(b.dataset.game);if(state)renderCasino();});
$('bet').onchange=()=>{if(state)renderCasino();};
$('bomb-start').onclick=()=>request('bomb_start',{bet:betValue()});
$('bomb-cash').onclick=()=>request('bomb_cash');
function renderCasino(){
 const bet=betValue(),can=state.jetons>=bet,active=state.bomb;
 $('bet').disabled=busy||!!active;
 // La bombe
 const opened=active?active.opened:lastBomb?.opened||[];
 $('bomb-grid').replaceChildren(...Array.from({length:BOMB_CELLS},(_,i)=>{
  const b=document.createElement('button');b.className='bomb-cell';
  if(active){b.textContent=opened.includes(i)?'💎':'?';b.disabled=busy||opened.includes(i);b.onclick=()=>request('bomb_pick',{index:i});}
  else{b.disabled=true;b.textContent=lastBomb?(lastBomb.bombs.includes(i)?'💣':opened.includes(i)?'💎':'·'):'?';if(lastBomb?.hit===i)b.classList.add('hit');}
  return b;}));
 $('bomb-start').disabled=busy||!!active||!can;
 const mult=active&&opened.length?BOMB_MULTS[opened.length-1]:0;
 $('bomb-cash').disabled=busy||!active||!opened.length;
 $('bomb-cash').textContent=mult?`Encaisser · ${format(active.bet*mult)} jetons`:'Encaisser';
 // La course
 const byId=Object.fromEntries(ANIMALS.map(a=>[a.id,a]));
 const rank=id=>lastRace?lastRace.indexOf(id):-1;
 $('animal-track').replaceChildren(...ANIMALS.map(a=>{const lane=document.createElement('div');lane.className='lane';const r=rank(a.id);
  lane.innerHTML=`<span class="runner${r===0?' first':''}" style="left:${r<0?0:[84,70,56,42,28][r]}%">${a.emoji}</span>`;return lane;}));
 $('animal-picks').replaceChildren(...ANIMALS.map(a=>{const b=document.createElement('button');b.className='secondary';b.disabled=busy||!can;
  b.innerHTML=`${a.emoji} <b>${a.nom}</b><small>${a.chance} % · × ${a.gain}</small>`;
  b.onclick=()=>{document.querySelectorAll('.runner').forEach(r=>r.classList.add('running'));lastRace=null;request('animals',{bet:betValue(),pick:a.id});};return b;}));
 // La carte mystère
 $('mystery-cards').replaceChildren(...[0,1,2].map(i=>{const b=document.createElement('button');b.className='mystery-card';b.disabled=busy||!can;
  if(lastMystery){b.textContent=lastMystery.reveal[i];if(lastMystery.pick===i)b.classList.add('picked');}else b.textContent='?';
  b.onclick=()=>{lastMystery=null;request('mystery',{bet:betValue(),pick:i});};return b;}));
 // Les dés
 $('dice-faces').replaceChildren(...[0,1].map(i=>Object.assign(document.createElement('span'),{textContent:lastDice?FACES[lastDice[i]-1]:'⚀'})));
 $('dice-picks').replaceChildren(...[['plus','Plus de 7'],['moins','Moins de 7'],['sept','Sept pile']].map(([id,label])=>{const b=document.createElement('button');b.className='secondary';b.disabled=busy||!can;
  b.innerHTML=`<b>${label}</b><small>× ${DICE_GAINS[id]}</small>`;b.onclick=()=>{$('dice-faces').classList.add('rolling');lastDice=null;request('dice',{bet:betValue(),choice:id});setTimeout(()=>$('dice-faces').classList.remove('rolling'),900);};return b;}));
}
// ---------- OUVERTURE DES BOOSTERS ----------
let openChoice=1,openSet='classic';
function renderSetPicker(){
 const el=$('set-picker');if(!el)return;
 const ev=activeEvent(Date.now()+offset);if(openSet==='event'&&!ev)openSet='classic';
 const opts=[['classic','Classique','147 cartes'],['cosmos','Cosmos ✦','200 cartes · nouvelles raretés']];if(ev)opts.push(['event',`${ev.emoji} ${ev.nom}`,'Événement limité · 12 cartes']);
 const key=opts.map(o=>o[0]).join();
 if(el.dataset.key!==key){el.dataset.key=key;el.replaceChildren(...opts.map(([id,nom,sub])=>{const b=document.createElement('button');b.dataset.set=id;b.innerHTML=`<b>${nom}</b><small>${sub}</small>`;b.onclick=()=>{openSet=id;renderSetPicker();};return b;}));}
 [...el.children].forEach(b=>b.classList.toggle('on',b.dataset.set===openSet));
 $('open').classList.toggle('cosmos-btn',openSet==='cosmos');
}
const available=()=>{if(!state)return 0;const interval=intervalFor(state),now=Date.now()+offset,added=Math.max(0,Math.floor((now-state.anchor)/interval));return Math.min(10,state.boosters+added)+(state.bonus||0);};
const openTarget=av=>openChoice==='all'?Math.min(MAX_OPEN,Math.max(1,av)):openChoice;
function renderOpenButton(av){
 const n=openTarget(av),need=Math.max(0,n-av);
 $('open').textContent=`Ouvrir ${n>1?n+' boosters':'un booster'}${need?` · ${need} jeton${need>1?'s':''}`:''} ↗`;
 $('open').disabled=busy||state.jetons<need;renderSetPicker();
 const picker=$('count-picker');
 if(!picker.children.length)picker.replaceChildren(...[1,3,5,10,'all'].map(v=>{const b=document.createElement('button');b.dataset.count=v;b.textContent=v==='all'?'Tout':'× '+v;b.onclick=()=>{openChoice=v;timer();};return b;}));
 [...picker.children].forEach(b=>{const v=b.dataset.count==='all'?'all':Number(b.dataset.count);b.classList.toggle('on',v===openChoice);b.disabled=busy||(v==='all'?av<1:v>av+Math.floor(state.jetons));});
}
// Animation : le paquet tremble puis se déchire. Mythique ou cristal : petite cinématique en plus. Cliquer = passer.
function playOpening(cards,count){
 const order=ALL_ORDER,best=cards.reduce((a,c)=>order.indexOf(c.rarete)>order.indexOf(a.rarete)?c:a,cards[0]);
 const big=BIG_RARETES.includes(best.rarete),ultime=best.rarete==='ultime',el=$('opening'),stage=el.querySelector('.op-stage');
 return new Promise(resolve=>{
  let done=false;const timers=[];
  const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
  const finish=()=>{if(done)return;done=true;timers.forEach(clearTimeout);el.hidden=true;el.className='';stage.replaceChildren();resolve();};
  el.hidden=false;el.className='';el.style.setProperty('--glow-color',ALL_RAR[best.rarete].couleur);if(best.cosmos)el.classList.add('is-cosmos');
  stage.innerHTML=`<div class="pack${best.cosmos?' cosmos-pack':''}"><div class="pack-half top"><b>CartEX</b></div><div class="pack-half bottom"><span>${count>1?'× '+count:'5 cartes'}</span></div></div><div class="flash"></div>`;
  $('op-skip').onclick=e=>{e.stopPropagation();finish();};el.onclick=finish;
  later(()=>el.classList.add('ripping'),450);
  if(!big){later(finish,950);return;}
  later(()=>{el.className='cinema '+best.rarete;stage.innerHTML=`<div class="cine-glow"></div><p class="cine-text">${ultime?'UNE CHANCE SUR 150 000…':'…'}</p>`;},900);
  later(()=>{el.classList.add('boom');const c=card(best,true,best.new);c.classList.add('cine-card');stage.replaceChildren(Object.assign(document.createElement('div'),{className:'flash'}),c,Object.assign(document.createElement('h2'),{className:'cine-name',textContent:`${ALL_RAR[best.rarete].label} · ${best.nom}`}));},ultime?3600:1900);
  later(finish,ultime?7600:3600);
 });
}
// ---------- ÉCHANGES ----------
let tradeFrom='commun',tradePicks={},tradeSet='classic';
const tcfg=()=>tradeSet==='cosmos'?{table:TRADES_COSMOS,pool:COSMOS,labels:COSMOS_RARETES,order:['astral','nova','pulsar','eclipse','singularite']}:{table:TRADES,pool:CARTES,labels:RARETES,order:['commun','rare','epique','legendaire','mythique']};
const dupsOf=id=>Math.max(0,(state.collection[id]||0)-1-(tradePicks[id]||0));
function renderTrade(){
 if(!$('trade-recipes'))return;
 const {table:TT,pool:PP,labels:LL,order}=tcfg();if(!TT[tradeFrom])tradeFrom=order[0];
 pickerRow($('trade-picker'),tradeSet,id=>{tradeSet=id;tradeFrom=tcfg().order[0];tradePicks={};$('trade-result').replaceChildren();renderTrade();},'200 cartes · l’Ultime ne s’échange pas');
 $('trade-recipes').replaceChildren(...order.map(k=>{const t=TT[k],b=document.createElement('button');b.className='theme-chip'+(tradeFrom===k?' on':'');
  const have=PP.filter(c=>c.rarete===k&&!state.locks?.[c.id]).reduce((a,c)=>a+Math.max(0,(state.collection[c.id]||0)-1),0);
  b.innerHTML=`<b>${t.need} ${LL[k].label}${t.need>1?'s':''}</b><small>→ 1 ${LL[t.to].label} · tu en as ${have}</small>`;
  b.onclick=()=>{tradeFrom=k;tradePicks={};$('trade-result').replaceChildren();renderTrade();};return b;}));
 const t=TT[tradeFrom],picked=Object.values(tradePicks).reduce((a,n)=>a+n,0);
 $('trade-title').textContent=`${t.need} ${LL[tradeFrom].label} → 1 ${LL[t.to].label}`;
 const slots=[];for(const [id,n] of Object.entries(tradePicks))for(let i=0;i<n;i++){const c=PP.find(x=>x.id===Number(id)),b=document.createElement('button');b.className='dup-tile picked';b.innerHTML=`<span>${c.emoji}</span><b>${c.nom}</b>`;b.title='Retirer';b.onclick=()=>{tradePicks[id]--;if(!tradePicks[id])delete tradePicks[id];renderTrade();};slots.push(b);}
 while(slots.length<t.need)slots.push(Object.assign(document.createElement('div'),{className:'dup-tile empty',textContent:'+'}));
 $('trade-slots').replaceChildren(...slots);
 $('trade-go').disabled=busy||picked!==t.need;$('trade-go').textContent=picked===t.need?'Échanger ↗':`Échanger (${picked} / ${t.need})`;
 const list=PP.filter(c=>c.rarete===tradeFrom&&!state.locks?.[c.id]&&dupsOf(c.id)>0);
 $('trade-dups').replaceChildren(...(list.length?list.map(c=>{const b=document.createElement('button');b.className='dup-tile';b.innerHTML=`<span>${c.emoji}</span><b>${c.nom}</b><small>× ${dupsOf(c.id)}</small>`;b.disabled=busy||picked>=t.need;b.onclick=()=>{tradePicks[c.id]=(tradePicks[c.id]||0)+1;renderTrade();};return b;}):[Object.assign(document.createElement('p'),{className:'empty',textContent:'Aucun doublon disponible dans cette rareté.'})]));
}
$('trade-go').onclick=()=>{if(!busy)request('trade',{from:tradeFrom,set:tradeSet,picks:{...tradePicks}});};
// ---------- ÉVÉNEMENT DU WEEK-END ----------
function frDate(d){const [y,m,j]=d.split('-');return `${j}/${m}`;}
function renderEvent(){
 const el=$('event'),now=Date.now()+offset,day=dayBonus(now),ev=activeEvent(now),nx=nextEvent(now);
 el.hidden=false;
 el.innerHTML=`<b>${day.icon} ${day.nom}</b> · ${day.desc}`+(ev?` <span class="ev-line"><b>${ev.emoji} Événement : ${ev.nom}</b> jusqu’au ${frDate(ev.end)} · booster limité dans l’onglet Boosters, cartes dans Collection ▸ Événements, race limitée dans Races.</span>`:nx?` <span class="ev-line">Prochain événement : <b>${nx.emoji} ${nx.nom}</b> dès le ${frDate(nx.start)}.</span>`:'');
}
function renderEvents(){
 if(!state||!$('e-list'))return;
 const now=Date.now()+offset,ev=activeEvent(now),own=EVENT_CARDS.filter(c=>state.collection[c.id]>0).length;
 $('e-count').textContent=`${own} / ${EVENT_CARDS.length} cartes d’événement · ${state.stats?.eventOpened||0} boosters ouverts`;
 $('e-sell').disabled=busy||!EVENT_CARDS.some(c=>state.collection[c.id]>1);
 $('e-note').textContent=ev?`${ev.emoji} ${ev.nom} est en cours jusqu’au ${frDate(ev.end)} : ouvre son booster limité dans l’onglet Boosters. Les cartes et races obtenues restent à toi pour toujours.`:'Aucun événement en cours. Les prochains arrivent bientôt : leurs cartes ne sont disponibles que pendant leurs dates.';
 $('e-list').replaceChildren(...EVENTS.map(e=>{
  const sec=document.createElement('section');const st=activeEvent(now)?.id===e.id?'En cours':e.end<new Date(now).toISOString().slice(0,10)?'Terminé':'À venir';
  const n=e.cartes.filter(c=>state.collection[c.id]>0).length,r=e.race,hasR=!!state.races?.owned?.[r.id];
  sec.className='event-block'+(st==='En cours'?' live':'');sec.style.setProperty('--accent',e.couleur);
  sec.innerHTML=`<h2 class="rarity-heading"><span>${e.emoji} ${e.nom}</span><small>${frDate(e.start)} → ${frDate(e.end)} · <b>${st}</b> · ${n} / ${e.cartes.length}</small></h2><p class="fine">Race limitée : ${hasR?`${r.emoji} <b>${r.nom}</b> (obtenue)`:'❓ à tirer pendant l’événement (8 % des tirages de race)'}</p>`;
  const grid=document.createElement('div');grid.className='grid';
  grid.append(...e.cartes.map(c=>{const el=card(c);if(state.collection[c.id]>0){const locked=!!state.locks?.[c.id],b=document.createElement('button');b.className='lock-btn'+(locked?' on':'');b.textContent=locked?'🔒':'🔓';b.title=locked?'Carte verrouillée':'Verrouiller cette carte';b.onclick=ev2=>{ev2.stopPropagation();request('lock',{id:c.id,locked:!locked});};el.append(b);if(locked)el.classList.add('is-locked');}return el;}));
  sec.append(grid);return sec;}));
}
$('e-sell').onclick=()=>request('sell',{set:'event'});
// ---------- PÊCHE ----------
let fishPhase='idle',fishTimers=[];
function fishClear(){fishTimers.forEach(clearTimeout);fishTimers=[];}
function renderFishInfo(){
 if(!state)return;
 const now=Date.now()+offset,f=normalizeFish(state.fish,now),left=FISH_INTERVAL-(now-f.anchor),mm=Math.floor(left/60000),ss=String(Math.floor(left%60000/1000)).padStart(2,'0');
 $('fish-info').textContent=f.casts>=FISH_MAX?`${f.casts} / ${FISH_MAX} lignes · gratuit`:`${f.casts} / ${FISH_MAX} lignes · prochaine dans ${mm}:${ss}`;
 if(fishPhase==='idle')$('fish-cast').disabled=busy||f.casts<1;
}
function fishEnd(hit){
 fishClear();fishPhase='idle';$('fish-cast').textContent='Lancer la ligne';$('fish-cast').disabled=true;
 request('fish',{hit}).finally(()=>{$('fish-scene').textContent='🎣';renderFishInfo();});
}
function renderFish(){
 renderFishInfo();
 $('fish-table').innerHTML=FISH_LOOT.map(x=>`<p><span>${x.emoji} ${x.nom}</span><b>${x.jetons?x.jetons+' ◉':x.diamants?x.diamants+' ◆':'rien'}</b></p>`).join('');
}
$('fish-cast').onclick=()=>{
 if(!state||busy)return;
 if(fishPhase==='idle'){
  fishPhase='wait';$('fish-scene').textContent='🌊';$('fish-msg').textContent='Attends que ça morde…';$('fish-cast').textContent='Ferrer !';
  fishTimers.push(setTimeout(()=>{fishPhase='bite';$('fish-scene').textContent='❗🐟';$('fish-msg').textContent='Ça mord ! Vite !';
   fishTimers.push(setTimeout(()=>{if(fishPhase==='bite')fishEnd(false);},1100));},1500+Math.random()*2500));
 }else if(fishPhase==='wait'){fishEnd(false);}
 else if(fishPhase==='bite'){fishEnd(true);}
};
setInterval(()=>{if(state)renderFishInfo();},1000);
// ---------- SUCCÈS ET CARTES SECRÈTES ----------
function renderAch(){
 const done=state.achievements||{},got=ACHIEVEMENTS.filter(a=>done[a.id]).length;
 $('ach-count').textContent=`${got} / ${ACHIEVEMENTS.length} succès débloqués`;
 const sorted=[...ACHIEVEMENTS].sort((a,b)=>(done[b.id]?1:0)-(done[a.id]?1:0));
 $('ach-list').replaceChildren(...sorted.map(a=>{
  const ok=!!done[a.id],hide=a.secret&&!ok,m=Math.min(a.metric(state),a.target),el=document.createElement('article');
  el.className='ach'+(ok?' done':'')+(hide?' secret':'');
  el.innerHTML=`<span class="ach-icon">${hide?'❔':a.icon}</span><div><h3>${hide?'Succès secret':a.nom}</h3><p>${hide?'À toi de le trouver…':a.desc}</p>${ok||hide||a.target<=1?'':`<div class="ach-bar"><i style="width:${Math.round(100*m/a.target)}%"></i></div><small>${m} / ${a.target}</small>`}</div><b class="ach-reward">${ok?'✓':`+${a.diamants} ◆`}${a.card?'<br>🃏':''}</b>`;
  return el;}));
 $('secret-cards').replaceChildren(...SECRETS.map(c=>{
  const found=!!state.secrets?.[c.id],el=card({...c,rarete:'secrete',secret:true},found);
  if(!found){const hint=document.createElement('p');hint.className='secret-hint';hint.textContent=c.indice;const wrap=document.createElement('div');wrap.className='secret-wrap';wrap.append(el,hint);return wrap;}
  return el;}));
}
let toastTimer=0;
function showToast(list){
 const el=$('toast');el.innerHTML=list.map(a=>`<div><span>${a.icon}</span><b>Succès : ${a.nom}</b><small>+${a.diamants} ◆${a.card?' · carte secrète !':''}</small></div>`).join('');
 el.hidden=false;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},4200);
}
let logoClicks=[];
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();const now=Date.now();logoClicks=logoClicks.filter(t=>now-t<3000);logoClicks.push(now);if(logoClicks.length>=7){logoClicks=[];if(state&&!state.stats?.egg)request('egg');}else tab('packs');});
// ---------- PROFIL ----------
function renderProfile(){
 const p=state.profile||{name:'',avatar:null,title:'debutant',theme:'foret',back:'classique'},level=levelInfo(state.xp).level;
 document.documentElement.dataset.theme=p.theme;document.documentElement.dataset.back=p.back;
 const av=[...CARTES,...COSMOS].find(c=>c.id===p.avatar),title=TITLES.find(t=>t.id===p.title)||TITLES[0];
 $('who-avatar').textContent=av?av.emoji:'🙂';$('who-name').textContent=p.name||'Joueur';$('who-title').textContent=title.nom;
 if(document.activeElement!==$('pf-name'))$('pf-name').value=p.name;
 const save=profile=>request('profile',{profile});
 const none=document.createElement('button');none.className='pf-avatar'+(p.avatar===null?' on':'');none.textContent='🙂';none.title='Aucun avatar';none.disabled=busy;none.onclick=()=>save({avatar:null});
 const found=[...CARTES,...COSMOS].filter(c=>state.collection[c.id]>0).map(c=>{const b=document.createElement('button');b.className='pf-avatar'+(p.avatar===c.id?' on':'');b.textContent=c.emoji;b.title=c.nom;b.disabled=busy;b.onclick=()=>save({avatar:c.id});return b;});
 $('pf-avatars').replaceChildren(none,...found);
 $('pf-titles').replaceChildren(...TITLES.map(t=>{const ok=t.ok(state),b=document.createElement('button');b.className='pf-title'+(p.title===t.id?' on':'');b.disabled=busy||!ok;
  b.innerHTML=`<b>${ok?'':'🔒 '}${t.nom}</b><small>${t.cond}</small>`;b.onclick=()=>save({title:t.id});return b;}));
 $('pf-themes').replaceChildren(...THEMES.map(t=>{const ok=themeUnlocked(state,t),b=document.createElement('button');b.className='pf-opt'+(p.theme===t.id?' on':'');b.disabled=busy||!ok;
  b.innerHTML=`<i style="background:${t.couleur}"></i><b>${t.nom}</b><small>${ok?'':'🔒 '+(t.cond||'Niv. '+t.niveau)}</small>`;b.onclick=()=>save({theme:t.id});return b;}));
 $('pf-backs').replaceChildren(...BACKS.map(t=>{const ok=t.ok(state),b=document.createElement('button');b.className='pf-opt'+(p.back===t.id?' on':'');b.disabled=busy||!ok;
  b.innerHTML=`<i class="back-prev back-${t.id}"></i><b>${t.nom}</b><small>${ok?'':'🔒 '+t.cond}</small>`;b.onclick=()=>save({back:t.id});return b;}));
 const st=state.stats||{},order=Object.keys(RARETES),owned=CARTES.filter(c=>state.collection[c.id]>0);
 const cOwned=COSMOS.filter(c=>state.collection[c.id]>0),cRarest=cOwned.reduce((a,c)=>!a||ALL_ORDER.indexOf(c.rarete)>ALL_ORDER.indexOf(a.rarete)?c:a,null);
 const rarest=owned.reduce((a,c)=>!a||order.indexOf(c.rarete)>order.indexOf(a.rarete)?c:a,null),played=(st.wins||0)+(st.losses||0);
 const rows=[['Niveau',level],['Cartes découvertes',`${owned.length} / ${CARTES.length}`],['Cartes obtenues au total',st.cards||0],['Carte la plus rare',rarest?`${RARETES[rarest.rarete].label} · ${rarest.nom}`:'—'],['Cartes Cosmos découvertes',`${cOwned.length} / ${COSMOS.length}`],['Carte Cosmos la plus rare',cRarest?`${COSMOS_RARETES[cRarest.rarete].label} · ${cRarest.nom}`:'—'],['Boosters Cosmos ouverts',st.cosmosOpened||0],['Boosters Événement ouverts',st.eventOpened||0],['Cartes d’événement',`${EVENT_CARDS.filter(c=>state.collection[c.id]>0).length} / ${EVENT_CARDS.length}`],['Doublons Cosmos en stock',COSMOS.reduce((a,c)=>a+Math.max(0,(state.collection[c.id]||0)-1),0)],['Cartes foil',Object.keys(state.foils||{}).length],['Boosters ouverts',st.opened||0],['Doublons vendus',st.sold||0],['Races obtenues',`${Object.keys(state.races?.owned||{}).length} / ${RACES.length}`],
  ['Parties de casino',st.casino||0],['Parties gagnées',st.wins||0],['Parties perdues',st.losses||0],['Taux de victoire',played?`${Math.round(100*(st.wins||0)/played)} %`:'—'],['Jetons gagnés au casino',format(st.gained||0)],['Jetons perdus au casino',format(st.lost||0)],['Plus gros gain d’un coup',format(st.bigWin||0)],['Plus grosse perte d’un coup',format(st.bigLoss||0)],
  ['Jours de connexion d’affilée',st.streak||0],['Record de série',st.bestStreak||0],
  ['Échanges réussis',st.trades||0],['Poissons pêchés',st.fishCaught||0],['Coffres trouvés',st.chest||0],['Lignes lancées',st.fish||0],['Quêtes récupérées',st.claims||0],['Meilleure série de défaites',st.lossBest||0],['Cartes verrouillées 🔒',Object.keys(state.locks||{}).length],['Diamants en poche',state.diamants||0],['Titres débloqués',`${TITLES.filter(t=>t.ok(state)).length} / ${TITLES.length}`],['Thèmes débloqués',`${THEMES.filter(t=>themeUnlocked(state,t)).length} / ${THEMES.length}`],['Dos de cartes débloqués',`${BACKS.filter(t=>t.ok(state)).length} / ${BACKS.length}`]];

 const per=['commun','rare','epique','legendaire','mythique','cristal'].map(k=>{const all=CARTES.filter(c=>c.rarete===k),n=all.filter(c=>state.collection[c.id]>0).length;return `<p class="bar-row"><span><i style="background:${RARETES[k].couleur}"></i>${RARETES[k].label}</span><b>${n} / ${all.length}</b><em><u style="width:${Math.round(100*n/all.length)}%;background:${RARETES[k].couleur}"></u></em></p>`;}).join('');
 const cper=Object.keys(COSMOS_RARETES).map(k=>{const all=COSMOS.filter(c=>c.rarete===k),n=all.filter(c=>state.collection[c.id]>0).length,col=COSMOS_RARETES[k].couleur;return `<p class="bar-row"><span><i style="background:${col}"></i>${COSMOS_RARETES[k].label}</span><b>${n} / ${all.length}</b><em><u style="width:${Math.round(100*n/all.length)}%;background:${col}"></u></em></p>`;}).join('');
 const pct=Math.round(100*owned.length/CARTES.length),themesDone=COLLECTIONS.filter(c=>c.ids.every(id=>state.collection[id]>0)).length;
 $('pf-stats').innerHTML=`<p><span>Complétion globale</span><b>${pct} %</b></p><p><span>Collections thématiques terminées</span><b>${themesDone} / ${COLLECTIONS.length}</b></p><p><span>Succès débloqués</span><b>${Object.keys(state.achievements||{}).length} / ${ACHIEVEMENTS.length}</b></p><p><span>Cartes secrètes</span><b>${Object.keys(state.secrets||{}).length} / ${SECRETS.length}</b></p>`+rows.map(([k,v])=>`<p><span>${k}</span><b>${v}</b></p>`).join('')+'<h3 class="pf-sub">Complétion par rareté</h3>'+per+'<h3 class="pf-sub">Complétion Cosmos</h3>'+cper;
}
$('pf-name').onchange=()=>{if(state)request('profile',{profile:{name:$('pf-name').value}});};
function announceLevel(ups){
 const top=ups.at(-1),boosters=ups.length,jetons=ups.reduce((a,u)=>a+u.jetons,0),dia=ups.reduce((a,u)=>a+(u.diamants||0),0),el=$('levelup');
 el.innerHTML=`<span class="eyebrow">NIVEAU SUPÉRIEUR</span><strong>Niveau ${top.level}</strong><span>+${boosters} booster${boosters>1?'s':''} bonus${jetons?` · +${jetons} jetons`:''} · +${dia} diamants</span>`;
 try{if(el.showPopover){if(el.matches(':popover-open'))el.hidePopover();el.showPopover();}}catch{}
 el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
 celebrate('win');
 clearTimeout(levelTimer);levelTimer=setTimeout(()=>{try{if(el.hidePopover&&el.matches(':popover-open'))el.hidePopover();}catch{}el.classList.remove('show');},3400);
}
function renderQuests(){
 const d=state.daily;if(!d)return;
 $('quest-list').replaceChildren(...questDefinitions.map((q,i)=>{
 const value=Math.min(q.target,d.progress[q.id]||0),claimed=d.claimed.includes(q.id),done=value===q.target;
 const row=document.createElement('article');row.className=`quest${claimed?' completed':''}`;
 row.innerHTML=`<span class="quest-number">0${i+1}</span><div class="quest-content"><h2>${q.label}</h2><progress max="${q.target}" value="${value}" aria-label="${q.label}"></progress><span class="fine">${value} / ${q.target}</span></div><div class="quest-reward"><strong>+${format(q.reward)} jeton</strong><span class="fine">+${XP.claim} XP</span><button class="${done&&!claimed?'primary':'secondary'}" data-claim="${q.id}">${claimed?'Récupéré ✓':done?'Récupérer':'En cours'}</button></div>`;
 const button=row.querySelector('button');button.disabled=busy||claimed||!done;button.onclick=()=>request('claim',{quest:q.id});return row;
 }));
 const ready=questDefinitions.filter(q=>d.progress[q.id]>=q.target&&!d.claimed.includes(q.id)).length;
 $('quest-badge').textContent=ready||'';
 updateQuestClock();
}
function updateQuestClock(){if(!state?.daily)return;const now=Date.now()+offset;const remaining=Math.max(0,Math.ceil((new Date(state.daily.day+'T00:00:00Z').getTime()+86400000-now)/1000));$('quest-reset').textContent=remaining?`Renouvellement dans ${Math.floor(remaining/3600)} h ${String(Math.floor(remaining%3600/60)).padStart(2,'0')} min · UTC`:'Nouvelles quêtes disponibles';if(!remaining&&!busy)request('sync');}
$('close-pack').onclick=$('keep-cards').onclick=()=>$('pack-dialog').close();
$('pack-dialog').addEventListener('click',e=>{if(e.target===$('pack-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
request('sync');setInterval(()=>{timer();updateQuestClock();},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)request('sync');});
