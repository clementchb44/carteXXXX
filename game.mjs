import { CARTES, RARETES } from './catalog.mjs?v=9';
export const INTERVAL = 15*60*1000;
export function initial(now = Date.now(), legacy = {}) {
  const collection = {};
  for (const card of CARTES) {
    const count = legacy.collection?.[card.id];
    if (Number.isSafeInteger(count) && count > 0) collection[card.id] = Math.min(count, 100000);
  }
  const jetons = Number.isFinite(legacy.jetons) && legacy.jetons >= 0 ? Math.min(legacy.jetons, 100000) : 1;
  const oldDue = Number.isFinite(legacy.prochainJeton) ? legacy.prochainJeton : 0;
  return {collection,jetons,boosters:1,xp:0,bonus:0,races:{owned:{},equipped:null,rolls:0,free:1},diamants:0,boosts:{xp:0,luck:0},anchor:oldDue > 0 ? Math.min(now,oldDue-20*60*1000) : now};
}
// ---------- NIVEAUX ET XP ----------
// XP gagnée : un booster ouvert, une partie de casino, une quête récupérée.
export const XP = {open:10, casino:4, claim:25, race:6};
export const MAX_LEVEL = 100;
export const DIAMONDS_PER_LEVEL = 2;
// XP nécessaire pour passer du niveau "level" au suivant : ça augmente à chaque niveau.
export const xpNeeded = level => 50 + 30*(level-1) + 5*(level-1)**2;
export function levelInfo(xp = 0) {
  let level = 1, left = Math.max(0, Math.floor(xp));
  while (level < MAX_LEVEL && left >= xpNeeded(level)) { left -= xpNeeded(level); level++; }
  return {level, into: level >= MAX_LEVEL ? 0 : left, need: level >= MAX_LEVEL ? 0 : xpNeeded(level)};
}
// Ajoute de l'XP et donne les récompenses : 1 booster bonus par niveau, +2 jetons tous les 5 niveaux.
export function gainXp(state, amount) {
  const before = levelInfo(state.xp).level;
  state.xp = Math.max(0, Math.floor(state.xp || 0)) + amount;
  const after = levelInfo(state.xp).level;
  const ups = [];
  for (let level = before + 1; level <= after; level++) {
    const jetons = level % 5 === 0 ? 2 : 0;
    state.bonus = (state.bonus || 0) + 1;
    state.diamants = (state.diamants || 0) + DIAMONDS_PER_LEVEL;
    if (jetons) state.jetons = Math.round((state.jetons + jetons) * 100) / 100;
    ups.push({level, boosters: 1, jetons, diamants: DIAMONDS_PER_LEVEL});
  }
  return ups;
}
// ---------- LA BOUTIQUE ----------
// Les jetons (◉) paient le booster Rare+, les diamants (◆) gagnés à chaque niveau paient les objets forts.
export const SHOP_LUCK = 0.5;
export const SHOP = [
  {id:'rare',   nom:'Booster Rare+',        desc:'5 cartes, toutes rares ou mieux.',                       prix:3, monnaie:'jetons'},
  {id:'epique', nom:'Booster Épique+',      desc:'1 carte épique ou mieux, les 4 autres rares ou mieux.',  prix:6, monnaie:'diamants'},
  {id:'xp',     nom:'Double XP · 30 min',   desc:'Tout ce que tu gagnes en XP est doublé.',                prix:3, monnaie:'diamants'},
  {id:'chance', nom:'Chance +50 % · 1 h',   desc:'Plus de cartes rares dans tes boosters.',                prix:4, monnaie:'diamants'},
  {id:'race',   nom:'Tirage de race Rare+', desc:'Un tirage de race garanti rare ou mieux.',               prix:5, monnaie:'diamants'},
];
// ---------- RÉCOMPENSE QUOTIDIENNE ----------
// Une récompense par jour (changement de jour à minuit UTC, comme les quêtes). Série de 7 jours, puis ça recommence.
// Si tu rates un jour, la série repart à zéro.
export const DAILY_REWARDS = [
  {jetons:1}, {jetons:1}, {diamants:1}, {jetons:2}, {diamants:2}, {boosters:2}, {jetons:3, diamants:4, boosters:1},
];
const dayOf = t => new Date(t).toISOString().slice(0,10);
export function dailyStatus(state, now = Date.now()) {
  const today = dayOf(now), yesterday = dayOf(now-86400000), d = state.dailyReward || {last:null,streak:0};
  const claimed = d.last === today;
  const streak = claimed || d.last === yesterday ? d.streak : 0;
  const nextIndex = (claimed ? streak : streak) % 7; // case du jour (si pas encore récupérée) ou de demain
  return {claimed, streak, nextIndex, today};
}
// ---------- LES RACES ----------
// Une seule race équipée à la fois. Chaque race donne un ou plusieurs avantages :
//  speed  = boosters gratuits plus rapides (+0,5 = 50 % plus rapides)
//  luck   = plus de chances d'avoir des cartes rares, épiques, légendaires...
//  resale = les doublons se revendent plus cher
// chance = % de chances de tomber sur cette race quand on en tire une (le total fait 100)
export const RACE_COST = 2;      // un tirage de race coûte 2 jetons (le premier est offert)
export const RACE_REFUND = 0.5;  // si tu retombes sur une race que tu as déjà, 0,5 jeton te revient
export const RACES = [
  {id:'humain',     nom:'Humain',     emoji:'🧑', rarete:'commun',     chance:30, speed:.05},
  {id:'nain',       nom:'Nain',       emoji:'⛏️', rarete:'commun',     chance:15, resale:.10},
  {id:'gnome',      nom:'Gnome',      emoji:'🍄', rarete:'commun',     chance:15, luck:.03},
  {id:'elfe',       nom:'Elfe',       emoji:'🧝', rarete:'rare',       chance:12, speed:.10},
  {id:'orc',        nom:'Orc',        emoji:'🪓', rarete:'rare',       chance:7,  resale:.20},
  {id:'sirene',     nom:'Sirène',     emoji:'🧜', rarete:'rare',       chance:6,  luck:.08},
  {id:'vampire',    nom:'Vampire',    emoji:'🧛', rarete:'epique',     chance:6,  luck:.15, resale:.08},
  {id:'ange',       nom:'Ange',       emoji:'😇', rarete:'epique',     chance:4,  speed:.15, resale:.10},
  {id:'dragonnide', nom:'Dragonnide', emoji:'🐲', rarete:'legendaire', chance:3,  speed:.20, luck:.12},
  {id:'titan',      nom:'Titan',      emoji:'🗿', rarete:'legendaire', chance:1,  speed:.12, luck:.15, resale:.30},
  {id:'divinite',   nom:'Divinité',   emoji:'🌌', rarete:'mythique',   chance:1,  speed:.30, luck:.25, resale:.50},
];
export function drawRace(random = Math.random, minRarity = 'commun') {
  const order = Object.keys(RARETES), pool = RACES.filter(r => order.indexOf(r.rarete) >= order.indexOf(minRarity));
  let roll = random()*pool.reduce((a,r)=>a+r.chance,0);
  for (const race of pool) { roll-=race.chance; if (roll < 0) return race; }
  return pool[0];
}
export function normalizeRaces(races) {
  const r = races && typeof races === 'object' ? races : {owned:{},equipped:null,rolls:0,free:1};
  const owned = {};
  for (const race of RACES) { const n = r.owned?.[race.id]; if (Number.isSafeInteger(n) && n > 0) owned[race.id] = Math.min(n, 100000); }
  return {owned, equipped: owned[r.equipped] ? r.equipped : null, rolls: Math.max(0, Math.floor(r.rolls||0)), free: Number.isFinite(r.free) ? Math.max(0, Math.floor(r.free)) : 1};
}
// Les avantages de la race équipée
export function bonusOf(state, now = Date.now()) {
  const race = RACES.find(r => r.id === state.races?.equipped);
  const luckBoost = (state.boosts?.luck||0) > now ? SHOP_LUCK : 0;
  return {speed: race?.speed||0, luck: (race?.luck||0)+luckBoost, resale: race?.resale||0, race};
}
// Durée entre deux boosters gratuits (plus courte avec une race rapide)
export function intervalFor(state) { return INTERVAL / (1 + bonusOf(state).speed); }

export function accrue(state, now = Date.now()) {
  const interval = intervalFor(state);
  const elapsed = Math.max(0, Math.floor((now-state.anchor)/interval));
  if (state.boosters >= 10 || state.boosters+elapsed >= 10) { state.boosters=10; state.anchor=now; }
  else if (elapsed) { state.boosters+=elapsed; state.anchor+=elapsed*interval; }
  return state;
}
export function draw(random = Math.random, luck = 0, minRarity = 'commun') {
  const order = Object.keys(RARETES), min = order.indexOf(minRarity);
  const weight = (key, rarity) => order.indexOf(key) < min ? 0 : key === 'commun' ? rarity.chance : rarity.chance*(1+luck);
  let roll = random()*Object.entries(RARETES).reduce((a,[key,r])=>a+weight(key,r),0);
  for (const [key, rarity] of Object.entries(RARETES)) {
    roll-=weight(key,rarity);
    if (roll < 0) { const pool=CARTES.filter(c=>c.rarete===key); return pool[Math.floor(random()*pool.length)]; }
  }
  return CARTES.at(-1);
}
export const QUESTS = [
  {id:'packs',label:'Ouvrir 2 boosters',target:2,reward:0.5},
  {id:'cards',label:'Obtenir 10 cartes',target:10,reward:0.5},
  {id:'sell',label:'Vendre 3 doublons',target:3,reward:0.5},
];
export function daily(state, now) {
  const day = new Date(now).toISOString().slice(0,10);
  if (state.daily?.day !== day) state.daily = {day,progress:{packs:0,cards:0,sell:0},claimed:[]};
  return state.daily;
}
export function action(state, body, now=Date.now(), random=Math.random) {
  accrue(state,now);
  const quests=daily(state,now);
  const result={cards:[],message:''};
  state.xp=Math.max(0,Math.floor(state.xp||0)); state.bonus=Math.max(0,Math.floor(state.bonus||0)); let xpGain=0;
  state.races=normalizeRaces(state.races);
  state.diamants=Math.max(0,Math.floor(state.diamants||0));
  state.boosts={xp:Number(state.boosts?.xp)||0,luck:Number(state.boosts?.luck)||0};
  const bonus=bonusOf(state,now);
  const addCard=(min='commun')=>{ const card=draw(random,bonus.luck,min); result.cards.push({...card,new:!state.collection[card.id]}); state.collection[card.id]=(state.collection[card.id]||0)+1; quests.progress.cards=Math.min(10,quests.progress.cards+1); };
  if (body.action==='open') {
    if(state.boosters>0) state.boosters--; else if(state.bonus>0) state.bonus--; else if(state.jetons>=1) state.jetons=Math.round((state.jetons-1)*100)/100; else throw Error('Aucun booster ni jeton disponible.');
    for(let i=0;i<5;i++) addCard();
    quests.progress.packs=Math.min(2,quests.progress.packs+1);
    result.message='Cinq nouvelles découvertes.'; xpGain=XP.open;
  } else if(body.action==='sell') {
    let sold=0;
    for(const card of CARTES) if(body.id===undefined || body.id===card.id) { const n=Math.max(0,(state.collection[card.id]||0)-1); if(n){ state.collection[card.id]=1; sold+=n; } }
    state.jetons=Math.round((state.jetons+sold*0.05*(1+bonus.resale))*100)/100;
    quests.progress.sell=Math.min(3,quests.progress.sell+sold);
    result.message=`${sold} doublon(s) vendu(s).`;
  } else if(body.action==='casino') {
    const bet=body.bet;
    if(![0.25,0.5,1,2,5].includes(bet)) throw Error('Choisis une mise proposée.');
    if(state.jetons<bet) throw Error('Pas assez de jetons pour cette mise.');
    state.jetons=Math.round((state.jetons-bet)*100)/100;
    const roll=random();
    if(roll<0.10) { state.jetons+=bet*5; result.message=`Jackpot ! ${bet*5} jetons gagnés.`; result.symbols=['✦','✦','✦']; }
    else if(roll<0.35) { state.jetons+=bet*2; result.message=`${bet*2} jeton(s) gagnés !`; result.symbols=['◈','◈','◈']; }
    else if(roll<0.50) { addCard(); result.message='Une carte rejoint ta collection !'; result.symbols=['❖','❖','❖']; }
    else { result.message=`Cette fois, tu perds ta mise de ${bet} jeton(s).`; result.symbols=['✦','◈','❖']; }
    state.jetons=Math.round(state.jetons*100)/100; xpGain=XP.casino;
  } else if(body.action==='claim') {
    const quest=QUESTS.find(q=>q.id===body.quest);
    if(!quest || quests.progress[quest.id]<quest.target || quests.claimed.includes(quest.id)) throw Error('Quête indisponible.');
    quests.claimed.push(quest.id);
    state.jetons=Math.round((state.jetons+quest.reward)*100)/100;
    result.message=`+${quest.reward} jeton : récompense récupérée !`; xpGain=XP.claim;
  } else if(body.action==='race') {
    const rs=state.races;
    if(rs.free>0) rs.free--;
    else { if(state.jetons<RACE_COST) throw Error(`Il faut ${RACE_COST} jetons pour tirer une race.`); state.jetons=Math.round((state.jetons-RACE_COST)*100)/100; }
    const race=drawRace(random), isNew=!rs.owned[race.id];
    rs.owned[race.id]=(rs.owned[race.id]||0)+1; rs.rolls++;
    if(!rs.equipped) rs.equipped=race.id;
    if(!isNew) state.jetons=Math.round((state.jetons+RACE_REFUND)*100)/100;
    result.race={...race,new:isNew};
    result.message=isNew?`Nouvelle race : ${race.nom} !`:`${race.nom}, déjà connue : ${RACE_REFUND} jeton remboursé.`;
    xpGain=XP.race;
  } else if(body.action==='buy') {
    const item=SHOP.find(i=>i.id===body.item);
    if(!item) throw Error('Objet inconnu.');
    if(item.monnaie==='jetons'){ if(state.jetons<item.prix) throw Error('Pas assez de jetons.'); state.jetons=Math.round((state.jetons-item.prix)*100)/100; }
    else { if(state.diamants<item.prix) throw Error('Pas assez de diamants.'); state.diamants-=item.prix; }
    if(item.id==='rare'||item.id==='epique'){
      for(let i=0;i<5;i++) addCard(item.id==='epique'&&i===0?'epique':'rare');
      quests.progress.packs=Math.min(2,quests.progress.packs+1);
      result.message=`${item.nom} ouvert !`; xpGain=XP.open;
    } else if(item.id==='xp'){ state.boosts.xp=Math.max(state.boosts.xp,now)+30*60*1000; result.message='Double XP activé pour 30 minutes !'; }
    else if(item.id==='chance'){ state.boosts.luck=Math.max(state.boosts.luck,now)+60*60*1000; result.message='Chance +50 % activée pour 1 heure !'; }
    else if(item.id==='race'){
      const rs=state.races, race=drawRace(random,'rare'), isNew=!rs.owned[race.id];
      rs.owned[race.id]=(rs.owned[race.id]||0)+1; rs.rolls++;
      if(!rs.equipped) rs.equipped=race.id;
      if(!isNew) state.jetons=Math.round((state.jetons+RACE_REFUND)*100)/100;
      result.race={...race,new:isNew}; result.message=isNew?`Nouvelle race : ${race.nom} !`:`${race.nom}, déjà connue : ${RACE_REFUND} jeton remboursé.`; xpGain=XP.race;
    }
  } else if(body.action==='daily') {
    const st=dailyStatus(state,now);
    if(st.claimed) throw Error('Récompense du jour déjà récupérée.');
    const streak=st.streak+1, reward=DAILY_REWARDS[(streak-1)%7];
    state.dailyReward={last:st.today,streak};
    if(reward.jetons) state.jetons=Math.round((state.jetons+reward.jetons)*100)/100;
    if(reward.diamants) state.diamants+=reward.diamants;
    if(reward.boosters) state.bonus+=reward.boosters;
    result.reward=reward; result.message=`Récompense du jour récupérée ! Série : ${streak} jour${streak>1?'s':''}.`;
  } else if(body.action==='equip') {
    const race=RACES.find(r=>r.id===body.race);
    if(!race || !state.races.owned[race.id]) throw Error('Race indisponible.');
    state.races.equipped=race.id;
    result.message=`${race.nom} équipée.`;
  } else if(body.action!=='sync') throw Error('Action inconnue.');
  let levelUps=[];
  if(xpGain&&state.boosts.xp>now) xpGain*=2;
  if(xpGain){ levelUps=gainXp(state,xpGain); result.xpGain=xpGain; if(levelUps.length) result.message+=` Niveau ${levelUps.at(-1).level} atteint !`; }
  return {state,...result,levelUps,quests:QUESTS,serverTime:now};
}
