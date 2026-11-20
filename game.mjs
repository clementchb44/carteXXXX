import { CARTES, RARETES } from './catalog.mjs?v=32';
import { COSMOS, COSMOS_RARETES, ULTIME_CHANCE, COSMOS_COLLECTIONS } from './cosmos.mjs?v=32';
import { MULTI, MULTI_RARETES, MULTI_COLLECTIONS, FROMAGE_CHANCE, CROCO_CHANCE } from './multi.mjs?v=32';
import { EVENTS, EVENT_CARDS, EVENT_RACES, EVENT_RACE_CHANCE, activeEvent, nextEvent, dayBonus, DAY_BONUS, parisDay } from './events.mjs?v=32';
export const INTERVAL = 15*60*1000;      // un booster gratuit toutes les 15 minutes
export const MAX_RESERVE = 10;             // réserve maximale de boosters gratuits
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
export const XP = {open:10, casino:3, claim:25, race:6, fish:2, trade:5};
export const MAX_LEVEL = 100;
export const CASINO_XP_CAP = 30;   // XP maximum gagnée au casino par jour
export const MAX_OPEN = 30;
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
  {id:'rare',   nom:'Booster Rare+',        desc:'5 cartes, toutes rares ou mieux (Nova+ en Cosmos).',                       prix:5, monnaie:'jetons'},
  {id:'epique', nom:'Booster Épique+',      desc:'1 carte épique ou mieux, les 4 autres rares ou mieux (Pulsar+ / Nova+ en Cosmos).',  prix:8, monnaie:'diamants'},
  {id:'xp',     nom:'Double XP · 30 min',   desc:'Tout ce que tu gagnes en XP est doublé.',                prix:3, monnaie:'diamants'},
  {id:'chance', nom:'Chance +50 % · 1 h',   desc:'Plus de cartes rares dans tes boosters.',                prix:4, monnaie:'diamants'},
  {id:'decouverte', nom:'Pack Découverte',   desc:'5 cartes, dont une nouvelle à coup sûr (sauf les cartes ultra-rares). 2 par jour, dans la collection de ton choix.', prix:1, monnaie:'diamants'},
  {id:'race',   nom:'Tirage de race Rare+', desc:'Un tirage de race garanti rare ou mieux.',               prix:5, monnaie:'diamants'},
];
// Prix de revente d'un doublon (en jetons), selon la rareté
export const SELL_VALUES = {commun:0.01, rare:0.02, epique:0.04, legendaire:0.15, mythique:0.3, cristal:1};
// ---------- CASINO : LES AUTRES JEUX ----------
// Tous les jeux sont perdants à la longue (on récupère moins de 100 % de la mise en moyenne) et on gagne moins d'une fois sur deux.
export const BETS = [0.25,0.5,1,2,5];
// La bombe : 9 cases dont 5 bombes. Chaque case sûre fait monter le gain, une bombe fait tout perdre.
export const BOMB_CELLS = 9, BOMB_BOMBS = 5;
export const BOMB_MULTS = [2, 4, 10, 20];   // gain (× la mise) après 1, 2, 3, 4 cases sûres
// La course d'animaux : un seul gagnant, le plus lent paie le plus.
export const ANIMALS = [
  {id:'lievre',   nom:'Lièvre',   emoji:'🐇', chance:30, gain:2.6},
  {id:'chat',     nom:'Chat',     emoji:'🐈', chance:25, gain:3.2},
  {id:'chien',    nom:'Chien',    emoji:'🐕', chance:20, gain:4},
  {id:'tortue',   nom:'Tortue',   emoji:'🐢', chance:15, gain:5},
  {id:'escargot', nom:'Escargot', emoji:'🐌', chance:10, gain:8},
];
// La carte mystère : 3 cartes, 1 seul trésor.
export const MYSTERY_GAIN = 2.4;
// Les dés : deux dés, on parie sur la somme.
export const DICE_GAINS = {plus:1.9, moins:1.9, sept:4.8};
// ---------- PROFIL : TITRES, THÈMES, DOS DE CARTES, CARTES FOIL ----------
const discovered = s => CARTES.filter(c => s.collection[c.id] > 0).length;
const owns = (s, rarete) => CARTES.some(c => c.rarete === rarete && s.collection[c.id] > 0);
const cDisc = s => COSMOS.filter(c => s.collection[c.id] > 0).length;
const cOwns = (s, rarete) => COSMOS.some(c => c.rarete === rarete && s.collection[c.id] > 0);
export const TITLES = [
  {id:'debutant',       nom:'Débutant',            cond:'Disponible dès le départ',        ok:()=>true},
  {id:'collectionneur', nom:'Collectionneur',      cond:'Découvrir 25 cartes',             ok:s=>discovered(s)>=25},
  {id:'grand',          nom:'Grand collectionneur',cond:'Découvrir 75 cartes',             ok:s=>discovered(s)>=75},
  {id:'completiste',    nom:'Complétiste',         cond:'Découvrir toutes les cartes',     ok:s=>discovered(s)>=CARTES.length},
  {id:'casino',         nom:'Roi du casino',       cond:'Jouer 50 parties de casino',      ok:s=>(s.stats?.casino||0)>=50},
  {id:'chanceux',       nom:'Chanceux',            cond:'Obtenir une carte mythique ou cristal', ok:s=>owns(s,'mythique')||owns(s,'cristal')},
  {id:'cristallin',     nom:'Cristallin',          cond:'Obtenir les 3 cartes cristal',    ok:s=>CARTES.filter(c=>c.rarete==='cristal').every(c=>s.collection[c.id]>0)},
  {id:'marchand',       nom:'Marchand',            cond:'Vendre 50 doublons',              ok:s=>(s.stats?.sold||0)>=50},
  {id:'heritier',       nom:'Héritier',            cond:'Obtenir 6 races différentes',     ok:s=>Object.keys(s.races?.owned||{}).length>=6},
  {id:'divin',          nom:'Divin',               cond:'Obtenir la race Divinité',        ok:s=>!!s.races?.owned?.divinite},
  {id:'dore',           nom:'Doré',                cond:'Obtenir une carte foil',          ok:s=>Object.keys(s.foils||{}).length>0},
  {id:'veteran',        nom:'Vétéran',             cond:'Atteindre le niveau 10',          ok:s=>levelInfo(s.xp).level>=10},
  {id:'ouvreur',        nom:'Ouvreur de boosters', cond:'Ouvrir 100 boosters',             ok:s=>(s.stats?.opened||0)>=100},
  {id:'echangiste',     nom:'Échangiste',          cond:'Réussir 20 échanges',             ok:s=>(s.stats?.trades||0)>=20},
  {id:'pecheur',        nom:'Pêcheur émérite',     cond:'Attraper 30 poissons',            ok:s=>(s.stats?.fishCaught||0)>=30},
  {id:'fidele',         nom:'Fidèle',              cond:'7 jours de connexion d’affilée',  ok:s=>(s.stats?.bestStreak||0)>=7},
  {id:'legende',        nom:'Légende vivante',     cond:'Atteindre le niveau 25',          ok:s=>levelInfo(s.xp).level>=25},
  {id:'explorateur',    nom:'Explorateur',         cond:'Ouvrir 25 boosters Cosmos',       ok:s=>(s.stats?.cosmosOpened||0)>=25},
  {id:'astronome',      nom:'Astronome',           cond:'Découvrir 25 cartes Cosmos',      ok:s=>cDisc(s)>=25},
  {id:'cosmonaute',     nom:'Cosmonaute',          cond:'Découvrir 100 cartes Cosmos',     ok:s=>cDisc(s)>=100},
  {id:'pulsar',         nom:'Chasseur de pulsars', cond:'Obtenir une carte Pulsar',        ok:s=>cOwns(s,'pulsar')},
  {id:'eclipse',        nom:'Voleur d’éclipses',   cond:'Obtenir une carte Éclipse',       ok:s=>cOwns(s,'eclipse')},
  {id:'singulier',      nom:'Singulier',           cond:'Obtenir une carte Singularité',   ok:s=>cOwns(s,'singularite')},
  {id:'omega',          nom:'Oméga',               cond:'Obtenir une carte Oméga',         ok:s=>cOwns(s,'omega')},
  {id:'maitre',         nom:'Maître des étoiles',  cond:'Toutes les cartes Cosmos sauf l’Ultime', ok:s=>COSMOS.filter(c=>c.rarete!=='ultime').every(c=>s.collection[c.id]>0)},
  {id:'omniscient',     nom:'Omniscient',          cond:'Toutes les cartes classiques et Cosmos (sauf Ultime)', ok:s=>discovered(s)>=CARTES.length&&COSMOS.filter(c=>c.rarete!=='ultime').every(c=>s.collection[c.id]>0)},
  {id:'jambon',         nom:'Seigneur du Jambon',  cond:'Obtenir Le Jambon Cosmique',      ok:s=>cOwns(s,'ultime')},
];
export const THEMES = [
  {id:'foret',  nom:'Forêt',  couleur:'#dcc085', niveau:1},
  {id:'nuit',   nom:'Nuit',   couleur:'#b9b4ff', niveau:1},
  {id:'ocean',  nom:'Océan',  couleur:'#7fd8ff', niveau:3},
  {id:'lave',   nom:'Lave',   couleur:'#ff9a5a', niveau:6},
  {id:'bonbon', nom:'Bonbon', couleur:'#ff9fd0', niveau:10},
  {id:'desert', nom:'Désert', couleur:'#e8c27a', niveau:8},
  {id:'aurore', nom:'Aurore', couleur:'#6dffb5', niveau:12},
  {id:'glace',  nom:'Glace',  couleur:'#bfeaff', niveau:15},
  {id:'minuit', nom:'Minuit', couleur:'#ffd36e', niveau:20},
  {id:'rubis',  nom:'Rubis',  couleur:'#ff5a6e', niveau:25},
  {id:'cosmos', nom:'Cosmos', couleur:'#c77dff', niveau:1, cond:'10 cartes Cosmos',       ok:s=>cDisc(s)>=10},
  {id:'nebuleuse', nom:'Nébuleuse', couleur:'#ff5fd2', niveau:1, cond:'Une carte Pulsar',  ok:s=>cOwns(s,'pulsar')},
  {id:'eclipse',nom:'Éclipse',couleur:'#ff6a3d', niveau:1, cond:'Une carte Éclipse',      ok:s=>cOwns(s,'eclipse')},
  {id:'infini', nom:'Infini', couleur:'#39ffd0', niveau:1, cond:'Une carte Singularité',  ok:s=>cOwns(s,'singularite')},
  {id:'jambon', nom:'Jambon', couleur:'#ffb3a7', niveau:1, cond:'Le Jambon Cosmique',     ok:s=>cOwns(s,'ultime')},
];
export const BACKS = [
  {id:'classique', nom:'Classique', cond:'Disponible dès le départ', ok:()=>true},
  {id:'rayures',   nom:'Rayures',   cond:'Niveau 2',                 ok:s=>levelInfo(s.xp).level>=2},
  {id:'etoiles',   nom:'Étoiles',   cond:'Niveau 4',                 ok:s=>levelInfo(s.xp).level>=4},
  {id:'flammes',   nom:'Flammes',   cond:'Niveau 8',                 ok:s=>levelInfo(s.xp).level>=8},
  {id:'cristal',   nom:'Cristal',   cond:'Obtenir une carte cristal',ok:s=>owns(s,'cristal')},
  {id:'damier',    nom:'Damier',    cond:'Niveau 6',                 ok:s=>levelInfo(s.xp).level>=6},
  {id:'vagues',    nom:'Vagues',    cond:'Niveau 12',                ok:s=>levelInfo(s.xp).level>=12},
  {id:'arcenciel', nom:'Arc-en-ciel', cond:'Niveau 15',              ok:s=>levelInfo(s.xp).level>=15},
  {id:'or',        nom:'Or massif', cond:'Obtenir une carte foil arc-en-ciel', ok:s=>Object.values(s.foils||{}).includes('arc')},
  {id:'cosmos',    nom:'Cosmos',    cond:'10 cartes Cosmos',         ok:s=>cDisc(s)>=10},
  {id:'nova',      nom:'Nova',      cond:'Obtenir une carte Nova',   ok:s=>cOwns(s,'nova')},
  {id:'eclipse',   nom:'Éclipse',   cond:'Obtenir une carte Éclipse',ok:s=>cOwns(s,'eclipse')},
  {id:'omega',     nom:'Oméga',     cond:'Obtenir une carte Oméga',  ok:s=>cOwns(s,'omega')},
  {id:'jambon',    nom:'Jambon',    cond:'Obtenir Le Jambon Cosmique', ok:s=>cOwns(s,'ultime')},
];
export const themeUnlocked = (s, t) => levelInfo(s.xp).level >= t.niveau && (!t.ok || t.ok(s));
// Cartes foil : 5 % de chances d'avoir une version dorée, 1,5 % une version arc-en-ciel
export const FOIL_CHANCES = {arc:0.015, or:0.065};  // seuils cumulés (arc-en-ciel < 1,5 %, doré < 6,5 %)
const FOIL_RANK = {or:1, arc:2};
export function normalizeProfile(s) {
  const p = s.profile && typeof s.profile === 'object' ? s.profile : {};
  return {
    name: typeof p.name === 'string' ? p.name.slice(0,16) : '',
    avatar: Number.isInteger(p.avatar) && [...CARTES,...COSMOS,...MULTI].some(c=>c.id===p.avatar) ? p.avatar : null,
    title: TITLES.some(t=>t.id===p.title) ? p.title : 'debutant',
    theme: THEMES.some(t=>t.id===p.theme) ? p.theme : 'foret',
    back: BACKS.some(b=>b.id===p.back) ? p.back : 'classique',
  };
}
export function normalizeFoils(f) {
  const out = {};
  if (f && typeof f === 'object') for (const c of CARTES) if (FOIL_RANK[f[c.id]]) out[c.id] = f[c.id];
  return out;
}
export function normalizeStats(st) {
  const n = v => Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  const f = v => Number.isFinite(v) && v > 0 ? Math.round(v*100)/100 : 0;
  return {opened:n(st?.opened), casino:n(st?.casino), sold:n(st?.sold), cards:n(st?.cards), wins:n(st?.wins), losses:n(st?.losses),
    gained:f(st?.gained), lost:f(st?.lost), bigWin:f(st?.bigWin), bigLoss:f(st?.bigLoss),
    lastDay:typeof st?.lastDay==='string'?st.lastDay.slice(0,10):'', streak:n(st?.streak), bestStreak:n(st?.bestStreak),
    claims:n(st?.claims), cosmosOpened:n(st?.cosmosOpened), multiOpened:n(st?.multiOpened), eventOpened:n(st?.eventOpened), trades:n(st?.trades), fish:n(st?.fish), fishCaught:n(st?.fishCaught), chest:n(st?.chest), bombLoss:n(st?.bombLoss), bombBest:n(st?.bombBest), bombPerfect:n(st?.bombPerfect), lossStreak:n(st?.lossStreak), lossBest:n(st?.lossBest), night:n(st?.night), egg:n(st?.egg)};
}
// ---------- EXTENSION COSMOS ----------
export { MULTI, MULTI_RARETES, MULTI_COLLECTIONS, COSMOS, COSMOS_RARETES, ULTIME_CHANCE, COSMOS_COLLECTIONS, EVENTS, EVENT_CARDS, EVENT_RACES, activeEvent, nextEvent, dayBonus, DAY_BONUS, parisDay };
// Booster d'événement : raretés classiques (sans cristal), cartes de l'événement en cours uniquement
export function drawEvent(ev, random = Math.random, luck = 0) {
  const weights = {commun:60, rare:25, epique:10, legendaire:4};
  const keys = Object.keys(weights).filter(k => ev.cartes.some(c => c.rarete === k));
  const w = k => k === 'commun' ? weights[k] : weights[k]*(1+luck);
  let roll = random()*keys.reduce((a,k)=>a+w(k),0), key = keys[0];
  for (const k of keys) { roll -= w(k); if (roll < 0) { key = k; break; } }
  const pool = ev.cartes.filter(c => c.rarete === key);
  return pool[Math.floor(random()*pool.length)];
}
export const COSMOS_ORDER = Object.keys(COSMOS_RARETES);
export const COSMOS_MIN = {commun:'astral', rare:'nova', epique:'pulsar'};   // équivalent Cosmos des boosters garantis
// Registre des collections « extension » (Cosmos, Multivers) : tout le jeu passe par lui
export function drawSet(cfg, random = Math.random, luck = 0, minTier = null, allowUltra = true) {
  if (allowUltra) for (const u of cfg.ultras) if (random() < u.chance) return u.card;   // cartes ultra-rares (jamais dans la boutique)
  const order = Object.keys(cfg.rar), min = order.indexOf(minTier || cfg.base);
  const keys = order.filter(k => cfg.rar[k].chance > 0 && order.indexOf(k) >= min);
  const weight = k => k === cfg.base ? cfg.rar[k].chance : cfg.rar[k].chance*(1+luck);
  let roll = random()*keys.reduce((a,k)=>a+weight(k),0);
  for (const k of keys) {
    roll -= weight(k);
    if (roll < 0) { const pool = cfg.cards.filter(c => c.rarete === k); return pool[Math.floor(random()*pool.length)]; }
  }
  return cfg.cards.filter(c => c.rarete === keys[0])[0];
}
export const drawCosmos = (random, luck, minTier, allowUltime) => drawSet(SETS.cosmos, random, luck, minTier, allowUltime);
// ---------- ÉCHANGES (comme les SBC) : des doublons contre une carte de la rareté au-dessus ----------
export const TRADES = {
  commun:     {need:2, to:'rare'},
  rare:       {need:5, to:'epique'},
  epique:     {need:7, to:'legendaire'},
  legendaire: {need:5, to:'mythique'},
  mythique:   {need:5, to:'cristal'},
};
// Échanges : jamais vers les cartes ultra-rares (elles ne se fabriquent pas)
export const TRADES_COSMOS = {
  astral:      {need:2, to:'nova'},
  nova:        {need:5, to:'pulsar'},
  pulsar:      {need:7, to:'eclipse'},
  eclipse:     {need:5, to:'singularite'},
  singularite: {need:5, to:'omega'},
};
export const TRADES_MULTI = {
  fragment: {need:2, to:'echo'},
  echo:     {need:5, to:'prisme'},
  prisme:   {need:7, to:'mirage'},
  mirage:   {need:5, to:'vortex'},
  vortex:   {need:5, to:'zenith'},
};
export const SETS = {
  cosmos: {id:'cosmos', cards:COSMOS, rar:COSMOS_RARETES, base:'astral', min:{commun:'astral', rare:'nova', epique:'pulsar'}, disc:['astral','nova','pulsar','eclipse','singularite','omega'], trades:TRADES_COSMOS, stat:'cosmosOpened',
           ultras:[{card:COSMOS.at(-1), chance:ULTIME_CHANCE}]},
  multi:  {id:'multi',  cards:MULTI,  rar:MULTI_RARETES,  base:'fragment', min:{commun:'fragment', rare:'echo', epique:'prisme'}, disc:['fragment','echo','prisme','mirage','vortex','zenith'], trades:TRADES_MULTI, stat:'multiOpened',
           ultras:[{card:MULTI.find(c=>c.rarete==='paradoxe'), chance:FROMAGE_CHANCE}, {card:MULTI.find(c=>c.rarete==='absolu'), chance:CROCO_CHANCE}]},
};
export function normalizeLocks(l) {
  const out = {};
  if (l && typeof l === 'object') for (const c of [...CARTES, ...COSMOS, ...MULTI, ...EVENT_CARDS]) if (l[c.id]) out[c.id] = true;
  return out;
}
// Pack Découverte : 2 par jour (1 diamant), avec toujours une carte que tu n'as pas encore
export const DISCOVER_PER_DAY = 2;
export function discoverLeft(state, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0,10);
  return state.discover?.day === day ? Math.max(0, DISCOVER_PER_DAY - (state.discover.count||0)) : DISCOVER_PER_DAY;
}
// ---------- BONUS DU JOUR & ÉVÉNEMENTS : voir events.mjs ----------
export const shopPrice = (item, now = Date.now()) => { const s = dayBonus(now).solde; return s && item.id !== 'decouverte' ? Math.max(1, Math.ceil(item.prix*s)) : item.prix; };
// ---------- MINI-JEU : LA PÊCHE ----------
// Gratuit. Tu as jusqu'à 5 lignes, +1 toutes les 6 minutes. Ferre au bon moment pour attraper un butin.
export const FISH_MAX = 5, FISH_INTERVAL = 6*60*1000;
export const FISH_LOOT = [
  {id:'botte',    nom:'Vieille botte',   emoji:'🥾', poids:24},
  {id:'algue',    nom:'Algue',           emoji:'🌿', poids:14, jetons:0.02},
  {id:'sardine',  nom:'Sardine',         emoji:'🐟', poids:26, jetons:0.05},
  {id:'tropical', nom:'Poisson tropical',emoji:'🐠', poids:12, jetons:0.1},
  {id:'crabe',    nom:'Crabe',           emoji:'🦀', poids:8,  jetons:0.12},
  {id:'globe',    nom:'Poisson-globe',   emoji:'🐡', poids:6,  jetons:0.15},
  {id:'pieuvre',  nom:'Pieuvre',         emoji:'🐙', poids:5,  jetons:0.3},
  {id:'perle',    nom:'Perle rare',      emoji:'🦪', poids:3,  diamants:1},
  {id:'coffre',   nom:'Coffre au trésor',emoji:'🧰', poids:2,  jetons:1.5},
];
export function normalizeFish(f, now = Date.now()) {
  let casts = Number.isFinite(f?.casts) ? Math.min(FISH_MAX, Math.max(0, Math.floor(f.casts))) : FISH_MAX;
  let anchor = Number.isFinite(f?.anchor) ? f.anchor : now;
  if (casts >= FISH_MAX) anchor = now;
  else {
    const gained = Math.max(0, Math.floor((now-anchor)/FISH_INTERVAL));
    if (casts+gained >= FISH_MAX) { casts = FISH_MAX; anchor = now; } else { casts += gained; anchor += gained*FISH_INTERVAL; }
  }
  return {casts, anchor};
}
// ---------- CARTES SECRÈTES ET SUCCÈS ----------
// Les cartes secrètes ne sortent jamais des boosters : on les gagne avec un succès.
export const SECRETS = [
  {id:201, nom:'Le Clown',      emoji:'🤡', pv:13,  indice:'Il adore perdre... à la bombe.'},
  {id:202, nom:'Le Fantôme',    emoji:'👻', pv:66,  indice:'Il n’apparaît que la nuit.'},
  {id:203, nom:'Triple Sept',   emoji:'🎰', pv:777, indice:'Un chiffre porte-bonheur, trois fois.'},
  {id:204, nom:'Le Roi Cristal',emoji:'👑', pv:999, indice:'Il règne sur le cristal et le divin.'},
  {id:205, nom:'Le Curieux',    emoji:'🔎', pv:42,  indice:'Il se cache là où personne ne regarde.'},
];
const countRarity = (s, r) => CARTES.filter(c => c.rarete === r && s.collection[c.id] > 0).length;
const totalRarity = r => CARTES.filter(c => c.rarete === r).length;
const stat = k => s => s.stats?.[k] || 0;
const lvl = s => levelInfo(s.xp).level;
const foilCount = (s, t) => Object.values(s.foils||{}).filter(v => !t || v === t).length;
// metric = ce qu'on mesure, target = l'objectif. diamants = récompense. card = carte secrète offerte. secret = description cachée.
export const ACHIEVEMENTS = [
  {id:'pack1',   icon:'📦', nom:'Premier pas',        desc:'Ouvrir ton premier booster',             diamants:1,  target:1,    metric:stat('opened')},
  {id:'pack50',  icon:'🎁', nom:'Boulimique',         desc:'Ouvrir 50 boosters',                     diamants:2,  target:50,   metric:stat('opened')},
  {id:'pack200', icon:'🏭', nom:'Usine à boosters',   desc:'Ouvrir 200 boosters',                    diamants:5,  target:200,  metric:stat('opened')},
  {id:'cards500',icon:'🌧️', nom:'Pluie de cartes',    desc:'Obtenir 500 cartes au total',            diamants:3,  target:500,  metric:stat('cards')},
  {id:'cards777',icon:'🎰', nom:'Triple sept',        desc:'Obtenir 777 cartes au total',            diamants:7,  target:777,  metric:stat('cards'), card:203},
  {id:'cards2k', icon:'🌊', nom:'Avalanche',          desc:'Obtenir 2 000 cartes au total',          diamants:6,  target:2000, metric:stat('cards')},
  {id:'disc25',  icon:'🔍', nom:'Les débuts',         desc:'Découvrir 25 cartes',                    diamants:1,  target:25,   metric:s=>CARTES.filter(c=>s.collection[c.id]>0).length},
  {id:'disc75',  icon:'📚', nom:'Bien rangé',         desc:'Découvrir 75 cartes',                    diamants:2,  target:75,   metric:s=>CARTES.filter(c=>s.collection[c.id]>0).length},
  {id:'disc147', icon:'🏆', nom:'Complétiste',        desc:'Découvrir toutes les cartes',            diamants:10, target:CARTES.length, metric:s=>CARTES.filter(c=>s.collection[c.id]>0).length},
  {id:'crist1',  icon:'💎', nom:'Premier éclat',      desc:'Obtenir une carte cristal',              diamants:3,  target:1,    metric:s=>countRarity(s,'cristal')},
  {id:'crist3',  icon:'🔮', nom:'Trio cristal',       desc:'Obtenir les 3 cartes cristal',           diamants:6,  target:totalRarity('cristal'), metric:s=>countRarity(s,'cristal')},
  {id:'myth',    icon:'🌌', nom:'Panthéon',           desc:'Obtenir toutes les cartes mythiques',    diamants:5,  target:totalRarity('mythique'), metric:s=>countRarity(s,'mythique')},
  {id:'foil1',   icon:'✨', nom:'Ça brille',          desc:'Obtenir une carte foil',                 diamants:2,  target:1,    metric:s=>foilCount(s)},
  {id:'foil10',  icon:'🥇', nom:'Collection dorée',   desc:'Obtenir 10 cartes foil',                 diamants:5,  target:10,   metric:s=>foilCount(s)},
  {id:'arc1',    icon:'🌈', nom:'Arc-en-ciel',        desc:'Obtenir une carte foil arc-en-ciel',     diamants:3,  target:1,    metric:s=>foilCount(s,'arc')},
  {id:'cas1',    icon:'🎲', nom:'Première mise',      desc:'Jouer ta première partie de casino',     diamants:1,  target:1,    metric:stat('casino')},
  {id:'cas25',   icon:'🃏', nom:'Habitué',            desc:'Jouer 25 parties de casino',             diamants:2,  target:25,   metric:stat('casino')},
  {id:'cas100',  icon:'🎩', nom:'Roi du casino',      desc:'Jouer 100 parties de casino',            diamants:4,  target:100,  metric:stat('casino')},
  {id:'jackpot', icon:'💰', nom:'Jackpot',            desc:'Gagner 10 jetons d’un coup',             diamants:3,  target:10,   metric:stat('bigWin')},
  {id:'poisse',  icon:'🌩️', nom:'Poissard',           desc:'Perdre 10 parties de casino d’affilée',  diamants:2,  target:10,   metric:stat('lossBest')},
  {id:'ruine',   icon:'💸', nom:'Ruiné',              desc:'Perdre 50 jetons au casino',             diamants:1,  target:50,   metric:stat('lost')},
  {id:'clown',   icon:'🤡', nom:'Kamikaze',           desc:'Perdre 10 fois de suite à la bombe',     diamants:2,  target:10,   metric:stat('bombBest'), card:201},
  {id:'survie',  icon:'🧨', nom:'Démineur',           desc:'Trouver les 4 cases sûres de la bombe',  diamants:5,  target:1,    metric:stat('bombPerfect')},
  {id:'sell50',  icon:'🛒', nom:'Marchand',           desc:'Vendre 50 doublons',                     diamants:1,  target:50,   metric:stat('sold')},
  {id:'sell300', icon:'🏦', nom:'Magnat',             desc:'Vendre 300 doublons',                    diamants:3,  target:300,  metric:stat('sold')},
  {id:'race1',   icon:'🧬', nom:'Premier tirage',     desc:'Tirer une race',                         diamants:1,  target:1,    metric:s=>s.races?.rolls||0},
  {id:'race6',   icon:'🧝', nom:'Héritier',           desc:'Obtenir 6 races différentes',            diamants:2,  target:6,    metric:s=>Object.keys(s.races?.owned||{}).length},
  {id:'race11',  icon:'🐲', nom:'Toutes les races',   desc:'Obtenir les 11 races',                   diamants:6,  target:11,   metric:s=>Object.keys(s.races?.owned||{}).length},
  {id:'divin',   icon:'😇', nom:'Divin',              desc:'Obtenir la race Divinité',               diamants:4,  target:1,    metric:s=>s.races?.owned?.divinite?1:0},
  {id:'niv10',   icon:'⭐', nom:'Niveau 10',          desc:'Atteindre le niveau 10',                 diamants:2,  target:10,   metric:lvl},
  {id:'niv25',   icon:'🌟', nom:'Niveau 25',          desc:'Atteindre le niveau 25',                 diamants:4,  target:25,   metric:lvl},
  {id:'niv50',   icon:'🚀', nom:'Niveau 50',          desc:'Atteindre le niveau 50',                 diamants:8,  target:50,   metric:lvl},
  {id:'streak3', icon:'📆', nom:'Fidèle',             desc:'Te connecter 3 jours d’affilée',         diamants:1,  target:3,    metric:stat('bestStreak')},
  {id:'streak7', icon:'🗓️', nom:'Semaine parfaite',   desc:'Te connecter 7 jours d’affilée',         diamants:3,  target:7,    metric:stat('bestStreak')},
  {id:'streak30',icon:'📅', nom:'Inséparable',        desc:'Te connecter 30 jours d’affilée',        diamants:10, target:30,   metric:stat('bestStreak')},
  {id:'quete10', icon:'📜', nom:'Quêtard',            desc:'Récupérer 10 quêtes',                    diamants:2,  target:10,   metric:stat('claims')},
  {id:'cos1',    icon:'🌌', nom:'Premier voyage',       desc:'Ouvrir un booster Cosmos',               diamants:2,  target:1,    metric:stat('cosmosOpened')},
  {id:'cos25',   icon:'🔭', nom:'Explorateur du Cosmos',desc:'Découvrir 25 cartes Cosmos',             diamants:3,  target:25,   metric:s=>COSMOS.filter(c=>s.collection[c.id]>0).length},
  {id:'cos100',  icon:'🪐', nom:'Cartographe stellaire',desc:'Découvrir 100 cartes Cosmos',            diamants:8,  target:100,  metric:s=>COSMOS.filter(c=>s.collection[c.id]>0).length},
  {id:'cos199',  icon:'🌠', nom:'Maître du Cosmos',     desc:'Découvrir les 199 cartes Cosmos hors Jambon', diamants:25, target:199, metric:s=>COSMOS.filter(c=>c.rarete!=='ultime'&&s.collection[c.id]>0).length},
  {id:'sing',    icon:'⚫', nom:'Au bord du vide',      desc:'Obtenir une carte Singularité',          diamants:5,  target:1,    metric:s=>COSMOS.filter(c=>c.rarete==='singularite'&&s.collection[c.id]>0).length},
  {id:'omega',   icon:'🔱', nom:'Alpha et Oméga',       desc:'Obtenir une carte Oméga',                diamants:10, target:1,    metric:s=>COSMOS.filter(c=>c.rarete==='omega'&&s.collection[c.id]>0).length},
  {id:'jambon',  icon:'🍖', nom:'Le Jambon Cosmique',   desc:'Obtenir la carte la plus rare de l’univers', diamants:100, target:1, metric:s=>s.collection[500]>0?1:0},
  {id:'trade1',  icon:'♻️', nom:'Alchimiste',          desc:'Faire ton premier échange de cartes',    diamants:1,  target:1,    metric:stat('trades')},
  {id:'trade10', icon:'⚗️', nom:'Maître alchimiste',   desc:'Faire 10 échanges de cartes',            diamants:3,  target:10,   metric:stat('trades')},
  {id:'fish1',  icon:'🎣', nom:'Premier hameçon',    desc:'Lancer ta ligne une première fois',      diamants:1,  target:1,    metric:stat('fish')},
  {id:'fish25', icon:'🐟', nom:'Pêcheur du dimanche',desc:'Attraper 25 poissons ou butins',         diamants:2,  target:25,   metric:stat('fishCaught')},
  {id:'fish100',icon:'⚓', nom:'Capitaine',          desc:'Attraper 100 poissons ou butins',        diamants:4,  target:100,  metric:stat('fishCaught')},
  {id:'coffre', icon:'🧰', nom:'Trésor des mers',    desc:'Pêcher un coffre au trésor',             diamants:3,  target:1,    metric:stat('chest')},
  {id:'nuit',    icon:'🦉', nom:'Oiseau de nuit',     desc:'Ouvrir un booster en pleine nuit',       diamants:2,  target:1,    metric:stat('night'), secret:true, card:202},
  {id:'roi',     icon:'👑', nom:'Le roi est là',      desc:'Avoir les 3 cristaux et la race Divinité', diamants:5, target:2,   metric:s=>(countRarity(s,'cristal')>=totalRarity('cristal')?1:0)+(s.races?.owned?.divinite?1:0), secret:true, card:204},
  {id:'curieux', icon:'🔎', nom:'Curieux',            desc:'Cliquer plusieurs fois sur le logo',     diamants:2,  target:1,    metric:stat('egg'), secret:true, card:205},
];
// ---------- COLLECTIONS THÉMATIQUES ----------
// Compléter une collection (avoir toutes ses cartes) donne des diamants, via un succès automatique.
const R = (a, b) => Array.from({length:b-a+1}, (_, i) => a+i);
export const COLLECTIONS = [
  {id:'animaux',   nom:'Les Animaux',            icon:'🐾', diamants:6, ids:[...R(1,9),11,12,...R(48,61)]},
  {id:'creatures', nom:'Créatures de légende',   icon:'🐉', diamants:5, ids:[10,13,14,35,...R(62,72),75,76]},
  {id:'heros',     nom:'Héros et aventuriers',   icon:'🗡️', diamants:5, ids:[29,36,...R(77,89)]},
  {id:'espace',    nom:'L’Espace',               icon:'🚀', diamants:5, ids:[15,27,41,42,44,45,46,47,...R(90,99)]},
  {id:'elements',  nom:'Éléments et météo',      icon:'🌪️', diamants:4, ids:[30,34,38,43,...R(100,107)]},
  {id:'paysages',  nom:'Paysages et plantes',    icon:'🌿', diamants:4, ids:[...R(108,117),142,144]},
  {id:'pierres',   nom:'Pierres précieuses',     icon:'💎', diamants:4, ids:[37,...R(118,127)]},
  {id:'tresors',   nom:'Trésors et reliques',    icon:'🏺', diamants:6, ids:[28,31,32,33,39,40,...R(128,143)].filter(id=>id!==142)},
  {id:'quotidien', nom:'La vie de tous les jours',icon:'🍕', diamants:3, ids:R(16,26)},
  {id:'cristaux',  nom:'Les Cristaux',           icon:'🔮', diamants:5, ids:[145,146,147]},
];
for (const col of COLLECTIONS) ACHIEVEMENTS.push({id:'col_'+col.id, icon:col.icon, nom:'Collection : '+col.nom, desc:`Avoir les ${col.ids.length} cartes de la collection`, diamants:col.diamants, target:col.ids.length, metric:s=>col.ids.filter(id=>s.collection[id]>0).length});
ACHIEVEMENTS.push(
  {id:'evt1',   icon:'🎉', nom:'Fêtard',               desc:'Ouvrir un booster d’événement',          diamants:2,  target:1,  metric:stat('eventOpened')},
  {id:'evt50',  icon:'🎊', nom:'Roi des fêtes',        desc:'Ouvrir 50 boosters d’événement',         diamants:6,  target:50, metric:stat('eventOpened')},
  {id:'evtc',   icon:'🏆', nom:'Collection limitée',   desc:'Avoir les 12 cartes d’un même événement', diamants:8, target:12, metric:s=>Math.max(0,...EVENTS.map(e=>e.cartes.filter(c=>s.collection[c.id]>0).length))},
  {id:'evtr',   icon:'🧬', nom:'Race rare',            desc:'Obtenir une race limitée d’événement',    diamants:5,  target:1,  metric:s=>EVENT_RACES.some(r=>s.races?.owned?.[r.id])?1:0},
);
const mDisc = s => MULTI.filter(c => !c.odds && s.collection[c.id] > 0).length;
ACHIEVEMENTS.push(
  {id:'mul1',   icon:'🧩', nom:'Premier saut',          desc:'Ouvrir un booster Multivers',                   diamants:2,  target:1,   metric:stat('multiOpened')},
  {id:'mul50',  icon:'🌀', nom:'Voyageur parallèle',    desc:'Découvrir 50 cartes Multivers',                 diamants:4,  target:50,  metric:mDisc},
  {id:'mul150', icon:'🪩', nom:'Maître des dimensions', desc:'Découvrir 150 cartes Multivers',                diamants:10, target:150, metric:mDisc},
  {id:'mul298', icon:'🏆', nom:'Architecte du Multivers',desc:'Les 298 cartes Multivers hors ultra-rares',    diamants:40, target:298, metric:mDisc},
  {id:'mulzen', icon:'👑', nom:'Au zénith',             desc:'Obtenir une carte Zénith',                      diamants:12, target:1,   metric:s=>MULTI.some(c=>c.rarete==='zenith'&&s.collection[c.id]>0)?1:0},
  {id:'fromage',icon:'🧀', nom:'Le Fromage Stellaire',  desc:'Obtenir Le Fromage Stellaire (1/150 000)',      diamants:150,target:1,   metric:s=>MULTI.some(c=>c.rarete==='paradoxe'&&s.collection[c.id]>0)?1:0},
  {id:'croco',  icon:'🐊', nom:'Le Crocodile Intergalactique',desc:'Obtenir le Crocodile Intergalactique (1/500 000)',diamants:500,target:1,metric:s=>MULTI.some(c=>c.rarete==='absolu'&&s.collection[c.id]>0)?1:0},
);
for (const col of MULTI_COLLECTIONS) ACHIEVEMENTS.push({id:'mcol_'+col.id, icon:col.icon, nom:'Multivers : '+col.nom, desc:`Avoir les ${col.ids.length} cartes de la collection`, diamants:col.diamants, target:col.ids.length, metric:s=>col.ids.filter(id=>s.collection[id]>0).length});
for (const col of COSMOS_COLLECTIONS) ACHIEVEMENTS.push({id:'ccol_'+col.id, icon:col.icon, nom:'Cosmos : '+col.nom, desc:`Avoir les ${col.ids.length} cartes de la collection Cosmos`, diamants:col.diamants, target:col.ids.length, metric:s=>col.ids.filter(id=>s.collection[id]>0).length});
export function normalizeAchievements(a) {
  const out = {};
  if (a && typeof a === 'object') for (const x of ACHIEVEMENTS) if (Number.isFinite(a[x.id])) out[x.id] = a[x.id];
  return out;
}
export function normalizeSecrets(s) {
  const out = {};
  if (s && typeof s === 'object') for (const c of SECRETS) if (s[c.id]) out[c.id] = true;
  return out;
}
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
RACES.push(...EVENT_RACES);
export function drawRace(random = Math.random, minRarity = 'commun', now = Date.now()) {
  const ev = activeEvent(now);
  if (ev && random() < EVENT_RACE_CHANCE) return ev.race;       // race limitée de l'événement en cours
  const order = Object.keys(RARETES), pool = RACES.filter(r => !r.limited && order.indexOf(r.rarete) >= order.indexOf(minRarity));
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
  const race = RACES.find(r => r.id === state.races?.equipped), day = dayBonus(now);
  const luckBoost = (state.boosts?.luck||0) > now ? SHOP_LUCK : 0;
  return {speed: (race?.speed||0)+(day.speed||0), luck: (race?.luck||0)+luckBoost+(day.luck||0), resale: race?.resale||0, race};
}
// Durée entre deux boosters gratuits (plus courte avec une race rapide)
export function intervalFor(state, now = Date.now()) { return INTERVAL / (1 + bonusOf(state, now).speed); }

export function accrue(state, now = Date.now()) {
  const interval = intervalFor(state, now);
  const elapsed = Math.max(0, Math.floor((now-state.anchor)/interval));
  if (state.boosters >= MAX_RESERVE || state.boosters+elapsed >= MAX_RESERVE) { state.boosters=Math.max(state.boosters,MAX_RESERVE); state.anchor=now; }
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
  state.profile=normalizeProfile(state); state.foils=normalizeFoils(state.foils); state.stats=normalizeStats(state.stats); state.achievements=normalizeAchievements(state.achievements); state.fish=normalizeFish(state.fish,now); state.locks=normalizeLocks(state.locks); state.secrets=normalizeSecrets(state.secrets);
  if(state.bomb && !(Array.isArray(state.bomb.bombs) && Array.isArray(state.bomb.opened) && BETS.includes(state.bomb.bet))) state.bomb=null;
  { // série de jours de connexion d'affilée
    const today=dayOf(now), st=state.stats;
    if(st.lastDay!==today){ st.streak = st.lastDay===dayOf(now-86400000) ? st.streak+1 : 1; st.lastDay=today; st.bestStreak=Math.max(st.bestStreak,st.streak); }
  }
  let cBet=0, cPay=0, cWin=false;   // pour les statistiques du casino
  const round2=n=>Math.round(n*100)/100;
  const takeBet=bet=>{ if(!BETS.includes(bet)) throw Error('Choisis une mise proposée.'); if(state.jetons<bet) throw Error('Pas assez de jetons pour cette mise.'); state.jetons=round2(state.jetons-bet); cBet=bet; return bet; };
  const credit=n=>{ state.jetons=round2(state.jetons+n); };
  const shuffle=arr=>{ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  state.diamants=Math.max(0,Math.floor(state.diamants||0));
  state.boosts={xp:Number(state.boosts?.xp)||0,luck:Number(state.boosts?.luck)||0};
  const bonus=bonusOf(state,now);
  const day=dayBonus(now), jm=day.jetons||1, fm=day.foil||1, ev=activeEvent(now);
  const setName=(body.action==='open'||body.action==='buy')&&Object.hasOwn(SETS,body.set)?body.set:((body.action==='open'||(body.action==='buy'&&body.item==='decouverte'))&&body.set==='event'?'event':'classic'), xset=SETS[setName];
  if(setName==='event'&&!ev) throw Error('Aucun événement en cours pour le moment.');
  const addCard=(min='commun')=>{ if(setName==='event') return addSpecific(drawEvent(ev,random,bonus.luck)); if(xset) return addSpecific(drawSet(xset,random,bonus.luck,xset.min[min]||xset.base,body.action==='open')); const card=draw(random,bonus.luck,min); state.stats.cards++; const fr=random(), foil=fr<FOIL_CHANCES.arc*fm?'arc':fr<FOIL_CHANCES.or*fm?'or':null; if(foil&&(FOIL_RANK[state.foils[card.id]]||0)<FOIL_RANK[foil]) state.foils[card.id]=foil; result.cards.push({...card,new:!state.collection[card.id],foil}); state.collection[card.id]=(state.collection[card.id]||0)+1; quests.progress.cards=Math.min(10,quests.progress.cards+1); };
  const addSpecific=card=>{ state.stats.cards++; result.cards.push({...card,new:!state.collection[card.id],foil:null}); state.collection[card.id]=(state.collection[card.id]||0)+1; quests.progress.cards=Math.min(10,quests.progress.cards+1); };
  if (body.action==='open') {
    // body.count = nombre de boosters à ouvrir d'un coup (1 par défaut, 30 maximum)
    const count=Math.min(MAX_OPEN,Math.max(1,Math.floor(body.count)||1));
    const free=state.boosters+state.bonus, extra=Math.max(0,count-free);
    if(state.jetons<extra) throw Error(count===1?'Aucun booster ni jeton disponible.':`Il te manque ${extra} jeton(s) pour ouvrir ${count} boosters.`);
    for(let k=0;k<count;k++){
      if(state.boosters>0) state.boosters--; else if(state.bonus>0) state.bonus--; else state.jetons=Math.round((state.jetons-1)*100)/100;
      for(let i=0;i<5;i++) addCard();
    }
    quests.progress.packs=Math.min(2,quests.progress.packs+count);
    state.stats.opened+=count; result.count=count; { const h=new Date(now).getUTCHours(); if(h>=2&&h<5) state.stats.night=1; }
    result.set=setName; if(xset) state.stats[xset.stat]=(state.stats[xset.stat]||0)+count; if(setName==='event') state.stats.eventOpened=(state.stats.eventOpened||0)+count;
    result.message=count===1?'Cinq nouvelles découvertes.':`${count*5} nouvelles cartes !`; xpGain=XP.open*count;
  } else if(body.action==='sell') {
    let sold=0, value=0;
    const sx=Object.hasOwn(SETS,body.set)?SETS[body.set]:null, evt=body.set==='event', pool=sx?sx.cards:evt?EVENT_CARDS:CARTES, price=card=>sx?sx.rar[card.rarete].vente:(SELL_VALUES[card.rarete]??0.05);
    for(const card of pool) if((body.id===undefined || body.id===card.id) && !state.locks[card.id] && (!Array.isArray(body.rarities) || body.rarities.includes(card.rarete))) { const n=Math.max(0,(state.collection[card.id]||0)-1); if(n){ state.collection[card.id]=1; sold+=n; state.stats.sold+=n; value+=n*price(card); } }
    state.jetons=Math.round((state.jetons+value*(1+bonus.resale)*jm)*100)/100;
    quests.progress.sell=Math.min(3,quests.progress.sell+sold);
    result.message=`${sold} doublon(s) vendu(s).`;
  } else if(body.action==='casino') {
    const bet=body.bet; cBet=bet;
    if(![0.25,0.5,1,2,5].includes(bet)) throw Error('Choisis une mise proposée.');
    if(state.jetons<bet) throw Error('Pas assez de jetons pour cette mise.');
    state.jetons=Math.round((state.jetons-bet)*100)/100;
    const roll=random();
    if(roll<0.07) { state.jetons+=bet*5; cPay=bet*5; cWin=true; result.message=`Jackpot ! ${bet*5} jetons gagnés.`; result.symbols=['✦','✦','✦']; }
    else if(roll<0.27) { state.jetons+=bet*2; cPay=bet*2; cWin=true; result.message=`${bet*2} jeton(s) gagnés !`; result.symbols=['◈','◈','◈']; }
    else if(roll<0.35) { addCard(); cWin=true; result.message='Une carte rejoint ta collection !'; result.symbols=['❖','❖','❖']; }
    else { result.message=`Cette fois, tu perds ta mise de ${bet} jeton(s).`; result.symbols=['✦','◈','❖']; }
    state.jetons=Math.round(state.jetons*100)/100; xpGain=XP.casino;
  } else if(body.action==='claim') {
    const quest=QUESTS.find(q=>q.id===body.quest);
    if(!quest || quests.progress[quest.id]<quest.target || quests.claimed.includes(quest.id)) throw Error('Quête indisponible.');
    quests.claimed.push(quest.id); state.stats.claims++;
    state.jetons=Math.round((state.jetons+quest.reward*jm)*100)/100;
    result.message=`+${quest.reward*jm} jeton : récompense récupérée !`; xpGain=XP.claim;
  } else if(body.action==='race') {
    const rs=state.races;
    if(rs.free>0) rs.free--;
    else { if(state.jetons<RACE_COST) throw Error(`Il faut ${RACE_COST} jetons pour tirer une race.`); state.jetons=Math.round((state.jetons-RACE_COST)*100)/100; }
    const race=drawRace(random,'commun',now), isNew=!rs.owned[race.id];
    rs.owned[race.id]=(rs.owned[race.id]||0)+1; rs.rolls++;
    if(!rs.equipped) rs.equipped=race.id;
    if(!isNew) state.jetons=Math.round((state.jetons+RACE_REFUND)*100)/100;
    result.race={...race,new:isNew};
    result.message=isNew?`Nouvelle race : ${race.nom} !`:`${race.nom}, déjà connue : ${RACE_REFUND} jeton remboursé.`;
    xpGain=XP.race;
  } else if(body.action==='buy') {
    const item=SHOP.find(i=>i.id===body.item);
    if(!item) throw Error('Objet inconnu.');
    if(body.set==='event'&&item.id!=='decouverte') throw Error('Les boosters d’événement ne se achètent pas ici : ouvre-les depuis l’onglet Boosters.'.replace('se achètent','s’achètent'));
    if(item.id==='decouverte' && discoverLeft(state,now)<=0) throw Error('Tu as déjà ouvert tes 2 packs Découverte aujourd’hui.');
    const eligible=item.id==='decouverte'?(setName==='event'?ev.cartes.slice():xset?xset.cards.filter(c=>xset.disc.includes(c.rarete)):CARTES.slice()).filter(c=>!state.collection[c.id]):[];
    if(item.id==='decouverte'&&body.pick!=null&&!eligible.some(c=>c.id===body.pick)) throw Error('Cette carte ne peut pas être choisie (déjà possédée ou trop rare).');
    const prix=shopPrice(item,now);
    if(item.monnaie==='jetons'){ if(state.jetons<prix) throw Error('Pas assez de jetons.'); state.jetons=Math.round((state.jetons-prix)*100)/100; }
    else { if(state.diamants<prix) throw Error('Pas assez de diamants.'); state.diamants-=prix; }
    if(item.id==='rare'||item.id==='epique'){
      for(let i=0;i<5;i++) addCard(item.id==='epique'&&i===0?'epique':'rare');
      quests.progress.packs=Math.min(2,quests.progress.packs+1); state.stats.opened++; if(xset) state.stats[xset.stat]++; result.set=setName;
      result.message=`${item.nom} ouvert !`; xpGain=XP.open;
    } else if(item.id==='decouverte'){
      const pk=eligible.find(c=>c.id===body.pick);
      if(pk){ addSpecific(pk); for(let i=0;i<4;i++) addCard(); }           // carte nouvelle choisie par le joueur + 4 cartes normales
      else {
        for(let i=0;i<5;i++) addCard();
        if(!result.cards.some(c=>c.new)&&eligible.length){
          const chanceOf=c=>setName==='event'?({commun:60,rare:25,epique:10}[c.rarete]||1):((xset?xset.rar:RARETES)[c.rarete].chance||0.01);
          let roll=random()*eligible.reduce((a,c)=>a+chanceOf(c),0), pick=eligible.at(-1); for(const c of eligible){ roll-=chanceOf(c); if(roll<0){ pick=c; break; } } addSpecific(pick);
        }
      }
      const day=new Date(now).toISOString().slice(0,10); state.discover={day,count:(discoverLeft(state,now)===DISCOVER_PER_DAY?0:state.discover.count)+1};
      quests.progress.packs=Math.min(2,quests.progress.packs+1); state.stats.opened++; if(xset) state.stats[xset.stat]++; if(setName==='event') state.stats.eventOpened++; result.set=setName;
      result.message='Pack Découverte ouvert !'; xpGain=XP.open;
    } else if(item.id==='xp'){ state.boosts.xp=Math.max(state.boosts.xp,now)+30*60*1000; result.message='Double XP activé pour 30 minutes !'; }
    else if(item.id==='chance'){ state.boosts.luck=Math.max(state.boosts.luck,now)+60*60*1000; result.message='Chance +50 % activée pour 1 heure !'; }
    else if(item.id==='race'){
      const rs=state.races, race=drawRace(random,'rare',now), isNew=!rs.owned[race.id];
      rs.owned[race.id]=(rs.owned[race.id]||0)+1; rs.rolls++;
      if(!rs.equipped) rs.equipped=race.id;
      if(!isNew) state.jetons=Math.round((state.jetons+RACE_REFUND)*100)/100;
      result.race={...race,new:isNew}; result.message=isNew?`Nouvelle race : ${race.nom} !`:`${race.nom}, déjà connue : ${RACE_REFUND} jeton remboursé.`; xpGain=XP.race;
    }
  } else if(body.action==='animals') {
    const pick=ANIMALS.find(a=>a.id===body.pick);
    if(!pick) throw Error('Choisis un animal.');
    const bet=takeBet(body.bet);
    let roll=random()*ANIMALS.reduce((a,x)=>a+x.chance,0), winner=ANIMALS.at(-1);
    for(const a of ANIMALS){ roll-=a.chance; if(roll<0){ winner=a; break; } }
    const order=[winner,...shuffle(ANIMALS.filter(a=>a.id!==winner.id))];
    result.order=order.map(a=>a.id); result.win=winner.id===pick.id;
    if(result.win){ credit(bet*pick.gain); cPay=bet*pick.gain; result.message=`${winner.emoji} ${winner.nom} gagne la course ! +${round2(bet*pick.gain)} jetons.`; }
    else result.message=`${winner.emoji} ${winner.nom} gagne la course. Ta mise est perdue.`;
    xpGain=XP.casino;
  } else if(body.action==='mystery') {
    const pick=body.pick;
    if(![0,1,2].includes(pick)) throw Error('Choisis une carte.');
    const bet=takeBet(body.bet), treasure=Math.floor(random()*3);
    result.reveal=[0,1,2].map(i=>i===treasure?'💎':'💀'); result.pick=pick; result.win=pick===treasure;
    if(result.win){ credit(bet*MYSTERY_GAIN); cPay=bet*MYSTERY_GAIN; result.message=`Trésor trouvé ! +${round2(bet*MYSTERY_GAIN)} jetons.`; }
    else result.message='Raté : la carte cachait un piège. Ta mise est perdue.';
    xpGain=XP.casino;
  } else if(body.action==='dice') {
    const choice=body.choice;
    if(!(choice in DICE_GAINS)) throw Error('Choisis un pari.');
    const bet=takeBet(body.bet), a=1+Math.floor(random()*6), b=1+Math.floor(random()*6), sum=a+b;
    result.dice=[a,b]; result.win=choice==='plus'?sum>7:choice==='moins'?sum<7:sum===7;
    if(result.win){ credit(bet*DICE_GAINS[choice]); cPay=bet*DICE_GAINS[choice]; result.message=`${sum} ! Gagné : +${round2(bet*DICE_GAINS[choice])} jetons.`; }
    else result.message=`${sum}. Perdu, ta mise est partie.`;
    xpGain=XP.casino;
  } else if(body.action==='bomb_start') {
    if(state.bomb) throw Error('Une partie de bombe est déjà en cours.');
    const bet=takeBet(body.bet);
    state.bomb={bet,bombs:shuffle([...Array(BOMB_CELLS).keys()]).slice(0,BOMB_BOMBS),opened:[]};
    result.bomb={over:false,opened:[],bet}; result.message='Choisis une case.';
  } else if(body.action==='bomb_pick') {
    const b=state.bomb, i=body.index;
    if(!b) throw Error('Aucune partie en cours.');
    if(!Number.isInteger(i)||i<0||i>=BOMB_CELLS||b.opened.includes(i)) throw Error('Case indisponible.');
    if(b.bombs.includes(i)){
      state.stats.bombLoss++; state.stats.bombBest=Math.max(state.stats.bombBest,state.stats.bombLoss); cBet=b.bet; result.bomb={over:true,hit:i,bombs:b.bombs,opened:b.opened,won:0}; result.message='Boum ! Tu perds ta mise.'; state.bomb=null; xpGain=XP.casino;
    } else {
      b.opened.push(i); const mult=BOMB_MULTS[b.opened.length-1];
      if(b.opened.length>=BOMB_MULTS.length){ state.stats.bombPerfect=1;
        credit(b.bet*mult); state.stats.bombLoss=0; cBet=b.bet; cPay=b.bet*mult; cWin=true; result.bomb={over:true,cashed:true,bombs:b.bombs,opened:b.opened,mult,won:round2(b.bet*mult)};
        result.message=`Toutes les cases sûres trouvées ! +${round2(b.bet*mult)} jetons.`; state.bomb=null; xpGain=XP.casino;
      } else { result.bomb={over:false,opened:b.opened,bet:b.bet}; result.message=`Case sûre ! Tu peux encaisser ${round2(b.bet*mult)} jetons (×${mult}).`; }
    }
  } else if(body.action==='bomb_cash') {
    const b=state.bomb;
    if(!b||!b.opened.length) throw Error('Rien à encaisser.');
    const mult=BOMB_MULTS[b.opened.length-1];
    credit(b.bet*mult); state.stats.bombLoss=0; cBet=b.bet; cPay=b.bet*mult; cWin=true; result.bomb={over:true,cashed:true,bombs:b.bombs,opened:b.opened,mult,won:round2(b.bet*mult)};
    result.message=`Encaissé : +${round2(b.bet*mult)} jetons !`; state.bomb=null; xpGain=XP.casino;
  } else if(body.action==='daily') {
    const st=dailyStatus(state,now);
    if(st.claimed) throw Error('Récompense du jour déjà récupérée.');
    const streak=st.streak+1, reward=DAILY_REWARDS[(streak-1)%7];
    state.dailyReward={last:st.today,streak};
    if(reward.jetons) state.jetons=Math.round((state.jetons+reward.jetons*jm)*100)/100;
    if(reward.diamants) state.diamants+=reward.diamants;
    if(reward.boosters) state.bonus+=reward.boosters;
    result.reward=reward; result.message=`Récompense du jour récupérée ! Série : ${streak} jour${streak>1?'s':''}.`;
  } else if(body.action==='sellrace') {
    const race=RACES.find(r=>r.id===body.race), n=Math.max(0,(state.races.owned[race?.id]||0)-1);
    if(!race||!n) throw Error('Aucun doublon de cette race.');
    state.races.owned[race.id]=1; state.stats.sold+=n;
    const gain=n*SELL_VALUES[race.rarete]*(1+bonus.resale)*jm; credit(gain);
    quests.progress.sell=Math.min(3,quests.progress.sell+n);
    result.message=`${n} doublon(s) de ${race.nom} vendu(s) : +${round2(gain)} jeton(s).`;
  } else if(body.action==='profile') {
    const p=state.profile, b=body.profile||{}, level=levelInfo(state.xp).level;
    if('name' in b) p.name=String(b.name).replace(/[\u0000-\u001f<>&"']/g,'').trim().slice(0,16);
    if('avatar' in b){ if(b.avatar!==null && !(state.collection[b.avatar]>0)) throw Error('Avatar indisponible.'); p.avatar=b.avatar; }
    if('title' in b){ const t=TITLES.find(x=>x.id===b.title); if(!t||!t.ok(state)) throw Error('Titre pas encore débloqué.'); p.title=t.id; }
    if('theme' in b){ const t=THEMES.find(x=>x.id===b.theme); if(!t||!themeUnlocked(state,t)) throw Error('Thème pas encore débloqué.'); p.theme=t.id; }
    if('back' in b){ const t=BACKS.find(x=>x.id===b.back); if(!t||!t.ok(state)) throw Error('Dos de carte pas encore débloqué.'); p.back=t.id; }
    result.message='Profil enregistré.';
  } else if(body.action==='lock') {
    if(![...CARTES,...COSMOS,...MULTI,...EVENT_CARDS].some(c=>c.id===body.id)) throw Error('Carte inconnue.');
    if(body.locked) state.locks[body.id]=true; else delete state.locks[body.id];
    result.message=body.locked?'Carte verrouillée : elle ne sera jamais vendue.':'Carte déverrouillée.';
  } else if(body.action==='trade') {
    const tx=Object.hasOwn(SETS,body.set)?SETS[body.set]:null, table=tx?tx.trades:TRADES, cpool=tx?tx.cards:CARTES, labels=tx?tx.rar:RARETES;
    const t=Object.hasOwn(table,body.from)?table[body.from]:null;
    if(!t) throw Error('Échange inconnu.');
    const picks=body.picks&&typeof body.picks==='object'?body.picks:{}; let total=0;
    for(const [rawId,n] of Object.entries(picks)){
      const card=cpool.find(c=>c.id===Number(rawId));
      if(!card||card.rarete!==body.from||!Number.isInteger(n)||n<1) throw Error('Carte invalide pour cet échange.');
      if(state.locks[card.id]) throw Error(`${card.nom} est verrouillée.`);
      if((state.collection[card.id]||0)-1<n) throw Error(`Pas assez de doublons de ${card.nom}.`);
      total+=n;
    }
    if(total!==t.need) throw Error(`Il faut exactement ${t.need} doublons.`);
    const fresh=cpool.filter(c=>c.rarete===t.to&&!state.collection[c.id]);
    if(!fresh.length) throw Error(`Tu as déjà toutes les cartes ${labels[t.to].label} : cet échange ne te donnerait rien de nouveau.`);
    for(const [rawId,n] of Object.entries(picks)) state.collection[Number(rawId)]-=n;
    const reward=fresh[Math.floor(random()*fresh.length)];
    addSpecific(reward); state.stats.trades++;
    result.message=`Échange réussi : tu obtiens ${reward.nom} (${labels[t.to].label}) !`; xpGain=XP.trade;
  } else if(body.action==='fish') {
    const f=state.fish;
    if(f.casts<1) throw Error('Plus de ligne pour le moment : patiente un peu.');
    if(f.casts>=FISH_MAX) f.anchor=now;
    f.casts--; state.stats.fish++;
    if(body.hit===true){
      let roll=random()*FISH_LOOT.reduce((a,x)=>a+x.poids,0), loot=FISH_LOOT[0];
      for(const x of FISH_LOOT){ roll-=x.poids; if(roll<0){ loot=x; break; } }
      if(loot.jetons) credit(loot.jetons*jm);
      if(loot.diamants) state.diamants+=loot.diamants;
      if(loot.id!=='botte') state.stats.fishCaught++;
      if(loot.id==='coffre') state.stats.chest++;
      result.loot=loot;
      result.message=loot.jetons?`${loot.emoji} ${loot.nom} ! +${loot.jetons} jeton${loot.jetons>1?'s':''}.`:loot.diamants?`${loot.emoji} ${loot.nom} ! +${loot.diamants} diamant.`:`${loot.emoji} ${loot.nom}... rien de précieux.`;
    } else { result.loot=null; result.message='Il s’est échappé !'; }
    xpGain=XP.fish;
  } else if(body.action==='egg') {
    state.stats.egg=1; result.message='Tu es un curieux... on te remarque.';
  } else if(body.action==='equip') {
    const race=RACES.find(r=>r.id===body.race);
    if(!race || !state.races.owned[race.id]) throw Error('Race indisponible.');
    state.races.equipped=race.id;
    result.message=`${race.nom} équipée.`;
  } else if(body.action!=='sync') throw Error('Action inconnue.');
  if(xpGain===XP.casino){
    const st=state.stats; st.casino++; if(cWin||result.win){ st.wins++; st.lossStreak=0; } else { st.losses++; st.lossStreak++; st.lossBest=Math.max(st.lossBest,st.lossStreak); }
    const net=round2(cPay-cBet);
    if(net>0){ st.gained=round2(st.gained+net); st.bigWin=Math.max(st.bigWin,net); } else if(net<0){ st.lost=round2(st.lost-net); st.bigLoss=Math.max(st.bigLoss,-net); }
  }
  if(xpGain===XP.casino){ const dd=dayOf(now); if(state.casinoXp?.day!==dd) state.casinoXp={day:dd,xp:0}; const room=Math.max(0,CASINO_XP_CAP-state.casinoXp.xp); xpGain=Math.min(xpGain,room); state.casinoXp.xp+=xpGain; }
  let levelUps=[];
  if(xpGain&&state.boosts.xp>now) xpGain*=2;
  if(xpGain&&day.xp) xpGain=Math.round(xpGain*day.xp);
  if(xpGain){ levelUps=gainXp(state,xpGain); result.xpGain=xpGain; if(levelUps.length) result.message+=` Niveau ${levelUps.at(-1).level} atteint !`; }
  // Succès : on débloque tout ce qui est atteint (récompense en diamants + carte secrète éventuelle)
  const fresh=[];
  for(const a of ACHIEVEMENTS) if(!state.achievements[a.id] && a.metric(state)>=a.target){
    state.achievements[a.id]=now; if(a.diamants) state.diamants+=a.diamants; if(a.card) state.secrets[a.card]=true;
    fresh.push({id:a.id,nom:a.nom,icon:a.icon,diamants:a.diamants,card:a.card||null});
  }
  result.achievements=fresh;
  if(fresh.length) result.message=(result.message+` Succès : ${fresh.map(a=>a.nom).join(', ')} !`).trim();
  return {state,...result,levelUps,quests:QUESTS,serverTime:now};
}
