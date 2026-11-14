import { CARTES, RARETES } from './catalog.mjs?v=5';
export const INTERVAL = 15*60*1000;
export function initial(now = Date.now(), legacy = {}) {
  const collection = {};
  for (const card of CARTES) {
    const count = legacy.collection?.[card.id];
    if (Number.isSafeInteger(count) && count > 0) collection[card.id] = Math.min(count, 100000);
  }
  const jetons = Number.isFinite(legacy.jetons) && legacy.jetons >= 0 ? Math.min(legacy.jetons, 100000) : 1;
  const oldDue = Number.isFinite(legacy.prochainJeton) ? legacy.prochainJeton : 0;
  return {collection,jetons,boosters:1,xp:0,bonus:0,anchor:oldDue > 0 ? Math.min(now,oldDue-20*60*1000) : now};
}
// ---------- NIVEAUX ET XP ----------
// XP gagnée : un booster ouvert, une partie de casino, une quête récupérée.
export const XP = {open:10, casino:4, claim:25};
export const MAX_LEVEL = 100;
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
    if (jetons) state.jetons = Math.round((state.jetons + jetons) * 100) / 100;
    ups.push({level, boosters: 1, jetons});
  }
  return ups;
}
export function accrue(state, now = Date.now()) {
  const elapsed = Math.max(0, Math.floor((now-state.anchor)/INTERVAL));
  if (state.boosters >= 10 || state.boosters+elapsed >= 10) { state.boosters=10; state.anchor=now; }
  else if (elapsed) { state.boosters+=elapsed; state.anchor+=elapsed*INTERVAL; }
  return state;
}
export function draw(random = Math.random) {
  let roll = random()*Object.values(RARETES).reduce((a,r)=>a+r.chance,0);
  for (const [key, rarity] of Object.entries(RARETES)) {
    roll-=rarity.chance;
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
  const addCard=()=>{ const card=draw(random); result.cards.push({...card,new:!state.collection[card.id]}); state.collection[card.id]=(state.collection[card.id]||0)+1; quests.progress.cards=Math.min(10,quests.progress.cards+1); };
  if (body.action==='open') {
    if(state.boosters>0) state.boosters--; else if(state.bonus>0) state.bonus--; else if(state.jetons>=1) state.jetons=Math.round((state.jetons-1)*100)/100; else throw Error('Aucun booster ni jeton disponible.');
    for(let i=0;i<5;i++) addCard();
    quests.progress.packs=Math.min(2,quests.progress.packs+1);
    result.message='Cinq nouvelles découvertes.'; xpGain=XP.open;
  } else if(body.action==='sell') {
    let sold=0;
    for(const card of CARTES) if(body.id===undefined || body.id===card.id) { const n=Math.max(0,(state.collection[card.id]||0)-1); if(n){ state.collection[card.id]=1; sold+=n; } }
    state.jetons=Math.round((state.jetons+sold*0.05)*100)/100;
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
  } else if(body.action!=='sync') throw Error('Action inconnue.');
  let levelUps=[];
  if(xpGain){ levelUps=gainXp(state,xpGain); result.xpGain=xpGain; if(levelUps.length) result.message+=` Niveau ${levelUps.at(-1).level} atteint !`; }
  return {state,...result,levelUps,quests:QUESTS,serverTime:now};
}
