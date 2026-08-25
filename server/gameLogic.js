"use strict";
const GameData = require("../shared/gameData.js");
const { BUILDINGS, TROOPS, TROOP_ORDER, INFANTRY, CAVALRY, ARCHERS, GUILD_BOOSTS, SERVER_EVENTS,
        ACHIEVEMENTS, clamp,
        buildCost, buildTime, prodPerHour, storageCap, farmCap, trainTime } = GameData;

function now(){ return Date.now()/1000; } // "temps de jeu" en secondes réelles (vitesse toujours x1 en multijoueur)

/* Multiplicateur de vitesse global, réglable par un administrateur (panneau Admin).
   S'applique immédiatement à tout : production de ressources, files de construction et
   d'entraînement déjà en cours (recalées par adminSetSpeed) et nouvelles files. */
function getSpeedMultiplier(db){
  return (db.settings && db.settings.speedMultiplier) || 1;
}

/* ------------------------------------------------------------------------ */
/*  Évènements de serveur (panneau Admin) : boosts temporaires visibles et    */
/*  appliqués à TOUS les joueurs (contrairement aux boosts de guilde, propres */
/*  à une seule guilde). Voir SERVER_EVENTS dans shared/gameData.js.          */
/* ------------------------------------------------------------------------ */

function pruneServerEvents(db){
  const t = now();
  db.serverEvents = (db.serverEvents||[]).filter(e=>e.endAt>t);
}

/* Multiplicateur cumulé de tous les évènements actifs affectant "affects" (ex. "production",
   "build", "train", "move", "loot", "points"). 1 s'il n'y en a aucun. En pratique un seul
   évènement par "affects" peut être actif à la fois (adminStartServerEvent remplace l'ancien),
   mais la boucle reste robuste si jamais plusieurs coexistaient. */
function serverEventMultiplier(db, affects){
  pruneServerEvents(db);
  let mult = 1;
  for(const e of db.serverEvents) if(e.affects===affects) mult *= e.multiplier;
  return mult;
}

/* Vue publique des évènements actifs (envoyée dans chaque instantané, à tous les joueurs — pas
   seulement aux admins — pour afficher une bannière "Boost de production x2, encore 12 min"). */
function publicServerEvents(db){
  pruneServerEvents(db);
  const t = now();
  return db.serverEvents.map(e=>({
    id:e.id, key:e.key, name:e.name, icon:e.icon, affects:e.affects, multiplier:e.multiplier,
    remainingSec: Math.max(0, Math.round(e.endAt-t))
  }));
}

// Nombre maximum de nobles vivants qu'un même village peut entretenir à la fois.
const NOBLE_CAP_PER_VILLAGE = 4;
// Nombre maximum de nobles qu'une seule attaque peut emporter (voir doMission).
const NOBLE_PER_ATTACK_CAP = 1;

function villageWall(v){ return v.owner==="barbarian" ? (v.wallLevel||0) : (v.buildings.wall||0); }
function villageHide(v){ return v.owner==="barbarian" ? (v.hideLevel||0) : (v.buildings.hide||0); }
function villageResCap(v){ return v.owner==="barbarian" ? (v.resCap||600) : storageCap(v.buildings.warehouse); }

function pushReport(db, username, report){
  if(!db.reports[username]) db.reports[username] = [];
  // Identifiant stable pour permettre au joueur de supprimer un rapport précis côté client.
  if(!report.id) report.id = "rp"+Date.now()+"_"+Math.floor(Math.random()*1000000);
  db.reports[username].unshift(report);
  if(db.reports[username].length>60) db.reports[username].length=60;
}

/* Supprime un ou plusieurs rapports (par id) de la boîte de rapports d'un joueur. */
function doReportDelete(db, username, ids){
  const arr = db.reports[username];
  if(!arr || !arr.length) return { error:"Aucun rapport à supprimer." };
  const idList = Array.isArray(ids) ? ids : [ids];
  const idSet = new Set(idList.map(String).filter(Boolean));
  if(!idSet.size) return { error:"Aucun identifiant de rapport fourni." };
  const before = arr.length;
  db.reports[username] = arr.filter(r=>!idSet.has(String(r.id)));
  const removed = before - db.reports[username].length;
  if(removed<=0) return { error:"Rapport introuvable (déjà supprimé ?)." };
  return { ok:true, removed };
}

/* Supprime en masse les rapports d'un joueur, éventuellement filtrés par catégorie (kind). */
function doReportClear(db, username, kind){
  const arr = db.reports[username];
  if(!arr || !arr.length) return { error:"Aucun rapport à supprimer." };
  const before = arr.length;
  db.reports[username] = kind ? arr.filter(r=>r.kind!==kind) : [];
  const removed = before - db.reports[username].length;
  if(removed<=0) return { error:"Aucun rapport correspondant à cette catégorie." };
  return { ok:true, removed };
}

/* Village "actif" d'un joueur : celui qu'il gère actuellement dans l'interface (bâtiments,
   entraînement, envoi de troupes...). Par défaut son village d'origine, mais un joueur peut
   posséder plusieurs villages (après une conquête) et choisir lequel gérer via doSwitchVillage.
   Si le village actif enregistré n'existe plus ou ne lui appartient plus, on retombe sur le
   village d'origine (qui, lui, ne peut jamais être perdu — voir resolveAttack). */
function villageByUser(db, username){
  const u = db.users[username];
  if(!u) return null;
  const activeId = u.activeVillageId || u.villageId;
  let v = db.villages[activeId];
  if(!v || v.owner!==username){
    v = db.villages[u.villageId] || null;
    u.activeVillageId = u.villageId;
  }
  return v;
}

/* Village d'origine (capitale) d'un joueur, indépendamment du village actuellement actif dans
   l'interface : utilisé pour les actions qui doivent viser un point stable et prévisible (recevoir
   un don, être la cible d'une riposte barbare, ou pour l'administration). */
function homeVillageOf(db, username){
  const u = db.users[username];
  if(!u) return null;
  return db.villages[u.villageId] || null;
}

/* Tous les villages actuellement possédés par un joueur (son village d'origine, plus tout village
   barbare conquis) : la liste affichée par le sélecteur de village côté client. */
function myVillages(db, username){
  return Object.values(db.villages).filter(v=>v.owner===username);
}

/* Accumule dans "acc" les niveaux de construction et les conquêtes d'UN village. Factorisé pour
   que le score d'un seul joueur (fiche joueur) et celui de tout le monde (classement) utilisent
   exactement le même calcul et ne puissent jamais afficher deux totaux différents. */
function accumulateVillageScore(acc, v){
  if(v.buildings){ for(const k in v.buildings) acc.buildingLevels += (v.buildings[k]||0); }
  acc.conquered += (v.conqueredCount||0);
}
// mult : multiplicateur de l'évènement "pointsBoost" éventuellement actif (voir serverEventMultiplier),
// appliqué au TOTAL affiché plutôt qu'aux accumulateurs bruts, pour ne jamais fausser buildingLevels/conquered.
function scoreToPoints(acc, mult){ return Math.round((acc.buildingLevels*10 + acc.conquered*50)*(mult||1)); }

/* Score d'UN joueur : somme des niveaux de TOUTES ses constructions (tous types confondus) sur
   TOUS ses villages (village d'origine + conquis), plus un bonus pour les conquêtes réalisées —
   elles aussi cumulées sur tous ses villages, et non plus seulement celles lancées depuis le
   village d'origine comme c'était le cas avant. */
function computePlayerScore(db, targetUsername){
  const villages = myVillages(db, targetUsername);
  const acc = { buildingLevels:0, conquered:0 };
  for(const v of villages) accumulateVillageScore(acc, v);
  const mult = serverEventMultiplier(db, "points");
  return { points: scoreToPoints(acc, mult), buildingLevels: acc.buildingLevels, conquered: acc.conquered, villageCount: villages.length };
}

/* Score de TOUS les joueurs en un seul passage sur db.villages, au lieu d'appeler
   computePlayerScore() (qui reparcourt tout le monde) une fois par joueur — utilisé par le
   classement, recalculé à chaque instantané envoyé à un joueur connecté (sondage toutes les 2,5s). */
function computeAllPlayerScores(db){
  const scores = {};
  for(const uname in db.users) scores[uname] = { buildingLevels:0, conquered:0, villageCount:0 };
  for(const id in db.villages){
    const v = db.villages[id];
    if(v.owner==="barbarian" || !scores[v.owner]) continue;
    scores[v.owner].villageCount++;
    accumulateVillageScore(scores[v.owner], v);
  }
  const mult = serverEventMultiplier(db, "points");
  for(const uname in scores) scores[uname].points = scoreToPoints(scores[uname], mult);
  return scores;
}

/* Change le village actuellement géré par le joueur (doit lui appartenir). */
function doSwitchVillage(db, username, villageId){
  const u = db.users[username];
  if(!u) return { error:"Utilisateur introuvable." };
  const v = db.villages[String(villageId)];
  if(!v) return { error:"Village introuvable." };
  if(v.owner!==username) return { error:"Ce village ne vous appartient pas." };
  u.activeVillageId = v.id;
  return { ok:true };
}

/* ---------------------------------------------------------------------- */
/*  Actions joueur                                                         */
/* ---------------------------------------------------------------------- */

function doBuild(db, username, key){
  const v = villageByUser(db, username);
  if(!v) return { error: "Village introuvable." };
  const b = BUILDINGS[key];
  if(!b) return { error: "Bâtiment inconnu." };
  const cur = v.buildings[key]||0;
  if(v.buildQueue.length>=6) return { error: "File de construction pleine (max 6)." };
  // Niveau visé = niveau actuel + nombre de mises à niveau déjà en file pour CE bâtiment :
  // sans ça, spammer le bouton "améliorer" facturait plusieurs fois le coût du même niveau
  // au lieu de faire progresser le coût comme il se doit (bug corrigé).
  const pendingForKey = v.buildQueue.filter(o=>o.key===key).length;
  const nextLevel = cur+pendingForKey+1;
  if(nextLevel > b.max) return { error: "Niveau maximum atteint pour "+b.name+"." };
  if(b.requires){ for(const rk in b.requires){ if((v.buildings[rk]||0) < b.requires[rk]) return { error: "Prérequis manquant pour "+b.name+"." }; } }
  const cost = buildCost(key, nextLevel);
  if(v.resources.wood<cost.wood || v.resources.clay<cost.clay || v.resources.iron<cost.iron) return { error: "Ressources insuffisantes pour "+b.name+"." };
  v.resources.wood-=cost.wood; v.resources.clay-=cost.clay; v.resources.iron-=cost.iron;
  const dur = buildTime(key, nextLevel, v.buildings.hq) / getSpeedMultiplier(db) / guildBoostMultiplier(guildOf(db, username), "speed") / serverEventMultiplier(db, "build");
  // Une seule construction est réellement en cours à la fois dans le village (peu importe le
  // bâtiment) : chaque nouvel ordre démarre à la fin du DERNIER de toute la file, jamais
  // immédiatement. Avant ce correctif, deux bâtiments DIFFÉRENTS démarraient tous les deux à
  // now() ; comme runTick() ne fait avancer que le premier de la file, les suivants avaient déjà
  // dépassé leur propre durée en attendant leur tour et se terminaient donc instantanément dès
  // qu'ils passaient en tête de file, au lieu d'attendre leur vrai temps de construction.
  let chainStart = now();
  if(v.buildQueue.length){
    const last = v.buildQueue[v.buildQueue.length-1];
    chainStart = last.startAt + last.duration;
  }
  v.buildQueue.push({ key, level: nextLevel, startAt: chainStart, duration: dur });
  return { ok: true };
}

/* Annule un ordre de construction en file (par son index) et rembourse intégralement son coût.
   Si c'est le premier de la file (en cours), le suivant démarre immédiatement ; les éléments
   après l'annulation sont réenchaînés correctement (sans jamais toucher au minutage de l'élément
   toujours en tête s'il n'est pas celui annulé). */
function doBuildCancel(db, username, index){
  const v = villageByUser(db, username);
  if(!v) return { error: "Village introuvable." };
  index = Math.floor(Number(index));
  if(!Number.isInteger(index) || index<0 || index>=v.buildQueue.length) return { error: "Élément de file introuvable." };
  const item = v.buildQueue[index];
  const cost = buildCost(item.key, item.level);
  const cap = storageCap(v.buildings.warehouse);
  // Comme pour la production (runTick) : ne jamais faire REDESCENDRE un stock déjà au-dessus du
  // plafond (ex. après un ajustement admin) — le remboursement ne fait jamais perdre de ressources.
  for(const r of ["wood","clay","iron"]){
    v.resources[r] = Math.max(v.resources[r], Math.min(v.resources[r]+cost[r], cap));
  }
  v.buildQueue.splice(index, 1);
  if(index===0 && v.buildQueue.length) v.buildQueue[0].startAt = now();
  for(let i=1;i<v.buildQueue.length;i++){
    v.buildQueue[i].startAt = v.buildQueue[i-1].startAt + v.buildQueue[i-1].duration;
  }
  return { ok: true };
}

function doTrain(db, username, key, count){
  const v = villageByUser(db, username);
  if(!v) return { error: "Village introuvable." };
  count = Math.floor(count);
  if(!count || count<=0) return { error: "Quantité invalide." };
  const t = TROOPS[key];
  if(!t) return { error: "Troupe inconnue." };
  for(const rk in t.requires){ if((v.buildings[rk]||0) < t.requires[rk]) return { error: "Bâtiment requis insuffisant pour "+t.name+"." }; }
  if(key==="noble"){
    // Une Académie (niveau max 1) autorise jusqu'à NOBLE_CAP_PER_VILLAGE nobles vivants à la fois
    // DANS CE VILLAGE (chaque village conquis peut avoir la sienne et former les siens séparément).
    // Un seul noble peut en revanche partir par attaque (voir doMission).
    const hasAcademy = (v.buildings.academy||0) > 0;
    if(!hasAcademy) return { error: "Construisez une Académie pour pouvoir former des Nobles." };
    const cap = NOBLE_CAP_PER_VILLAGE;
    const alive = (v.troops.noble||0) + v.trainQueue.filter(o=>o.troop==="noble").reduce((s,o)=>s+o.count,0);
    if(alive+count > cap) return { error: cap+" noble(s) vivant(s) maximum à la fois dans ce village." };
  }
  const cost = { wood:t.cost.wood*count, clay:t.cost.clay*count, iron:t.cost.iron*count };
  if(v.resources.wood<cost.wood || v.resources.clay<cost.clay || v.resources.iron<cost.iron) return { error: "Ressources insuffisantes pour entraîner "+count+" "+t.name+"." };
  const used = popUsed(v);
  const free = farmCap(v.buildings.farm) - used;
  if(t.pop*count > free) return { error: "Population insuffisante (ferme trop petite)." };
  if(v.trainQueue.length>=8) return { error: "File d'entraînement pleine (max 8)." };
  v.resources.wood-=cost.wood; v.resources.clay-=cost.clay; v.resources.iron-=cost.iron;
  v.trainQueue.push({ troop:key, count, unitStartAt: now(), unitDuration: trainTime(key, v.buildings.barracks) / getSpeedMultiplier(db) / guildBoostMultiplier(guildOf(db, username), "train") / serverEventMultiplier(db, "train") });
  return { ok: true };
}

/* Licencie (détruit définitivement) des troupes STATIONNÉES dans le village actif — jamais celles
   parties en mission (m.troops, décompté du village dès le départ, voir doMission) ni celles encore
   en formation (v.trainQueue). Aucun remboursement de ressources : à la différence de l'annulation
   d'une construction en file (doBuildCancel), la troupe existe déjà bel et bien, donc la licencier
   ne "rend" rien — sert simplement à libérer de la population (ex. avant d'entraîner autre chose)
   sans attendre qu'elle meure au combat. */
function doDisbandTroops(db, username, key, count){
  const v = villageByUser(db, username);
  if(!v) return { error: "Village introuvable." };
  count = Math.floor(count);
  if(!count || count<=0) return { error: "Quantité invalide." };
  const t = TROOPS[key];
  if(!t) return { error: "Troupe inconnue." };
  const have = v.troops[key]||0;
  if(count > have) return { error: "Vous n'avez que "+have+" "+t.name+"(s) dans ce village." };
  v.troops[key] = have-count;
  return { ok: true };
}

function popUsed(v){
  let used=0;
  for(const k of TROOP_ORDER) used += (v.troops[k]||0)*TROOPS[k].pop;
  for(const o of v.trainQueue) used += o.count*TROOPS[o.troop].pop;
  return Math.round(used);
}

function doMission(db, username, targetId, kind, troopsWanted){
  const v = villageByUser(db, username);
  if(!v) return { error: "Village introuvable." };
  const target = db.villages[String(targetId)];
  if(!target) return { error: "Village ciblé introuvable." };
  if(target.owner===username) return { error: "Ce village vous appartient déjà." };
  const troops = {};
  let any=false, maxSpeed=0;
  for(const k of TROOP_ORDER){
    let n = Math.floor(Number(troopsWanted[k])||0);
    n = Math.max(0, Math.min(n, v.troops[k]||0));
    // Un seul Noble peut partir par attaque (l'escorte protège toujours ce noble unique) : sans
    // cette limite, plusieurs nobles envoyés d'un coup rendraient la conquête bien trop facile.
    if(k==="noble") n = Math.min(n, NOBLE_PER_ATTACK_CAP);
    if(n>0){ troops[k]=n; any=true; maxSpeed=Math.max(maxSpeed, TROOPS[k].speed); }
  }
  if(!any) return { error: "Sélectionnez au moins une troupe à envoyer." };
  if(kind==="scout" && !troops.scout) return { error: "Une reconnaissance nécessite au moins un éclaireur." };
  for(const k in troops) v.troops[k]-=troops[k];
  const dx=target.x-v.x, dy=target.y-v.y, dist=Math.sqrt(dx*dx+dy*dy);
  const travel = Math.max(4, Math.round(dist*maxSpeed/serverEventMultiplier(db,"move")));
  const t = now();
  const mission = {
    id: "m"+Date.now()+Math.floor(Math.random()*100000),
    kind, attackerUsername: username, sourceVillageId: v.id, targetId: target.id, troops,
    departAt: t, arriveAt: t+travel, travel, resolveDone:false, returnAt:null, completed:false
  };
  if(kind==="attack"){
    if(!target.aggro || typeof target.aggro !== "object") target.aggro = {};
    if(target.owner==="barbarian") target.aggro[username] = (target.aggro[username]||0) + 1;
  }
  db.missions.push(mission);
  return { ok:true, travel };
}

/* Envoie des troupes en renfort dans un village allié (joueur) : elles voyagent puis se stationnent
   là-bas (v.support) où elles comptent pour la défense, jusqu'à un rappel explicite. */
function doSendSupport(db, username, targetId, troopsWanted){
  const v = villageByUser(db, username);
  if(!v) return { error: "Village introuvable." };
  const target = db.villages[String(targetId)];
  if(!target) return { error: "Village ciblé introuvable." };
  if(target.owner==="barbarian") return { error: "Impossible d'envoyer du soutien à un village barbare." };
  const troops={};
  let any=false, maxSpeed=0;
  for(const k of TROOP_ORDER){
    let n = Math.floor(Number(troopsWanted[k])||0);
    n = Math.max(0, Math.min(n, v.troops[k]||0));
    if(n>0){ troops[k]=n; any=true; maxSpeed=Math.max(maxSpeed, TROOPS[k].speed); }
  }
  if(!any) return { error: "Sélectionnez au moins une troupe à envoyer." };
  for(const k in troops) v.troops[k]-=troops[k];
  const dx=target.x-v.x, dy=target.y-v.y, dist=Math.sqrt(dx*dx+dy*dy);
  const travel = Math.max(4, Math.round(dist*maxSpeed/serverEventMultiplier(db,"move")));
  const t = now();
  db.missions.push({
    id: "sp"+Date.now()+Math.floor(Math.random()*100000),
    kind:"support", attackerUsername: username, sourceVillageId: v.id, targetId: target.id, troops,
    departAt: t, arriveAt: t+travel, travel, resolveDone:false, returnAt:null, completed:false
  });
  bumpStat(db, username, "supportsSent", 1);
  return { ok:true, travel };
}

/* Rappelle chez soi un contingent de soutien précédemment envoyé (par son id de station) : les
   troupes quittent immédiatement la défense du village hôte et voyagent vers le village d'origine. */
function doRecallSupport(db, username, supportId){
  let hostVillage=null, entry=null;
  for(const id in db.villages){
    const v = db.villages[id];
    if(!v.support) continue;
    const s = v.support.find(x=>x.id===supportId);
    if(s){ hostVillage=v; entry=s; break; }
  }
  if(!entry) return { error: "Soutien introuvable (déjà rappelé ?)." };
  if(entry.from!==username) return { error: "Vous ne pouvez rappeler que vos propres troupes en soutien." };
  hostVillage.support = hostVillage.support.filter(x=>x.id!==supportId);
  // Les troupes rentrent au village qui les a envoyées à l'origine (pas forcément le village
  // actuellement actif du joueur, s'il en possède plusieurs).
  const homeVillage = db.villages[entry.fromVillageId] || villageByUser(db, username);
  if(!homeVillage) return { ok:true };
  const dx=homeVillage.x-hostVillage.x, dy=homeVillage.y-hostVillage.y, dist=Math.sqrt(dx*dx+dy*dy);
  let maxSpeed=0;
  for(const k in entry.troops) if(entry.troops[k]>0) maxSpeed=Math.max(maxSpeed, TROOPS[k].speed);
  const travel = Math.max(4, Math.round(dist*maxSpeed/serverEventMultiplier(db,"move")));
  const t = now();
  db.missions.push({
    id: "spr"+Date.now()+Math.floor(Math.random()*100000),
    kind:"supportReturn", attackerUsername: username, sourceVillageId: hostVillage.id, targetId: homeVillage.id,
    troops: {...entry.troops}, departAt: t, arriveAt: t+travel, travel, resolveDone:true, returnAt: t+travel, completed:false
  });
  return { ok:true };
}

/* Don direct de ressources à un autre joueur (abstraction sans marchand ni délai de trajet, pour
   rester simple) : prélevées immédiatement chez le donateur, livrées immédiatement chez le
   destinataire (plafonnées par sa capacité de stockage, comme un surplus de production). */
function doGiveResources(db, username, targetUsername, wood, clay, iron){
  const v = villageByUser(db, username);
  if(!v) return { error: "Village introuvable." };
  targetUsername = String(targetUsername||"").trim();
  if(targetUsername===username) return { error: "Impossible de vous donner des ressources à vous-même." };
  // Toujours livré dans le village d'ORIGINE du destinataire (prévisible pour l'expéditeur, qui ne
  // sait pas forcément lequel de ses villages le destinataire gère actuellement).
  const target = homeVillageOf(db, targetUsername);
  if(!target) return { error: "Joueur cible introuvable." };
  const amt = { wood:Math.max(0,Math.floor(Number(wood)||0)), clay:Math.max(0,Math.floor(Number(clay)||0)), iron:Math.max(0,Math.floor(Number(iron)||0)) };
  if(!amt.wood && !amt.clay && !amt.iron) return { error: "Indiquez au moins une ressource à donner." };
  if(v.resources.wood<amt.wood || v.resources.clay<amt.clay || v.resources.iron<amt.iron) return { error: "Ressources insuffisantes." };
  v.resources.wood-=amt.wood; v.resources.clay-=amt.clay; v.resources.iron-=amt.iron;
  const cap = storageCap(target.buildings.warehouse);
  // Comme un surplus de production : ne fait jamais perdre de ressources déjà au-dessus du plafond.
  for(const r of ["wood","clay","iron"]) target.resources[r]=Math.max(target.resources[r], Math.min(target.resources[r]+amt[r], cap));
  pushReport(db, targetUsername, { kind:"giftIn", time:now(), from:username, wood:amt.wood, clay:amt.clay, iron:amt.iron });
  pushReport(db, username, { kind:"giftOut", time:now(), target:targetUsername, wood:amt.wood, clay:amt.clay, iron:amt.iron });
  return { ok:true };
}

/* Transfert instantané de ressources entre DEUX villages appartenant au MÊME joueur (sans marchand
   ni délai de trajet, comme doGiveResources ci-dessus) — sert notamment à ravitailler un village
   nouvellement conquis, ou à concentrer des ressources vers celui qui construit/entraîne le plus.
   Contrairement à doGiveResources (toujours livré au village d'ORIGINE d'un AUTRE joueur), ici
   c'est le joueur lui-même qui choisit le village de destination PARMI les siens. */
function doTransferResourcesBetweenVillages(db, username, sourceVillageId, targetVillageId, wood, clay, iron){
  const source = db.villages[sourceVillageId];
  if(!source || source.owner!==username) return { error: "Village source introuvable." };
  const target = db.villages[targetVillageId];
  if(!target || target.owner!==username) return { error: "Village de destination introuvable." };
  if(source.id===target.id) return { error: "Choisissez un village de destination différent." };
  const amt = { wood:Math.max(0,Math.floor(Number(wood)||0)), clay:Math.max(0,Math.floor(Number(clay)||0)), iron:Math.max(0,Math.floor(Number(iron)||0)) };
  if(!amt.wood && !amt.clay && !amt.iron) return { error: "Indiquez au moins une ressource à transférer." };
  if(source.resources.wood<amt.wood || source.resources.clay<amt.clay || source.resources.iron<amt.iron){
    return { error: "Ressources insuffisantes dans le village source." };
  }
  source.resources.wood-=amt.wood; source.resources.clay-=amt.clay; source.resources.iron-=amt.iron;
  const cap = storageCap(target.buildings.warehouse);
  // Comme un surplus de production ou un don reçu : ne fait jamais perdre de ressources déjà au-dessus du plafond.
  for(const r of ["wood","clay","iron"]) target.resources[r]=Math.max(target.resources[r], Math.min(target.resources[r]+amt[r], cap));
  return { ok:true };
}

const MARKET_RES_KEYS = ["wood","clay","iron"];

/* ---------------------------------------------------------------------- */
/*  Marché (offres d'échange entre joueurs)                                */
/* ---------------------------------------------------------------------- */

/* Publie une offre d'échange visible par tous ("je donne X {giveRes} contre Y {wantRes}").
   Contrairement au don direct (doGiveResources, instantané et sans contrepartie), la ressource
   offerte est mise en dépôt dès la publication (retirée du village vendeur immédiatement) : elle
   n'est livrée à l'acheteur qu'à l'acceptation, et rendue au vendeur s'il annule avant. Toujours
   sans marchands ni délai de trajet, pour rester dans l'esprit simplifié déjà adopté ailleurs
   (voir doGiveResources, doSendSupport...). */
function doMarketCreateOffer(db, username, giveRes, giveAmount, wantRes, wantAmount){
  const v = villageByUser(db, username);
  if(!v) return { error: "Village introuvable." };
  giveRes = String(giveRes||""); wantRes = String(wantRes||"");
  giveAmount = Math.floor(Number(giveAmount)||0);
  wantAmount = Math.floor(Number(wantAmount)||0);
  if(!MARKET_RES_KEYS.includes(giveRes) || !MARKET_RES_KEYS.includes(wantRes)) return { error: "Ressource invalide." };
  if(giveRes===wantRes) return { error: "Choisissez deux ressources différentes." };
  if(giveAmount<=0 || wantAmount<=0) return { error: "Indiquez des quantités valides (supérieures à zéro)." };
  if(giveAmount>1000000 || wantAmount>1000000) return { error: "Quantité trop élevée (maximum 1 000 000)." };
  if((v.resources[giveRes]||0) < giveAmount) return { error: "Ressources insuffisantes pour publier cette offre." };
  if(!db.market) db.market = [];
  if(db.market.length>=200) return { error: "Trop d'offres actives sur le marché en ce moment, réessayez plus tard." };
  v.resources[giveRes] -= giveAmount;
  const offer = {
    id: "mk"+Date.now()+Math.floor(Math.random()*100000),
    seller: username, sellerVillageId: v.id,
    giveRes, giveAmount, wantRes, wantAmount,
    createdAt: now()
  };
  db.market.push(offer);
  return { ok:true, offer };
}

/* Annule une offre publiée (uniquement par son propre auteur) et lui rend la ressource mise en
   dépôt, plafonnée par la capacité de stockage actuelle de son village d'origine (comme un
   surplus de production — ne fait jamais perdre de ressources déjà au-dessus du plafond). Si ce
   village a depuis été perdu (conquête), le dépôt reste perdu : cohérent avec le sort du reste de
   ses ressources dans un village conquis. */
function doMarketCancelOffer(db, username, offerId){
  const offers = db.market||[];
  const idx = offers.findIndex(o=>o.id===offerId);
  if(idx<0) return { error: "Offre introuvable (déjà acceptée ou annulée ?)." };
  const offer = offers[idx];
  if(offer.seller!==username) return { error: "Vous ne pouvez annuler que vos propres offres." };
  offers.splice(idx,1);
  const homeVillage = db.villages[offer.sellerVillageId];
  if(homeVillage && homeVillage.owner===username){
    const cap = storageCap(homeVillage.buildings.warehouse);
    homeVillage.resources[offer.giveRes] = Math.max(homeVillage.resources[offer.giveRes], Math.min(homeVillage.resources[offer.giveRes]+offer.giveAmount, cap));
  }
  return { ok:true };
}

/* Accepte l'offre d'un autre joueur : prélève ce qui est demandé chez l'acheteur (son village
   actif), le livre au vendeur (plafonné par son stockage), et livre la ressource mise en dépôt à
   l'acheteur (plafonné par le sien). */
function doMarketAcceptOffer(db, username, offerId){
  const offers = db.market||[];
  const idx = offers.findIndex(o=>o.id===offerId);
  if(idx<0) return { error: "Offre introuvable (déjà acceptée ou annulée ?)." };
  const offer = offers[idx];
  if(offer.seller===username) return { error: "Vous ne pouvez pas accepter votre propre offre." };
  const buyerVillage = villageByUser(db, username);
  if(!buyerVillage) return { error: "Village introuvable." };
  const sellerVillage = db.villages[offer.sellerVillageId];
  if(!sellerVillage || sellerVillage.owner!==offer.seller){
    offers.splice(idx,1); // village vendeur introuvable/conquis depuis : offre périmée, on la retire
    return { error: "Cette offre n'est plus valable (village du vendeur introuvable)." };
  }
  if((buyerVillage.resources[offer.wantRes]||0) < offer.wantAmount) return { error: "Ressources insuffisantes pour accepter cette offre." };
  offers.splice(idx,1);
  buyerVillage.resources[offer.wantRes] -= offer.wantAmount;
  const buyerCap = storageCap(buyerVillage.buildings.warehouse);
  buyerVillage.resources[offer.giveRes] = Math.max(buyerVillage.resources[offer.giveRes], Math.min(buyerVillage.resources[offer.giveRes]+offer.giveAmount, buyerCap));
  const sellerCap = storageCap(sellerVillage.buildings.warehouse);
  sellerVillage.resources[offer.wantRes] = Math.max(sellerVillage.resources[offer.wantRes], Math.min(sellerVillage.resources[offer.wantRes]+offer.wantAmount, sellerCap));
  pushReport(db, offer.seller, { kind:"marketSold", time:now(), other:username, giveRes:offer.giveRes, giveAmount:offer.giveAmount, wantRes:offer.wantRes, wantAmount:offer.wantAmount });
  pushReport(db, username, { kind:"marketBought", time:now(), other:offer.seller, giveRes:offer.giveRes, giveAmount:offer.giveAmount, wantRes:offer.wantRes, wantAmount:offer.wantAmount });
  bumpStat(db, offer.seller, "marketTrades", 1);
  bumpStat(db, username, "marketTrades", 1);
  return { ok:true };
}

/* ---------------------------------------------------------------------- */
/*  Résolution des combats                                                 */
/* ---------------------------------------------------------------------- */

function computePower(troops, statKey){
  // pour l'attaque : renvoie {power, shareInf, shareCav, shareArch}
  let power=0;
  for(const k in troops) power += (troops[k]||0)*TROOPS[k].atk;
  let shareInf=0, shareCav=0, shareArch=0;
  if(power>0){
    for(const k in troops){
      const contrib=(troops[k]||0)*TROOPS[k].atk;
      if(INFANTRY.includes(k)) shareInf+=contrib;
      else if(CAVALRY.includes(k)) shareCav+=contrib;
      else if(ARCHERS.includes(k)) shareArch+=contrib;
    }
    shareInf/=power; shareCav/=power; shareArch/=power;
  }
  return { power, shareInf, shareCav, shareArch };
}

function defensePowerOf(defTroops, shareInf, shareCav, shareArch, wallLevel){
  let defensePower=0;
  for(const k of TROOP_ORDER){
    const c=defTroops[k]||0;
    if(!c) continue;
    const t=TROOPS[k];
    defensePower += c*(t.defInf*shareInf + t.defCav*shareCav + t.defArch*shareArch);
  }
  defensePower *= (1+(wallLevel||0)*0.05);
  return defensePower;
}

/* Troupes du village + toutes les troupes de soutien qui y sont stationnées (comptent pour la
   défense au même titre que les troupes du propriétaire). */
function combinedDefenseTroops(v){
  if(!v.support || !v.support.length) return v.troops;
  const combined = {...v.troops};
  for(const s of v.support){ for(const k in s.troops) combined[k]=(combined[k]||0)+(s.troops[k]||0); }
  return combined;
}

/* Applique une fraction de pertes au total (troupes du village + soutien confondus) pour chaque
   type de troupe, puis répartit les pertes réelles : d'abord sur les troupes du village (au
   prorata, arrondi à l'entier inférieur), le reste sur les contingents de soutien dans l'ordre —
   ce qui garantit que la somme des pertes correspond exactement au total calculé. */
function applyDefenseLosses(v, lossFrac){
  const survivorFrac = 1-lossFrac;
  const defenderLosses = {};
  for(const k of TROOP_ORDER){
    const homeCount = v.troops[k]||0;
    const support = v.support||[];
    const total = homeCount + support.reduce((s,e)=>s+(e.troops[k]||0),0);
    if(!total) continue;
    const survivors = Math.floor(total*survivorFrac);
    const losses = total-survivors;
    defenderLosses[k]=losses;
    let toRemove = losses;
    const homeRemove = Math.min(homeCount, Math.floor(losses*homeCount/total));
    v.troops[k] = homeCount-homeRemove;
    toRemove -= homeRemove;
    for(const e of support){
      if(toRemove<=0) break;
      const cnt = e.troops[k]||0;
      if(!cnt) continue;
      const take = Math.min(cnt, toRemove);
      e.troops[k] = cnt-take;
      toRemove -= take;
    }
  }
  if(v.support) v.support = v.support.filter(e=>TROOP_ORDER.some(k=>(e.troops[k]||0)>0));
  return defenderLosses;
}

function resolveScout(db, m){
  const target = db.villages[m.targetId];
  m.resolveDone=true; m.returnAt=m.arriveAt+m.travel;
  if(!target){ pushReport(db, m.attackerUsername, {kind:"scout", time:now(), lost:true, text:"Le village ciblé n'existe plus."}); return; }
  pushReport(db, m.attackerUsername, {
    kind:"scout", time:now(), targetId: target.id, target:target.name, coord:target.x+"|"+target.y,
    resources:{...target.resources}, troops:{...target.troops}, wallLevel: villageWall(target),
    loyalty: target.owner==="barbarian" ? (target.loyalty==null?100:target.loyalty) : null,
    isPlayer: target.owner!=="barbarian"
  });
}

/* Arrivée d'un renfort : les troupes se stationnent dans le village visé (v.support) au lieu de
   revenir — contrairement aux autres missions, elle n'a pas de trajet retour automatique (seul un
   rappel explicite en crée un). */
function resolveSupportArrival(db, m){
  m.resolveDone=true; m.completed=true;
  const target = db.villages[m.targetId];
  if(!target){
    pushReport(db, m.attackerUsername, { kind:"supportOut", time:now(), lost:true, text:"Le village visé n'existe plus : troupes perdues." });
    return;
  }
  target.support = target.support||[];
  target.support.push({ id:"spst"+Date.now()+Math.floor(Math.random()*100000), from:m.attackerUsername, fromVillageId:m.sourceVillageId, troops:{...m.troops}, arrivedAt: now() });
  if(target.owner!==m.attackerUsername){
    pushReport(db, target.owner, { kind:"supportIn", time:now(), from:m.attackerUsername, troops:{...m.troops} });
  }
  pushReport(db, m.attackerUsername, { kind:"supportOut", time:now(), target:target.name, coord:target.x+"|"+target.y, troops:{...m.troops} });
}

function resolveAttack(db, m){
  const target = db.villages[m.targetId];
  m.resolveDone=true; m.returnAt=m.arriveAt+m.travel;
  // C'est le village qui a réellement lancé l'attaque (et pas le village actif actuel, qui a pu
  // changer entre-temps) qui gagne le bonus d'empire lié à cette conquête.
  const attackerVillage = db.villages[m.sourceVillageId] || villageByUser(db, m.attackerUsername);
  if(!target){ pushReport(db, m.attackerUsername, {kind:"attack", time:now(), lost:true, text:"Le village ciblé n'existe plus."}); return; }

  // Composition de l'armée AVANT pertes (m.troops est muté plus bas) : nécessaire pour un rapport
  // de combat détaillé montrant "envoyées / survivantes / perdues" pour chaque type de troupe.
  const troopsSent = {...m.troops};
  const { power: attackPower, shareInf, shareCav, shareArch } = computePower(m.troops);
  const defensePower = defensePowerOf(combinedDefenseTroops(target), shareInf, shareCav, shareArch, villageWall(target));
  const luck = (Math.random()*2-1)*0.25;
  const effAttack = attackPower*(1+luck);

  let winner, attackerLossFrac, defenderLossFrac;
  if(defensePower<=0 || attackPower<=0){
    winner = attackPower>0 ? "attacker" : "defender";
    attackerLossFrac = attackPower>0 ? 0.02 : 1;
    defenderLossFrac = attackPower>0 ? 1 : 0;
  } else if(effAttack>defensePower){
    winner="attacker"; attackerLossFrac=clamp(Math.pow(defensePower/effAttack,2),0,1); defenderLossFrac=1;
  } else {
    winner="defender"; defenderLossFrac=clamp(Math.pow(effAttack/defensePower,2),0,1); attackerLossFrac=1;
  }

  const originalNobleCount = m.troops.noble||0;
  const attackerLosses={};
  for(const k in m.troops){
    if(k==="noble") continue; // le noble a sa propre règle de survie ci-dessous, pas la fraction générale
    const survivors=Math.floor(m.troops[k]*(1-attackerLossFrac));
    attackerLosses[k]=m.troops[k]-survivors;
    m.troops[k]=survivors;
  }
  // Répartit les pertes du défenseur entre ses propres troupes et les renforts alliés stationnés.
  const defenderLosses = applyDefenseLosses(target, defenderLossFrac);

  /* Survie du noble : avec l'ancienne règle (même fraction de pertes que le reste de l'armée),
     un noble envoyé seul (le cas le plus courant) mourait TOUJOURS dès qu'il y avait la moindre
     perte, même infime (Math.floor(1*0.98)=0) — impossible de conquérir quoi que ce soit.
     Nouvelle règle : chaque noble est tiré au sort indépendamment, avec une chance de survie qui
     augmente avec la domination de l'attaque (donc avec l'escorte envoyée pour le protéger). */
  let nobleSurvivedCount=0, nobleSurvivalChancePct=null;
  if(originalNobleCount>0){
    let noblesSurviving=0, survivalChance;
    if(winner==="attacker"){
      const dominance = clamp(1-attackerLossFrac, 0, 1); // proche de 1 si l'attaque écrase la défense
      survivalChance = clamp(0.15+dominance*0.8, 0.05, 0.97);
      for(let i=0;i<originalNobleCount;i++){ if(Math.random()<survivalChance) noblesSurviving++; }
    } else {
      survivalChance = 0.05; // défaite : le noble a une petite chance de s'échapper malgré tout
      for(let i=0;i<originalNobleCount;i++){ if(Math.random()<survivalChance) noblesSurviving++; }
    }
    m.troops.noble = noblesSurviving;
    attackerLosses.noble = originalNobleCount-noblesSurviving;
    nobleSurvivedCount = noblesSurviving;
    nobleSurvivalChancePct = Math.round(survivalChance*100);
  }

  // Anéantissement total (m.troops ne contient plus que les SURVIVANTS à ce stade) : s'il n'en
  // reste aucun, il n'y a personne pour "rentrer" — voir la fin de la fonction, où la mission est
  // bouclée immédiatement dans ce cas plutôt que de laisser runTick() la garder en phase de retour
  // (marqueur de carte qui rebrousse chemin, mention "(retour)") pendant tout le trajet pour rien.
  const totalAttackerSurvivors = Object.values(m.troops).reduce((s,n)=>s+(n||0), 0);

  let wallDamage=0, storageDamageFrac=0, loyaltyReduced=0, conquered=false;
  if(winner==="attacker"){
    const ramSurvivors=m.troops.ram||0;
    if(ramSurvivors>0){
      wallDamage=Math.max(1, Math.floor(ramSurvivors/4));
      if(target.owner==="barbarian") target.wallLevel=Math.max(0, (target.wallLevel||0)-wallDamage);
      else target.buildings.wall=Math.max(0, (target.buildings.wall||0)-wallDamage);
    }
    const catSurvivors=m.troops.catapult||0;
    if(catSurvivors>0){
      storageDamageFrac=Math.min(0.5, catSurvivors*0.06);
      if(target.owner==="barbarian") target.resCap=Math.max(300, Math.round((target.resCap||600)*(1-storageDamageFrac)));
      // pour un village joueur, l'entrepôt est un niveau de bâtiment : on ne le réduit pas directement (simplification MVP)
    }
    const nobleSurvivors=m.troops.noble||0;
    if(nobleSurvivors>0 && target.owner==="barbarian"){
      for(let i=0;i<nobleSurvivors;i++) loyaltyReduced += (20+Math.floor(Math.random()*16));
      target.loyalty = Math.max(0, (target.loyalty==null?100:target.loyalty) - loyaltyReduced);
      m.troops.noble = 0;
      if(target.loyalty<=0){
        target.loyalty=0;
        target.owner=m.attackerUsername;
        target.aggro={};
        conquered=true;
        if(attackerVillage) attackerVillage.conqueredCount=(attackerVillage.conqueredCount||0)+1;
        // Un village barbare n'a pas la même structure qu'un village de joueur (pas de
        // "buildings", de files de construction/entraînement ni de soutien) : sans cette
        // conversion, runTick() plantait dès le tick suivant sur ce village fraîchement conquis.
        target.buildings = target.buildings || {
          hq:1, wood:1, clay:1, iron:1, warehouse:1, farm:1, barracks:0,
          wall: Math.max(0, target.wallLevel||0), hide: Math.max(0, target.hideLevel||0), academy:0
        };
        target.buildQueue = target.buildQueue || [];
        target.trainQueue = target.trainQueue || [];
        target.support = target.support || [];
        target.conqueredCount = target.conqueredCount || 0;
        delete target.wallLevel; delete target.hideLevel; delete target.resCap; delete target.tier;
      }
    } else if(nobleSurvivors>0){
      m.troops.noble = 0; // consommé même contre un joueur (pas de conquête de joueur en MVP)
    }
  }
  // État final des troupes de l'attaquant après combat (celles qui rentreront réellement au
  // village — voir completeMission) : le noble y apparaît toujours à 0 puisqu'il est consommé par
  // la tentative de conquête même s'il a survécu au combat lui-même (voir nobleSurvivedCount).
  const attackerSurvivors = {...m.troops};

  let loot={wood:0,clay:0,iron:0};
  if(winner==="attacker" && target.owner!==m.attackerUsername){
    let carryCap=0;
    for(const k in m.troops) carryCap+=m.troops[k]*TROOPS[k].carry;
    carryCap *= serverEventMultiplier(db, "loot");
    const protectedFrac=clamp(villageHide(target)*0.05,0,0.7);
    const avail={
      wood:target.resources.wood*(1-protectedFrac),
      clay:target.resources.clay*(1-protectedFrac),
      iron:target.resources.iron*(1-protectedFrac)
    };
    const totalAvail=avail.wood+avail.clay+avail.iron;
    const totalLoot=Math.min(carryCap, totalAvail);
    if(totalAvail>0){
      loot.wood=Math.floor(totalLoot*avail.wood/totalAvail);
      loot.clay=Math.floor(totalLoot*avail.clay/totalAvail);
      loot.iron=Math.floor(totalLoot*avail.iron/totalAvail);
      target.resources.wood-=loot.wood; target.resources.clay-=loot.clay; target.resources.iron-=loot.iron;
    }
  }
  m.loot=loot;

  // Statistiques de succès (voir ACHIEVEMENTS / computeAchievements) : mises à jour une seule fois
  // ici, quel que soit le camp gagnant — jamais recalculées dans buildSnapshot, qui ne fait que LIRE
  // ces compteurs persistants. "Guerrier tous azimuts" compte les adversaires JOUEURS distincts
  // (pas les villages barbares) attaqués, gagné ou perdu ; les autres ne comptent qu'en cas de victoire.
  if(target.owner!=="barbarian") addOpponent(db, m.attackerUsername, target.owner);
  if(winner==="attacker"){
    bumpStat(db, m.attackerUsername, "attacksWon", 1);
    bumpStat(db, m.attackerUsername, "totalLoot", loot.wood+loot.clay+loot.iron);
    bumpStat(db, m.attackerUsername, "wallLevelsDestroyed", wallDamage);
  }
  const defenderLossesTotal = Object.values(defenderLosses||{}).reduce((s,n)=>s+(n||0),0);
  const attackerLossesTotal = Object.values(attackerLosses||{}).reduce((s,n)=>s+(n||0),0);
  bumpStat(db, m.attackerUsername, "unitsKilled", defenderLossesTotal); // troupes (et renforts) adverses détruites
  if(target.owner!=="barbarian") bumpStat(db, target.owner, "unitsKilled", attackerLossesTotal); // troupes attaquantes détruites en défense

  // Champs communs aux deux rapports (attaquant et défenseur), pour un compte-rendu de combat
  // bien plus détaillé : composition complète de l'armée attaquante (envoyée/survivante/perdue),
  // répartition de sa puissance par type de troupe, et l'état du village après le combat.
  const attackShare = {
    inf: Math.round(shareInf*100), cav: Math.round(shareCav*100), arch: Math.round(shareArch*100)
  };
  const attackerLossPct = Math.round(attackerLossFrac*100);
  const defenderLossPct = Math.round(defenderLossFrac*100);
  const targetWallLevelAfter = villageWall(target);
  const targetResCapAfter = target.owner==="barbarian" ? target.resCap : null;

  const report = {
    kind:"attack", time:now(), winner, target:target.name, coord:target.x+"|"+target.y,
    targetIsPlayer: target.owner!=="barbarian", targetOwner: target.owner==="barbarian"?null:target.owner,
    attackPower:Math.round(attackPower), effAttack:Math.round(effAttack), defensePower:Math.round(defensePower),
    luck, attackShare,
    troopsSent, attackerSurvivors, attackerLosses, attackerLossPct, defenderLosses, defenderLossPct, loot,
    nobleSent: originalNobleCount, nobleSurvived: nobleSurvivedCount, nobleSurvivalChancePct,
    wallDamage, targetWallLevelAfter, storageDamageFrac, targetResCapAfter,
    loyaltyReduced, conquered, targetLoyalty: target.loyalty
  };
  pushReport(db, m.attackerUsername, report);

  // rapport de défense pour la victime, si c'est un vrai joueur : mêmes détails (y compris la
  // composition de l'armée qui a attaqué et ses pertes), pour qu'elle sache exactement ce qui l'a
  // frappée et ce qu'elle a réussi à détruire — ce n'est pas du renseignement "à l'avance" (comme
  // le ferait une reconnaissance) mais un compte-rendu APRÈS coup du combat qui vient d'avoir lieu.
  if(target.owner!=="barbarian" && target.owner!==m.attackerUsername){
    pushReport(db, target.owner, {
      kind:"defense", time:now(), winner, source: m.attackerUsername,
      attackPower:Math.round(attackPower), effAttack:Math.round(effAttack), defensePower:Math.round(defensePower),
      luck, attackShare,
      troopsSent, attackerSurvivors, attackerLosses, attackerLossPct, defenderLosses, defenderLossPct, loot,
      wallDamage, targetWallLevelAfter, storageDamageFrac
    });
  }

  // Aucun survivant : pas de trajet retour (voir totalAttackerSurvivors ci-dessus). completeMission
  // n'a ici rien à restituer au village d'origine (0 troupe, et le butin est de toute façon déjà à 0
  // puisqu'il dépend de la capacité de transport des SURVIVANTS) : elle ne fait donc que marquer la
  // mission terminée, ce qui la fait disparaître de la carte dès ce tick au lieu d'attendre returnAt.
  if(totalAttackerSurvivors<=0) completeMission(db, m);
}

function resolveRaid(db, m){
  const target = db.villages[m.targetId]; // le village du joueur visé
  m.resolveDone=true; m.returnAt=m.arriveAt+m.travel;
  if(!target){ return; }
  const { power: attackPower, shareInf, shareCav, shareArch } = computePower(m.troops);
  const defensePower = defensePowerOf(combinedDefenseTroops(target), shareInf, shareCav, shareArch, target.buildings.wall);
  const luck=(Math.random()*2-1)*0.25;
  const effAttack=attackPower*(1+luck);
  let winner, attackerLossFrac, defenderLossFrac;
  if(defensePower<=0 || attackPower<=0){
    winner = attackPower>0 ? "attacker" : "defender";
    attackerLossFrac = attackPower>0 ? 0.02 : 1; defenderLossFrac = attackPower>0 ? 1 : 0;
  } else if(effAttack>defensePower){
    winner="attacker"; attackerLossFrac=clamp(Math.pow(defensePower/effAttack,2),0,1); defenderLossFrac=1;
  } else {
    winner="defender"; defenderLossFrac=clamp(Math.pow(effAttack/defensePower,2),0,1); attackerLossFrac=1;
  }
  const defenderLosses = applyDefenseLosses(target, defenderLossFrac);
  let loot={wood:0,clay:0,iron:0};
  if(winner==="attacker"){
    let carryCap=0; for(const k in m.troops) carryCap+=(m.troops[k]||0)*TROOPS[k].carry;
    const protectedFrac=clamp((target.buildings.hide||0)*0.05,0,0.7);
    const avail={ wood:target.resources.wood*(1-protectedFrac), clay:target.resources.clay*(1-protectedFrac), iron:target.resources.iron*(1-protectedFrac) };
    const totalAvail=avail.wood+avail.clay+avail.iron;
    const totalLoot=Math.min(carryCap, totalAvail);
    if(totalAvail>0){
      loot.wood=Math.floor(totalLoot*avail.wood/totalAvail); loot.clay=Math.floor(totalLoot*avail.clay/totalAvail); loot.iron=Math.floor(totalLoot*avail.iron/totalAvail);
      target.resources.wood-=loot.wood; target.resources.clay-=loot.clay; target.resources.iron-=loot.iron;
    }
  }
  pushReport(db, target.owner, {
    kind:"defense", time:now(), winner, source: m.raidSourceName||"Village barbare",
    attackPower:Math.round(attackPower), effAttack:Math.round(effAttack), defensePower:Math.round(defensePower),
    luck, attackShare:{ inf:Math.round(shareInf*100), cav:Math.round(shareCav*100), arch:Math.round(shareArch*100) },
    troopsSent:{...m.troops}, defenderLosses, defenderLossPct: Math.round(defenderLossFrac*100), loot
  });
}

/* Les troupes qui reviennent d'une mission (attaque, reconnaissance, rappel de soutien) doivent
   TOUJOURS rentrer dans le village qui les a réellement envoyées à l'origine — jamais dans le
   village actuellement actif du joueur, qui a pu changer entre-temps si le trajet est long ou si
   le joueur gère plusieurs villages (bug corrigé : les troupes revenaient auparavant dans le
   village actif au moment du retour plutôt que dans leur village de départ). Même règle déjà
   appliquée par resolveAttack pour attribuer le bonus d'empire au bon village. */
function completeMission(db, m){
  let v;
  if(m.kind==="raid") v = db.villages[m.sourceVillageId];
  else if(m.kind==="supportReturn") v = db.villages[m.targetId] || villageByUser(db, m.attackerUsername);
  else v = db.villages[m.sourceVillageId] || villageByUser(db, m.attackerUsername);
  if(v){
    for(const k in m.troops){ if(m.troops[k]>0) v.troops[k]=(v.troops[k]||0)+m.troops[k]; }
    if(m.loot && v.owner!=="barbarian"){
      const cap = villageResCap(v);
      for(const r of ["wood","clay","iron"]) v.resources[r]=clamp(v.resources[r]+(m.loot[r]||0), 0, cap);
    }
  }
  m.completed=true;
}

/* ---------------------------------------------------------------------- */
/*  Boucle de jeu périodique (autorité serveur)                            */
/* ---------------------------------------------------------------------- */

function runTick(db){
  const t = now();
  const dt = Math.max(0, t - db.lastTickAt);
  db.lastTickAt = t;
  if(dt<=0) return;

  // production + files de construction/entraînement pour chaque village joueur
  for(const id in db.villages){
    const v = db.villages[id];
    if(v.owner==="barbarian") continue;
    const cap = storageCap(v.buildings.warehouse);
    const empireMult = 1+0.02*(v.conqueredCount||0);
    const speedMult = getSpeedMultiplier(db);
    const guild = guildOf(db, v.owner);
    const guildMult = guildBonusMultiplier(guild);
    const guildProdBoostMult = guildBoostMultiplier(guild, "production");
    const eventProdMult = serverEventMultiplier(db, "production");
    for(const r of ["wood","clay","iron"]){
      // Bonus de gisement (voir rollResourceBonus, store.js) : +10% UNIQUEMENT sur la ressource
      // concernée et UNIQUEMENT dans ce village précis — jamais propagé aux autres villages du joueur.
      const villageResBonusMult = (v.resourceBonus && v.resourceBonus.res===r) ? (1+v.resourceBonus.pct) : 1;
      const perSec = prodPerHour(r, v.buildings[r])/3600*empireMult*speedMult*guildMult*guildProdBoostMult*eventProdMult*villageResBonusMult;
      // borne haute = cap normal, sauf si un admin a déjà placé le stock au-dessus (auquel cas
      // on ne le fait pas redescendre — la production s'arrête juste, comme un entrepôt plein).
      const upperBound = Math.max(cap, v.resources[r]);
      v.resources[r] = clamp(v.resources[r]+perSec*dt, 0, upperBound);
    }
    // file de construction (basée sur startAt+duration, robuste aux redémarrages)
    while(v.buildQueue.length){
      const item = v.buildQueue[0];
      if(t >= item.startAt+item.duration){
        v.buildings[item.key] = (v.buildings[item.key]||0)+1;
        v.buildQueue.shift();
      } else break;
    }
    // file d'entraînement (une unité à la fois, durée par unité)
    while(v.trainQueue.length){
      const order = v.trainQueue[0];
      if(t >= order.unitStartAt+order.unitDuration){
        v.troops[order.troop] = (v.troops[order.troop]||0)+1;
        order.count--;
        if(order.count<=0){ v.trainQueue.shift(); }
        else { order.unitStartAt = order.unitStartAt+order.unitDuration; order.unitDuration = trainTime(order.troop, v.buildings.barracks) / getSpeedMultiplier(db) / guildBoostMultiplier(guildOf(db, v.owner), "train") / serverEventMultiplier(db, "train"); }
      } else break;
    }
  }

  // missions : arrivée -> résolution ; retour -> troupes de retour
  for(const m of db.missions){
    if(!m.resolveDone && t>=m.arriveAt){
      if(m.kind==="scout") resolveScout(db, m);
      else if(m.kind==="raid") resolveRaid(db, m);
      else if(m.kind==="support") resolveSupportArrival(db, m);
      else resolveAttack(db, m);
    } else if(m.resolveDone && !m.completed && t>=m.returnAt){
      completeMission(db, m);
    }
  }
  db.missions = db.missions.filter(m=>!m.completed);

  // purge des bonus de guilde expirés (simple hygiène : évite une liste qui grossit indéfiniment)
  for(const gid in db.guilds){
    const g = db.guilds[gid];
    if(g.activeBoosts && g.activeBoosts.length) g.activeBoosts = g.activeBoosts.filter(b=>b.expiresAt>t);
  }

  // villages barbares : régénération, apaisement, croissance, ripostes
  for(const id in db.villages){
    const v = db.villages[id];
    if(v.owner!=="barbarian") continue;
    const regen=(20+v.tier*12)/3600*dt;
    for(const r of ["wood","clay","iron"]) v.resources[r]=Math.min(v.resCap, v.resources[r]+regen);
    if((v.loyalty==null?100:v.loyalty)<100) v.loyalty=Math.min(100,(v.loyalty==null?100:v.loyalty)+dt/3600);
    if(v.aggro && typeof v.aggro==="object"){
      for(const u in v.aggro){ if(v.aggro[u]>0) v.aggro[u]=Math.max(0, v.aggro[u]-dt/1800); }
    }
  }

  if(t >= db.nextWorldGrowthAt){
    db.nextWorldGrowthAt = t + 180 + Math.random()*180;
    const growable = Object.values(db.villages).filter(v=>v.owner==="barbarian");
    const growCount = Math.max(1, Math.round(growable.length*0.06));
    for(let i=0;i<growCount;i++){
      const v = growable[Math.floor(Math.random()*growable.length)];
      if(!v) continue;
      growVillage(v);
    }
    // ripostes : les villages agressés (aggro>0) peuvent lever une troupe contre l'agresseur
    for(const v of growable){
      if(!v.aggro) continue;
      for(const attackerUsername in v.aggro){
        const aggro = v.aggro[attackerUsername];
        if(aggro<=0) continue;
        const chance = clamp(aggro*0.15, 0, 0.8);
        if(Math.random()<chance){
          spawnRaid(db, v, attackerUsername);
          v.aggro[attackerUsername] = Math.max(0, aggro-3);
        }
      }
    }
  }
}

function growVillage(v){
  const roll = Math.random();
  if(roll<0.5){
    const keys=["spear","sword","archer"];
    const k=keys[Math.floor(Math.random()*keys.length)];
    const gain = 1+Math.floor(Math.random()*3)+v.tier;
    v.troops[k]=(v.troops[k]||0)+gain;
  } else if(roll<0.8){
    const cap = 3+v.tier*2;
    if((v.wallLevel||0)<cap) v.wallLevel=(v.wallLevel||0)+1;
  } else {
    v.resCap = Math.round((v.resCap||600)*1.12);
  }
}

function spawnRaid(db, source, attackerUsername){
  // La riposte cible toujours le village d'origine de l'agresseur : l'aggro n'est enregistrée que
  // par pseudo (pas par village précis), donc la capitale reste la cible la plus prévisible.
  const attackerVillage = homeVillageOf(db, attackerUsername);
  if(!attackerVillage) return;
  const dx=attackerVillage.x-source.x, dy=attackerVillage.y-source.y, dist=Math.sqrt(dx*dx+dy*dy);
  const power = 10+source.tier*8+(source.aggro[attackerUsername]||0)*4;
  const troops = {
    spear: Math.round(power*(0.35+Math.random()*0.25)),
    sword: Math.round(power*(0.25+Math.random()*0.2)),
    archer: Math.round(power*(0.1+Math.random()*0.15))
  };
  const speed=20;
  const travel=Math.max(8, Math.round(dist*speed));
  const t = now();
  db.missions.push({
    id:"r"+Date.now()+Math.floor(Math.random()*100000),
    kind:"raid", raidSourceName: source.name, sourceVillageId: source.id, targetId: attackerVillage.id,
    troops, departAt:t, arriveAt:t+travel, travel, resolveDone:false, returnAt:null, completed:false
  });
}

function doRename(db, username, name){
  const v = villageByUser(db, username);
  if(!v) return { error:"Village introuvable." };
  name = String(name||"").trim().slice(0,30);
  if(!name) return { error:"Le nom du village ne peut pas être vide." };
  v.name = name;
  return { ok:true };
}

/* ---------------------------------------------------------------------- */
/*  Succès (mêmes catégories/paliers que le jeu officiel — voir ACHIEVEMENTS) */
/* ---------------------------------------------------------------------- */

const EMPTY_STATS = ()=>({ totalLoot:0, unitsKilled:0, attacksWon:0, supportsSent:0, marketTrades:0, wallLevelsDestroyed:0, opponents:[] });

/* Incrémente un compteur de succès pour un joueur (no-op silencieux si le compte n'existe pas —
   ex. cible barbare — pour ne jamais avoir à vérifier "est-ce un vrai joueur ?" à chaque appel). */
function bumpStat(db, username, key, amount){
  if(!amount) return;
  const u = db.users[username];
  if(!u) return;
  if(!u.stats) u.stats = EMPTY_STATS();
  u.stats[key] = (u.stats[key]||0) + amount;
}

/* Enregistre un adversaire (joueur) distinct attaqué, pour le succès "Guerrier tous azimuts". */
function addOpponent(db, username, opponentUsername){
  const u = db.users[username];
  if(!u) return;
  if(!u.stats) u.stats = EMPTY_STATS();
  if(!u.stats.opponents) u.stats.opponents = [];
  if(!u.stats.opponents.includes(opponentUsername)) u.stats.opponents.push(opponentUsername);
}

/* Calcule, pour un joueur, le palier atteint (0 à 4) et les points de succès de chaque catégorie
   (voir ACHIEVEMENTS, shared/gameData.js). "points"/"conquered" viennent du score déjà calculé par
   ailleurs (computePlayerScore) ; les autres viennent des compteurs persistants (db.users[..].stats,
   mis à jour au fil des combats/soutiens/échanges — voir bumpStat/addOpponent). */
function computeAchievements(db, username){
  const u = db.users[username];
  const stats = (u && u.stats) || EMPTY_STATS();
  const score = computePlayerScore(db, username);
  const values = {
    points: score.points,
    conquered: score.conquered,
    totalLoot: stats.totalLoot||0,
    unitsKilled: stats.unitsKilled||0,
    attacksWon: stats.attacksWon||0,
    supportsSent: stats.supportsSent||0,
    marketTrades: stats.marketTrades||0,
    wallLevelsDestroyed: stats.wallLevelsDestroyed||0,
    distinctOpponents: (stats.opponents||[]).length
  };
  return ACHIEVEMENTS.map(a=>{
    const value = values[a.stat]||0;
    let tier = 0;
    for(let i=0;i<a.tiers.length;i++) if(value>=a.tiers[i]) tier=i+1;
    return {
      key:a.key, name:a.name, icon:a.icon, desc:a.desc, tiers:a.tiers,
      value, tier, nextThreshold: tier<a.tiers.length ? a.tiers[tier] : null,
      points: tier*(tier+1)/2 // 1+2+...+tier (palier Or entièrement gravi = 1+2+3+4 = 10 points)
    };
  });
}

/* ---------------------------------------------------------------------- */
/*  Guildes (alliances de joueurs)                                         */
/* ---------------------------------------------------------------------- */

// % de bonus de production par tranche de ressources données cumulativement, plafonné.
const GUILD_DONATION_PER_PERCENT = 2000;
const GUILD_MAX_BONUS_PERCENT = 25;

function guildOf(db, username){
  const u = db.users[username];
  if(!u || !u.guildId) return null;
  return db.guilds[u.guildId] || null;
}

function guildBonusMultiplier(guild){
  if(!guild) return 1;
  const pct = Math.min(GUILD_MAX_BONUS_PERCENT, Math.floor((guild.totalDonated||0)/GUILD_DONATION_PER_PERCENT));
  return 1 + pct/100;
}

/* Multiplicateur cumulé des bonus de boutique de guilde actuellement actifs, pour un type donné
   ("production" = ressources/heure, "speed" = construction des bâtiments, "train" = entraînement
   des troupes — trois familles indépendantes, à l'image des évènements serveur). Les bonus expirés
   (expiresAt dépassé) sont ignorés sans avoir besoin d'être déjà purgés du tableau (voir runTick,
   qui les purge aussi périodiquement par hygiène). */
function guildBoostMultiplier(guild, type){
  if(!guild || !guild.activeBoosts || !guild.activeBoosts.length) return 1;
  const t = now();
  let mult = 1;
  for(const b of guild.activeBoosts){
    if(b.type===type && b.expiresAt>t) mult *= b.multiplier;
  }
  return mult;
}

function publicGuildView(db, guild, username){
  const t = now();
  const activeBoosts = (guild.activeBoosts||[]).filter(b=>b.expiresAt>t).map(b=>({
    key:b.key, name:b.name, icon:b.icon, type:b.type, multiplier:b.multiplier,
    secondsLeft: Math.max(0, Math.round(b.expiresAt-t)), buyer:b.buyer
  }));
  return {
    id: guild.id, name: guild.name, tag: guild.tag, leader: guild.leader,
    members: guild.members, invites: guild.invites,
    bank: {...guild.bank}, totalDonated: guild.totalDonated||0,
    bonusPercent: Math.min(GUILD_MAX_BONUS_PERCENT, Math.floor((guild.totalDonated||0)/GUILD_DONATION_PER_PERCENT)),
    isLeader: guild.leader===username,
    donations: (guild.donations||[]).slice(0,30),
    donorTotals: {...(guild.donorTotals||{})},
    activeBoosts,
    diplomacy: publicDiplomacyView(db, guild)
  };
}

function doGuildCreate(db, username, name, tag){
  if(guildOf(db, username)) return { error:"Vous êtes déjà dans une guilde." };
  name = String(name||"").trim().slice(0,30);
  tag = String(tag||"").trim().toUpperCase().slice(0,6);
  if(!name) return { error:"Le nom de la guilde ne peut pas être vide." };
  if(!tag) return { error:"Le tag de la guilde ne peut pas être vide (2 à 6 caractères)." };
  if(Object.values(db.guilds).some(g=>g.name.toLowerCase()===name.toLowerCase())) return { error:"Ce nom de guilde est déjà pris." };
  if(Object.values(db.guilds).some(g=>g.tag===tag)) return { error:"Ce tag de guilde est déjà pris." };
  const id = String(db.nextGuildId++);
  db.guilds[id] = {
    id, name, tag, leader:username, members:[username], invites:[],
    bank:{wood:0,clay:0,iron:0}, totalDonated:0, createdAt: now(),
    donations:[], donorTotals:{}, activeBoosts:[]
  };
  db.users[username].guildId = id;
  return { ok:true };
}

function doGuildInvite(db, username, targetUsername){
  const guild = guildOf(db, username);
  if(!guild) return { error:"Vous n'êtes dans aucune guilde." };
  if(guild.leader!==username) return { error:"Seul le chef de guilde peut inviter des membres." };
  targetUsername = String(targetUsername||"").trim();
  const targetUser = db.users[targetUsername];
  if(!targetUser) return { error:"Joueur introuvable." };
  if(targetUser.guildId) return { error:"Ce joueur est déjà dans une guilde." };
  if(guild.members.includes(targetUsername)) return { error:"Ce joueur est déjà membre de la guilde." };
  if(guild.invites.includes(targetUsername)) return { error:"Ce joueur a déjà une invitation en attente." };
  guild.invites.push(targetUsername);
  pushReport(db, targetUsername, { kind:"guildInvite", time:now(), guildId:guild.id, guildName:guild.name, guildTag:guild.tag, from:username });
  return { ok:true };
}

function doGuildAccept(db, username, guildId){
  if(guildOf(db, username)) return { error:"Vous êtes déjà dans une guilde." };
  const guild = db.guilds[String(guildId)];
  if(!guild) return { error:"Guilde introuvable." };
  if(!guild.invites.includes(username)) return { error:"Aucune invitation en attente pour cette guilde." };
  guild.invites = guild.invites.filter(u=>u!==username);
  guild.members.push(username);
  db.users[username].guildId = guild.id;
  return { ok:true };
}

function doGuildDecline(db, username, guildId){
  const guild = db.guilds[String(guildId)];
  if(!guild) return { error:"Guilde introuvable." };
  if(!guild.invites.includes(username)) return { error:"Aucune invitation en attente pour cette guilde." };
  guild.invites = guild.invites.filter(u=>u!==username);
  return { ok:true };
}

function doGuildKick(db, username, targetUsername){
  const guild = guildOf(db, username);
  if(!guild) return { error:"Vous n'êtes dans aucune guilde." };
  if(guild.leader!==username) return { error:"Seul le chef de guilde peut exclure un membre." };
  targetUsername = String(targetUsername||"").trim();
  if(targetUsername===username) return { error:"Utilisez « Quitter la guilde » pour vous-même." };
  if(!guild.members.includes(targetUsername)) return { error:"Ce joueur n'est pas membre de la guilde." };
  guild.members = guild.members.filter(u=>u!==targetUsername);
  if(db.users[targetUsername]) db.users[targetUsername].guildId = null;
  return { ok:true };
}

function doGuildLeave(db, username){
  const guild = guildOf(db, username);
  if(!guild) return { error:"Vous n'êtes dans aucune guilde." };
  guild.members = guild.members.filter(u=>u!==username);
  db.users[username].guildId = null;
  if(guild.leader===username){
    if(guild.members.length){
      guild.leader = guild.members[0]; // transmission automatique au membre le plus ancien restant
    } else {
      delete db.guilds[guild.id]; // dernier membre parti : la guilde disparaît
    }
  }
  return { ok:true };
}

function doGuildDonate(db, username, wood, clay, iron){
  const guild = guildOf(db, username);
  if(!guild) return { error:"Vous n'êtes dans aucune guilde." };
  const v = villageByUser(db, username);
  if(!v) return { error:"Village introuvable." };
  const hallLvl = v.buildings.guildHall||0;
  if(hallLvl<=0) return { error:"Construisez d'abord un Hall de guilde pour pouvoir faire des dons." };
  const amt = { wood:Math.max(0,Math.floor(Number(wood)||0)), clay:Math.max(0,Math.floor(Number(clay)||0)), iron:Math.max(0,Math.floor(Number(iron)||0)) };
  const total = amt.wood+amt.clay+amt.iron;
  if(total<=0) return { error:"Indiquez au moins une ressource à donner." };
  const cap = 1000*hallLvl;
  if(total>cap) return { error:"Votre Hall de guilde (niveau "+hallLvl+") limite chaque don à "+cap+" ressources au total." };
  if(v.resources.wood<amt.wood || v.resources.clay<amt.clay || v.resources.iron<amt.iron) return { error:"Ressources insuffisantes." };
  v.resources.wood-=amt.wood; v.resources.clay-=amt.clay; v.resources.iron-=amt.iron;
  guild.bank.wood+=amt.wood; guild.bank.clay+=amt.clay; guild.bank.iron+=amt.iron;
  guild.totalDonated=(guild.totalDonated||0)+total;
  // Historique des dons (visible par tous les membres) + total cumulé par donateur, pour que la
  // contribution de chacun à la banque commune soit visible (et pas seulement le total global).
  guild.donations = guild.donations||[];
  guild.donations.unshift({ username, wood:amt.wood, clay:amt.clay, iron:amt.iron, total, time: now() });
  if(guild.donations.length>50) guild.donations.length=50;
  guild.donorTotals = guild.donorTotals||{};
  guild.donorTotals[username] = (guild.donorTotals[username]||0)+total;
  return { ok:true };
}

/* Achète un bonus temporaire dans la boutique de guilde, payé avec la BANQUE de guilde (alimentée
   par les dons cumulés — voir doGuildDonate). Le bonus profite à TOUS les membres pendant sa durée
   (production accélérée ou construction/entraînement accélérés, selon le bonus). Réservé au chef de
   guilde, comme les autres décisions qui engagent les ressources communes (inviter, exclure...). */
function doGuildBuyBoost(db, username, key){
  const guild = guildOf(db, username);
  if(!guild) return { error:"Vous n'êtes dans aucune guilde." };
  if(guild.leader!==username) return { error:"Seul le chef de guilde peut acheter un bonus dans la boutique de guilde." };
  const boost = GUILD_BOOSTS.find(b=>b.key===key);
  if(!boost) return { error:"Bonus de guilde inconnu." };
  if(guild.bank.wood<boost.cost.wood || guild.bank.clay<boost.cost.clay || guild.bank.iron<boost.cost.iron){
    return { error:"La banque de guilde n'a pas assez de ressources pour ce bonus." };
  }
  guild.bank.wood-=boost.cost.wood; guild.bank.clay-=boost.cost.clay; guild.bank.iron-=boost.cost.iron;
  guild.activeBoosts = (guild.activeBoosts||[]).filter(b=>b.expiresAt>now());
  guild.activeBoosts.push({
    key:boost.key, name:boost.name, icon:boost.icon, type:boost.type, multiplier:boost.multiplier,
    expiresAt: now()+boost.durationSec, buyer:username
  });
  return { ok:true };
}

function doGuildDisband(db, username){
  const guild = guildOf(db, username);
  if(!guild) return { error:"Vous n'êtes dans aucune guilde." };
  if(guild.leader!==username) return { error:"Seul le chef de guilde peut dissoudre la guilde." };
  for(const m of guild.members) if(db.users[m]) db.users[m].guildId = null;
  delete db.guilds[guild.id];
  db.diplomacy = (db.diplomacy||[]).filter(r=>r.guildA!==guild.id && r.guildB!==guild.id);
  return { ok:true };
}

/* ---------------------------------------------------------------------- */
/*  Diplomatie de guilde (pactes de non-agression, alliances, guerres)     */
/* ---------------------------------------------------------------------- */
/* Une seule relation à la fois entre deux guildes : neutre par défaut (aucun enregistrement), ou
   pacte/alliance en attente (proposée, pas encore acceptée par l'autre guilde) ou active, ou guerre
   (toujours active immédiatement — se déclare, ne se négocie pas). Rompre un pacte/une alliance ou
   faire la paix est une décision unilatérale du chef de guilde (comme quitter une guilde), pour
   rester simple. Choix délibéré : aucune conséquence mécanique n'est appliquée sur les combats
   (doMission n'est pas modifié) — la diplomatie reste informative, l'avertissement affiché avant
   d'attaquer un allié est géré côté client à partir de ces données. */

function findDiplomacy(db, guildIdA, guildIdB){
  db.diplomacy = db.diplomacy||[];
  return db.diplomacy.find(r=>
    (r.guildA===guildIdA && r.guildB===guildIdB) || (r.guildA===guildIdB && r.guildB===guildIdA)
  ) || null;
}

function otherGuildId(rel, guildId){ return rel.guildA===guildId ? rel.guildB : rel.guildA; }

const DIPLOMACY_TYPE_LABEL = { pact:"un pacte de non-agression", alliance:"une alliance", war:"un état de guerre" };

/* Vue des relations de SA PROPRE guilde, décorée avec le nom/tag de l'autre guilde et le sens de la
   proposition (pour distinguer "j'attends une réponse" de "on attend la mienne"). */
function publicDiplomacyView(db, guild){
  db.diplomacy = db.diplomacy||[];
  return db.diplomacy.filter(r=>r.guildA===guild.id || r.guildB===guild.id).map(r=>{
    const oid = otherGuildId(r, guild.id);
    const other = db.guilds[oid];
    return {
      id:r.id, type:r.type, status:r.status,
      direction: r.proposedBy===guild.id ? "outgoing" : "incoming",
      otherGuild: other ? { id:other.id, name:other.name, tag:other.tag } : { id:oid, name:"Guilde dissoute", tag:"?" }
    };
  });
}

function doDiplomacyPropose(db, username, targetGuildId, type){
  const guild = guildOf(db, username);
  if(!guild) return { error:"Vous n'êtes dans aucune guilde." };
  if(guild.leader!==username) return { error:"Seul le chef de guilde peut proposer une relation diplomatique." };
  if(type!=="pact" && type!=="alliance") return { error:"Type de relation invalide." };
  targetGuildId = String(targetGuildId||"");
  const target = db.guilds[targetGuildId];
  if(!target) return { error:"Guilde introuvable." };
  if(target.id===guild.id) return { error:"Impossible de proposer une relation à votre propre guilde." };
  const existing = findDiplomacy(db, guild.id, target.id);
  if(existing) return { error:"Une relation ("+DIPLOMACY_TYPE_LABEL[existing.type]+(existing.status==="pending"?", en attente de réponse":"")+") existe déjà avec cette guilde : rompez-la d'abord pour en proposer une autre." };
  db.diplomacy = db.diplomacy||[];
  const rel = { id:"dip"+Date.now()+Math.floor(Math.random()*100000), guildA:guild.id, guildB:target.id, type, status:"pending", proposedBy:guild.id, createdAt: now() };
  db.diplomacy.push(rel);
  for(const m of target.members){
    pushReport(db, m, { kind:"diplomacyProposal", time:now(), fromGuildId:guild.id, fromGuildName:guild.name, fromGuildTag:guild.tag, relType:type });
  }
  return { ok:true };
}

function doDiplomacyRespond(db, username, relationId, accept){
  const guild = guildOf(db, username);
  if(!guild) return { error:"Vous n'êtes dans aucune guilde." };
  if(guild.leader!==username) return { error:"Seul le chef de guilde peut répondre à une proposition diplomatique." };
  db.diplomacy = db.diplomacy||[];
  const rel = db.diplomacy.find(r=>r.id===String(relationId));
  if(!rel) return { error:"Proposition introuvable." };
  if(rel.status!=="pending") return { error:"Cette proposition n'est plus en attente." };
  if(rel.proposedBy===guild.id) return { error:"Vous ne pouvez pas répondre à votre propre proposition." };
  if(rel.guildA!==guild.id && rel.guildB!==guild.id) return { error:"Cette proposition ne concerne pas votre guilde." };
  const otherId = otherGuildId(rel, guild.id);
  const other = db.guilds[otherId];
  if(accept){
    rel.status = "active";
    if(other) for(const m of other.members) pushReport(db, m, { kind:"diplomacyAccepted", time:now(), fromGuildId:guild.id, fromGuildName:guild.name, fromGuildTag:guild.tag, relType:rel.type });
  } else {
    db.diplomacy = db.diplomacy.filter(r=>r.id!==rel.id);
    if(other) for(const m of other.members) pushReport(db, m, { kind:"diplomacyDeclined", time:now(), fromGuildId:guild.id, fromGuildName:guild.name, fromGuildTag:guild.tag, relType:rel.type });
  }
  return { ok:true };
}

function doDiplomacyCancel(db, username, relationId){
  const guild = guildOf(db, username);
  if(!guild) return { error:"Vous n'êtes dans aucune guilde." };
  if(guild.leader!==username) return { error:"Seul le chef de guilde peut modifier les relations diplomatiques." };
  db.diplomacy = db.diplomacy||[];
  const rel = db.diplomacy.find(r=>r.id===String(relationId));
  if(!rel) return { error:"Relation introuvable." };
  if(rel.guildA!==guild.id && rel.guildB!==guild.id) return { error:"Cette relation ne concerne pas votre guilde." };
  const otherId = otherGuildId(rel, guild.id);
  const other = db.guilds[otherId];
  db.diplomacy = db.diplomacy.filter(r=>r.id!==rel.id);
  if(other) for(const m of other.members) pushReport(db, m, { kind:"diplomacyEnded", time:now(), fromGuildId:guild.id, fromGuildName:guild.name, fromGuildTag:guild.tag, relType:rel.type, wasPending: rel.status==="pending" });
  return { ok:true };
}

function doDiplomacyDeclareWar(db, username, targetGuildId){
  const guild = guildOf(db, username);
  if(!guild) return { error:"Vous n'êtes dans aucune guilde." };
  if(guild.leader!==username) return { error:"Seul le chef de guilde peut déclarer la guerre." };
  targetGuildId = String(targetGuildId||"");
  const target = db.guilds[targetGuildId];
  if(!target) return { error:"Guilde introuvable." };
  if(target.id===guild.id) return { error:"Impossible de déclarer la guerre à votre propre guilde." };
  db.diplomacy = db.diplomacy||[];
  const existing = findDiplomacy(db, guild.id, target.id);
  if(existing && existing.type==="war" && existing.status==="active") return { error:"Vous êtes déjà en guerre contre cette guilde." };
  if(existing) db.diplomacy = db.diplomacy.filter(r=>r.id!==existing.id);
  const rel = { id:"dip"+Date.now()+Math.floor(Math.random()*100000), guildA:guild.id, guildB:target.id, type:"war", status:"active", proposedBy:guild.id, createdAt: now() };
  db.diplomacy.push(rel);
  for(const m of target.members){
    pushReport(db, m, { kind:"diplomacyWar", time:now(), fromGuildId:guild.id, fromGuildName:guild.name, fromGuildTag:guild.tag });
  }
  return { ok:true };
}

/* Annuaire léger de toutes les guildes (hors la sienne), pour permettre à un chef de guilde de
   trouver une guilde par nom/tag et lui proposer une relation — aucune route ne l'exposait jusqu'ici. */
function listGuildsPublic(db, username){
  const guild = guildOf(db, username);
  return Object.values(db.guilds)
    .filter(g=>!guild || g.id!==guild.id)
    .map(g=>({ id:g.id, name:g.name, tag:g.tag, memberCount:g.members.length }))
    .sort((a,b)=>a.name.localeCompare(b.name));
}

/* ---------------------------------------------------------------------- */
/*  Chat (deux salons : mondial pour tous, et guilde pour ses membres)     */
/* ---------------------------------------------------------------------- */

function doChatSend(db, username, text, channel){
  text = String(text||"").trim();
  if(!text) return { error:"Message vide." };
  if(text.length>300) text = text.slice(0,300);
  channel = (channel==="guild") ? "guild" : "global";
  let guildId = null;
  if(channel==="guild"){
    const guild = guildOf(db, username);
    if(!guild) return { error:"Vous n'êtes dans aucune guilde." };
    guildId = guild.id;
  }
  const u = db.users[username];
  const t = Date.now();
  if(u && u.lastChatAt && (t-u.lastChatAt) < 1200) return { error:"Vous envoyez des messages trop vite, patientez un instant." };
  if(u) u.lastChatAt = t;
  db.chat = db.chat||[];
  db.chat.push({ id:"c"+t+Math.floor(Math.random()*100000), username, text, time: now(), channel, guildId, kind:"chat" });
  if(db.chat.length>300) db.chat.splice(0, db.chat.length-300);
  return { ok:true };
}

/* ---------------------------------------------------------------------- */
/*  Administration (réservé aux comptes marqués isAdmin)                   */
/* ---------------------------------------------------------------------- */

function isAdminUser(db, username){
  return !!(db.users[username] && db.users[username].isAdmin);
}

function adminListPlayers(db){
  return Object.keys(db.users).map(uname=>{
    const u = db.users[uname];
    const v = db.villages[u.villageId];
    const owned = myVillages(db, uname);
    return {
      username: uname,
      isAdmin: !!u.isAdmin,
      createdAt: u.createdAt||null,
      villageId: v ? v.id : null,
      villageName: v ? v.name : null,
      coord: v ? (v.x+"|"+v.y) : null,
      resources: v ? { ...v.resources } : null,
      buildings: v ? { ...v.buildings } : null,
      troops: v ? { ...v.troops } : null,
      buildQueueLen: v ? v.buildQueue.length : 0,
      trainQueueLen: v ? v.trainQueue.length : 0,
      villageCount: owned.length
    };
  }).sort((a,b)=>a.username.localeCompare(b.username));
}

function adminSetAdmin(db, targetUsername, flag){
  const u = db.users[targetUsername];
  if(!u) return { error:"Joueur introuvable." };
  u.isAdmin = !!flag;
  return { ok:true };
}

/* Supprime un joueur DÉFINITIVEMENT : compte, adhésion/direction de guilde, offres au marché,
   missions en cours qu'il a lui-même lancées, soutiens envoyés ailleurs et rapports. Ses villages
   ne sont jamais supprimés (id/emplacement conservés, pour ne jamais casser une mission déjà en
   route qui les cible ou un soutien d'un autre joueur qui y est stationné) : ils redeviennent des
   villages barbares, comme un village abandonné dans le vrai jeu. Le chat, les annonces et la
   diplomatie de guilde ne sont pas réécrits : c'est un historique, comme pour un départ de guilde
   classique (voir doGuildLeave/doGuildDisband). */
function adminDeletePlayer(db, targetUsername, actingUsername){
  const u = db.users[targetUsername];
  if(!u) return { error: "Joueur introuvable." };
  if(targetUsername===actingUsername) return { error: "Vous ne pouvez pas supprimer votre propre compte." };

  // 1) Quitte sa guilde comme un départ volontaire : transmission de la direction au membre le
  //    plus ancien restant, ou dissolution si c'était le dernier membre (voir doGuildLeave).
  const guild = guildOf(db, targetUsername);
  if(guild){
    guild.members = guild.members.filter(m=>m!==targetUsername);
    if(guild.leader===targetUsername){
      if(guild.members.length) guild.leader = guild.members[0];
      else delete db.guilds[guild.id];
    }
  }

  // 2) Retire ses offres du marché (aucun remboursement à faire : son village va de toute façon
  //    redevenir barbare juste après).
  db.market = (db.market||[]).filter(o=>o.seller!==targetUsername);

  // 3) Annule ses missions en cours (attaques/reco/soutiens qu'IL a lui-même envoyées) : leur
  //    village d'origine va devenir barbare, les laisser se résoudre plus tard ne ferait que
  //    gaspiller troupes et rapports dans le vide (villageByUser renverrait null pour ce compte
  //    supprimé, voir completeMission).
  db.missions = (db.missions||[]).filter(m=>m.attackerUsername!==targetUsername);

  // 4) Chacun de ses villages (village d'origine + toute conquête) : rend d'abord instantanément
  //    à leur village d'origine les renforts que D'AUTRES joueurs y avaient stationnés (le village
  //    hôte va disparaître en tant que village de joueur), puis reconvertit le village en village
  //    barbare — même id/emplacement, jamais supprimé (voir commentaire de fonction ci-dessus).
  const owned = myVillages(db, targetUsername);
  for(const v of owned){
    for(const s of (v.support||[])){
      const homeV = db.villages[s.fromVillageId];
      if(homeV) for(const k in s.troops) homeV.troops[k] = (homeV.troops[k]||0)+(s.troops[k]||0);
    }
    const tier = clamp(Math.round((v.buildings?v.buildings.hq||1:1)/2), 0, 4);
    v.tier = tier;
    v.troops = { spear:v.troops.spear||0, sword:v.troops.sword||0, archer:v.troops.archer||0,
      scout:0, light:0, ram:0, catapult:0, noble:0 };
    v.resCap = Math.round(600+tier*500);
    v.wallLevel = v.buildings ? (v.buildings.wall||0) : 0;
    v.hideLevel = v.buildings ? (v.buildings.hide||0) : 0;
    for(const r of ["wood","clay","iron"]) v.resources[r] = clamp(v.resources[r]||0, 0, v.resCap);
    v.loyalty = 100;
    v.aggro = {};
    v.owner = "barbarian"; // en dernier : myVillages()/les lignes ci-dessus lisent encore l'ancien propriétaire
    delete v.buildings; delete v.buildQueue; delete v.trainQueue; delete v.support; delete v.conqueredCount; delete v.createdAt;
  }

  // 5) Retire les soutiens qu'il avait lui-même envoyés dans des villages appartenant à D'AUTRES
  //    joueurs (plus personne pour les rappeler chez lui : ils sont donc simplement perdus).
  for(const id in db.villages){
    const dv = db.villages[id];
    if(dv.support && dv.support.length) dv.support = dv.support.filter(s=>s.from!==targetUsername);
  }

  // 6) Rapports puis compte lui-même.
  delete db.reports[targetUsername];
  delete db.users[targetUsername];

  return { ok:true };
}

function adminUpdateVillage(db, targetUsername, patch){
  const v = homeVillageOf(db, targetUsername);
  if(!v) return { error:"Village introuvable pour "+targetUsername+"." };
  if(patch.resources && typeof patch.resources==="object"){
    for(const r of ["wood","clay","iron"]){
      if(patch.resources[r]==null) continue;
      const n = Number(patch.resources[r]);
      if(!Number.isFinite(n) || n<0) return { error:"Valeur de ressource invalide." };
      v.resources[r] = clamp(n, 0, 1e12);
    }
  }
  if(patch.buildings && typeof patch.buildings==="object"){
    for(const k in patch.buildings){
      const b = BUILDINGS[k];
      if(!b) continue;
      const n = Math.round(Number(patch.buildings[k]));
      if(!Number.isFinite(n) || n<0) return { error:"Niveau de bâtiment invalide." };
      v.buildings[k] = clamp(n, 0, b.max);
    }
  }
  if(patch.troops && typeof patch.troops==="object"){
    for(const k in patch.troops){
      if(!TROOPS[k]) continue;
      const n = Math.round(Number(patch.troops[k]));
      if(!Number.isFinite(n) || n<0) return { error:"Nombre de troupes invalide." };
      v.troops[k] = n;
    }
  }
  return { ok:true };
}

function adminGiveResources(db, targetUsername, wood, clay, iron){
  const v = homeVillageOf(db, targetUsername);
  if(!v) return { error:"Village introuvable pour "+targetUsername+"." };
  const add = { wood:Number(wood)||0, clay:Number(clay)||0, iron:Number(iron)||0 };
  for(const r of ["wood","clay","iron"]) v.resources[r] = clamp(v.resources[r]+add[r], 0, 1e12);
  return { ok:true };
}

function adminFinishBuildQueue(db, targetUsername){
  const v = homeVillageOf(db, targetUsername);
  if(!v) return { error:"Village introuvable." };
  if(!v.buildQueue.length) return { error:"File de construction déjà vide." };
  for(const item of v.buildQueue){
    const b = BUILDINGS[item.key];
    v.buildings[item.key] = Math.min(b?b.max:99, (v.buildings[item.key]||0)+1);
  }
  v.buildQueue = [];
  return { ok:true };
}

function adminFinishTrainQueue(db, targetUsername){
  const v = homeVillageOf(db, targetUsername);
  if(!v) return { error:"Village introuvable." };
  if(!v.trainQueue.length) return { error:"File d'entraînement déjà vide." };
  for(const order of v.trainQueue) v.troops[order.troop] = (v.troops[order.troop]||0)+order.count;
  v.trainQueue = [];
  return { ok:true };
}

/* ---------------------------------------------------------------------- */
/*  Administration : TOUS les villages (pas seulement le village d'origine  */
/*  de chaque joueur comme adminUpdateVillage/adminGiveResources ci-dessus) */
/* ---------------------------------------------------------------------- */

/* Liste complète des villages du monde (joueurs ET barbares), pour le panneau d'administration
   "Villages" : contrairement à adminListPlayers (un seul village — l'origine — par joueur), inclut
   CHAQUE village individuellement, y compris les conquêtes d'un joueur qui possède plusieurs
   villages. Les villages barbares n'ont pas de "buildings" (ils utilisent tier/resCap/wallLevel) :
   ce champ est simplement absent (null) pour eux plutôt que synthétisé, pour rester honnête sur ce
   qui existe réellement en base. */
function adminListAllVillages(db){
  return Object.keys(db.villages).map(id=>{
    const v = db.villages[id];
    const isPlayer = v.owner!=="barbarian";
    return {
      id: v.id, name: v.name, x: v.x, y: v.y, owner: v.owner, isPlayer,
      hq: isPlayer && v.buildings ? (v.buildings.hq||0) : null,
      wallLevel: villageWall(v),
      resources: { ...v.resources },
      buildings: isPlayer && v.buildings ? { ...v.buildings } : null,
      troops: { ...v.troops },
      buildQueueLen: isPlayer ? (v.buildQueue||[]).length : 0,
      trainQueueLen: isPlayer ? (v.trainQueue||[]).length : 0
    };
  }).sort((a,b)=> (a.owner==="barbarian")-(b.owner==="barbarian") || a.name.localeCompare(b.name));
}

/* Villages concernés par une action groupée, selon la portée choisie côté panneau Admin :
   "all" = tout le monde, "players" = uniquement les villages de joueurs (origine + conquêtes),
   "barbarians" = uniquement les villages barbares. */
function villagesInScope(db, scope){
  const all = Object.values(db.villages);
  if(scope==="players") return all.filter(v=>v.owner!=="barbarian");
  if(scope==="barbarians") return all.filter(v=>v.owner==="barbarian");
  return all;
}

/* Édite UN village précis, quel qu'il soit (village d'origine OU conquête d'un joueur, OU même un
   village barbare) — contrairement à adminUpdateVillage qui ne cible que le village d'origine d'un
   joueur. Le patch de bâtiments est silencieusement ignoré pour un village barbare (il n'a pas de
   "buildings"), plutôt que de renvoyer une erreur : un admin qui édite un lot mixte de villages ne
   doit pas être bloqué par les barbares du lot. */
function adminUpdateVillageById(db, villageId, patch){
  const v = db.villages[String(villageId)];
  if(!v) return { error:"Village introuvable." };
  if(patch.resources && typeof patch.resources==="object"){
    for(const r of ["wood","clay","iron"]){
      if(patch.resources[r]==null) continue;
      const n = Number(patch.resources[r]);
      if(!Number.isFinite(n) || n<0) return { error:"Valeur de ressource invalide." };
      v.resources[r] = clamp(n, 0, 1e12);
    }
  }
  if(patch.buildings && typeof patch.buildings==="object" && v.buildings){
    for(const k in patch.buildings){
      const b = BUILDINGS[k];
      if(!b) continue;
      const n = Math.round(Number(patch.buildings[k]));
      if(!Number.isFinite(n) || n<0) return { error:"Niveau de bâtiment invalide." };
      v.buildings[k] = clamp(n, 0, b.max);
    }
  }
  if(patch.troops && typeof patch.troops==="object"){
    for(const k in patch.troops){
      if(!TROOPS[k]) continue;
      const n = Math.round(Number(patch.troops[k]));
      if(!Number.isFinite(n) || n<0) return { error:"Nombre de troupes invalide." };
      v.troops[k] = n;
    }
  }
  return { ok:true };
}

function adminGiveResourcesToVillageById(db, villageId, wood, clay, iron){
  const v = db.villages[String(villageId)];
  if(!v) return { error:"Village introuvable." };
  const add = { wood:Number(wood)||0, clay:Number(clay)||0, iron:Number(iron)||0 };
  // Comme adminGiveResources (village d'origine) : un ajout admin n'est pas plafonné par l'entrepôt,
  // volontairement — c'est un outil de test/admin, pas une action de jeu normale.
  for(const r of ["wood","clay","iron"]) v.resources[r] = clamp(v.resources[r]+add[r], 0, 1e12);
  return { ok:true };
}

function adminFinishBuildQueueForVillage(db, villageId){
  const v = db.villages[String(villageId)];
  if(!v) return { error:"Village introuvable." };
  if(!v.buildQueue || !v.buildQueue.length) return { error:"File de construction déjà vide." };
  for(const item of v.buildQueue){
    const b = BUILDINGS[item.key];
    v.buildings[item.key] = Math.min(b?b.max:99, (v.buildings[item.key]||0)+1);
  }
  v.buildQueue = [];
  return { ok:true };
}

function adminFinishTrainQueueForVillage(db, villageId){
  const v = db.villages[String(villageId)];
  if(!v) return { error:"Village introuvable." };
  if(!v.trainQueue || !v.trainQueue.length) return { error:"File d'entraînement déjà vide." };
  for(const order of v.trainQueue) v.troops[order.troop] = (v.troops[order.troop]||0)+order.count;
  v.trainQueue = [];
  return { ok:true };
}

/* Version "groupée" d'adminUpdateVillageById : applique le même patch (ressources DÉFINIES à une
   valeur exacte, bâtiments, troupes) à TOUS les villages de la portée choisie en une seule fois.
   Un champ absent du patch n'est simplement pas touché (voir la boucle "for...in" ci-dessous) —
   c'est ce qui permet au panneau Admin de ne remplir que les champs qu'il veut réellement changer,
   sans écraser le reste à zéro sur des centaines de villages différents. */
function adminBulkUpdateVillages(db, scope, patch){
  const targets = villagesInScope(db, scope);
  let affected = 0;
  for(const v of targets){
    const r = adminUpdateVillageById(db, v.id, patch);
    if(r.ok) affected++;
  }
  return { ok:true, affected, total: targets.length };
}

function adminBulkGiveResourcesToVillages(db, scope, wood, clay, iron){
  const targets = villagesInScope(db, scope);
  for(const v of targets) adminGiveResourcesToVillageById(db, v.id, wood, clay, iron);
  return { ok:true, affected: targets.length };
}

function adminBulkFinishQueues(db, scope, which){
  const targets = villagesInScope(db, scope).filter(v=>v.owner!=="barbarian");
  let affected = 0;
  for(const v of targets){
    const r = which==="train" ? adminFinishTrainQueueForVillage(db, v.id) : adminFinishBuildQueueForVillage(db, v.id);
    if(r.ok) affected++;
  }
  return { ok:true, affected, total: targets.length };
}

function adminSetSpeed(db, multiplier){
  const n = Number(multiplier);
  if(!Number.isFinite(n) || n<=0 || n>1000) return { error:"Multiplicateur invalide (doit être entre 0.01 et 1000)." };
  const old = getSpeedMultiplier(db);
  db.settings = db.settings||{};
  db.settings.speedMultiplier = n;
  // Rétroactif : les files déjà en cours sont aussi recalées sur le nouveau multiplicateur
  // (avant ce correctif, changer la vitesse ne touchait que les NOUVELLES files — un joueur
  // qui mettait 1000x en pensant accélérer ce qui tournait déjà ne voyait donc rien changer).
  if(n!==old){
    const t = now();
    const ratio = old/n; // n>old (plus rapide) => ratio<1 => durée restante réduite
    for(const id in db.villages){
      const v = db.villages[id];
      if(v.owner==="barbarian") continue;
      for(const item of (v.buildQueue||[])){
        const elapsed = t-item.startAt;
        const remaining = Math.max(0, item.duration-elapsed)*ratio;
        item.duration = elapsed+remaining;
      }
      for(const order of (v.trainQueue||[])){
        const elapsed = t-order.unitStartAt;
        const remaining = Math.max(0, order.unitDuration-elapsed)*ratio;
        order.unitDuration = elapsed+remaining;
      }
    }
  }
  return { ok:true };
}

function adminListServerEvents(db){
  return publicServerEvents(db);
}

/* Lance (ou remplace) un évènement de serveur visible et appliqué à TOUS les joueurs. Les paramètres
   attendus dans "opts" dépendent du type (voir SERVER_EVENTS dans shared/gameData.js) :
   - kind "instant" (ex. resourceGift) : opts.amount — quantité de bois/argile/fer offerte à chaque
     village actif (plafonnée à la capacité de son entrepôt, comme la production normale).
   - kind "duration" (les boosts de vitesse/production/butin/points) : opts.multiplier (>1 et <=20)
     et opts.minutes (durée, jusqu'à 7 jours). */
function adminStartServerEvent(db, key, opts){
  const def = SERVER_EVENTS.find(e=>e.key===String(key));
  if(!def) return { error:"Type d'évènement inconnu." };
  opts = opts||{};

  if(def.kind==="instant"){
    const amount = Math.floor(Number(opts.amount));
    if(!Number.isFinite(amount) || amount<=0 || amount>1000000) return { error:"Montant invalide (doit être entre 1 et 1 000 000)." };
    let affected=0;
    for(const id in db.villages){
      const v = db.villages[id];
      if(!v.owner || v.owner==="barbarian") continue;
      const cap = storageCap(v.buildings.warehouse||0);
      for(const r of ["wood","clay","iron"]){
        const upperBound = Math.max(cap, v.resources[r]||0);
        v.resources[r] = clamp((v.resources[r]||0)+amount, 0, upperBound);
      }
      affected++;
    }
    adminAnnounce(db, "Système", def.icon+" Évènement : "+def.name+" — chaque village actif reçoit "+amount+" de bois, d'argile et de fer !");
    return { ok:true, affected };
  }

  const minutes = Math.floor(Number(opts.minutes));
  const multiplier = Number(opts.multiplier);
  if(!Number.isFinite(minutes) || minutes<=0 || minutes>10080) return { error:"Durée invalide (doit être entre 1 et 10 080 minutes, soit 7 jours)." };
  if(!Number.isFinite(multiplier) || multiplier<=1 || multiplier>20) return { error:"Multiplicateur invalide (doit être strictement supérieur à 1, et au plus 20)." };
  pruneServerEvents(db);
  // Un seul évènement actif à la fois par catégorie ("affects") : en lancer un nouveau remplace
  // silencieusement l'ancien plutôt que de cumuler deux multiplicateurs qu'un admin pourrait oublier.
  db.serverEvents = db.serverEvents.filter(e=>e.affects!==def.affects);
  const event = {
    id:"ev"+Date.now()+Math.floor(Math.random()*100000),
    key:def.key, name:def.name, icon:def.icon, affects:def.affects,
    multiplier, startAt: now(), endAt: now()+minutes*60
  };
  db.serverEvents.push(event);
  adminAnnounce(db, "Système", def.icon+" Évènement : "+def.name+" ×"+multiplier+" pendant "+minutes+" min !");
  return { ok:true, event };
}

function adminStopServerEvent(db, id){
  pruneServerEvents(db);
  const before = db.serverEvents.length;
  db.serverEvents = db.serverEvents.filter(e=>e.id!==String(id));
  if(db.serverEvents.length===before) return { error:"Évènement introuvable ou déjà terminé." };
  return { ok:true };
}

function adminAnnounce(db, authorUsername, text){
  text = String(text||"").trim();
  if(!text) return { error:"Le message d'annonce ne peut pas être vide." };
  if(text.length>500) text = text.slice(0,500);
  db.announcements = db.announcements||[];
  const entry = { id:"a"+Date.now()+Math.floor(Math.random()*100000), author:authorUsername, text, time: now() };
  db.announcements.unshift(entry);
  if(db.announcements.length>50) db.announcements.length=50;
  for(const uname in db.users){
    pushReport(db, uname, { kind:"announcement", time: entry.time, author: authorUsername, text });
  }
  db.chat = db.chat||[];
  db.chat.push({ id:"ann"+entry.id, username:authorUsername, text, time: entry.time, channel:"global", guildId:null, kind:"announce" });
  if(db.chat.length>300) db.chat.splice(0, db.chat.length-300);
  return { ok:true };
}

function adminListMissions(db){
  const KIND_LABEL = { attack:"⚔️ Attaque", scout:"🔭 Reconnaissance", raid:"⚠️ Raid barbare", support:"🤝 Soutien", supportReturn:"🤝 Retour de soutien" };
  return db.missions.map(m=>{
    const target = db.villages[m.targetId];
    return {
      id: m.id, kind: m.kind, kindLabel: KIND_LABEL[m.kind]||m.kind,
      attacker: m.attackerUsername||null,
      targetName: target?target.name:null, targetCoord: target?(target.x+"|"+target.y):null,
      resolveDone: !!m.resolveDone, arriveAt: m.arriveAt, returnAt: m.returnAt
    };
  }).sort((a,b)=>(a.resolveDone?a.returnAt:a.arriveAt)-(b.resolveDone?b.returnAt:b.arriveAt));
}

/* Force la résolution/complétion immédiate d'une mission en cours (utile pour débloquer un joueur
   ou tester rapidement) : réutilise directement les fonctions de résolution existantes plutôt que
   de dupliquer la logique de combat/arrivée. */
function adminFinishMission(db, missionId){
  const m = db.missions.find(x=>x.id===missionId);
  if(!m) return { error:"Mission introuvable (déjà résolue ?)." };
  if(!m.resolveDone){
    if(m.kind==="scout") resolveScout(db, m);
    else if(m.kind==="raid") resolveRaid(db, m);
    else if(m.kind==="support") resolveSupportArrival(db, m);
    else resolveAttack(db, m);
  }
  if(!m.completed) completeMission(db, m);
  db.missions = db.missions.filter(x=>!x.completed);
  return { ok:true };
}

function adminGiveResourcesToAll(db, wood, clay, iron){
  const add = { wood:Number(wood)||0, clay:Number(clay)||0, iron:Number(iron)||0 };
  let count=0;
  for(const uname in db.users){
    const v = homeVillageOf(db, uname);
    if(!v) continue;
    for(const r of ["wood","clay","iron"]) v.resources[r] = clamp(v.resources[r]+add[r], 0, 1e12);
    count++;
  }
  return { ok:true, count };
}

/* ---------------------------------------------------------------------- */
/*  Instantané d'état envoyé au client                                     */
/* ---------------------------------------------------------------------- */

function publicVillageView(v, db){
  const ownerUser = v.owner!=="barbarian" ? db.users[v.owner] : null;
  return {
    id: v.id, x: v.x, y: v.y, name: v.name,
    owner: v.owner, isPlayer: v.owner!=="barbarian",
    tier: v.tier, wallLevel: villageWall(v),
    guildId: ownerUser ? (ownerUser.guildId||null) : null,
    // Visible sur la carte pour tout le monde (comme le niveau de muraille) : un village barbare
    // à gisement riche est une cible de conquête intéressante à repérer avant même de l'attaquer.
    resourceBonus: v.resourceBonus || null
  };
}

/* Descriptif public d'un joueur (guilde, points, nombre de villages...), consulté depuis la liste
   des membres d'une guilde ou depuis le Classement. Ne renvoie JAMAIS les troupes/ressources d'un
   village qui n'est pas le sien : ce renseignement reste soumis à reconnaissance, comme partout
   ailleurs dans le jeu (voir README, section "Renseignement masqué"). Les points/HdV/conquêtes
   reprennent exactement la même formule que le Classement (buildSnapshot), pour ne jamais afficher
   un total différent d'un écran à l'autre. */
function publicPlayerView(db, targetUsername){
  const u = db.users[targetUsername];
  if(!u) return null;
  const home = db.villages[u.villageId] || null;
  const guild = guildOf(db, targetUsername);
  const hq = home && home.buildings ? (home.buildings.hq||0) : 0;
  const score = computePlayerScore(db, targetUsername);
  const villages = myVillages(db, targetUsername)
    .map(v=>({ id:v.id, name:v.name, x:v.x, y:v.y, isHome: home ? v.id===home.id : false }))
    .sort((a,b)=> b.isHome-a.isHome || a.name.localeCompare(b.name));
  return {
    username: targetUsername,
    isAdmin: isAdminUser(db, targetUsername),
    guild: guild ? { id:guild.id, name:guild.name, tag:guild.tag, isLeader: guild.leader===targetUsername } : null,
    points: score.points,
    buildingLevels: score.buildingLevels,
    conquered: score.conquered,
    hq,
    villageCount: villages.length,
    homeVillageId: home ? home.id : null,
    homeCoord: home ? (home.x+"|"+home.y) : null,
    villages
  };
}

function buildSnapshot(db, username){
  const v = villageByUser(db, username);
  if(!v) return null;
  const myMissions = db.missions.filter(m=>m.attackerUsername===username || (m.kind==="raid" && db.villages[m.targetId] && db.villages[m.targetId].owner===username));

  // Missions "monde" : attaques et reconnaissances actuellement en approche (trajet aller
  // uniquement, pas le retour) lancées par D'AUTRES joueurs — sert uniquement à afficher un
  // marqueur générique en mouvement sur la carte (position + type), pour qu'on voie qu'"il se
  // passe quelque chose" entre deux villages, comme sur la carte du monde officielle. On ne
  // révèle ni l'identité de l'attaquant ni la composition des troupes (ça reste soumis à
  // reconnaissance comme partout ailleurs) : seules les coordonnées des villages source/cible,
  // déjà publiques via la liste "villages", permettent éventuellement de deviner qui est qui.
  const worldMissions = db.missions
    .filter(m => (m.kind==="attack" || m.kind==="scout") && !m.resolveDone && m.attackerUsername!==username)
    .map(m => ({ id:m.id, kind:m.kind, sourceVillageId:m.sourceVillageId, targetId:m.targetId, departAt:m.departAt, arriveAt:m.arriveAt, travel:m.travel }));
  const villages = Object.values(db.villages).map(v=>publicVillageView(v, db));
  const achievements = computeAchievements(db, username);
  const allScores = computeAllPlayerScores(db);
  const leaderboard = Object.keys(db.users).map(uname=>{
    const s = allScores[uname];
    if(!s || !s.villageCount) return null; // joueur sans village (ne devrait pas arriver)
    const guild = guildOf(db, uname);
    return { username: uname, villageCount: s.villageCount, buildingLevels: s.buildingLevels, conquered: s.conquered, points: s.points,
      guild: guild ? { tag: guild.tag, name: guild.name } : null };
  }).filter(Boolean).sort((a,b)=>b.points-a.points).slice(0,20);

  // Renforts envoyés par ce joueur, où qu'ils soient stationnés (pour l'écran "mes soutiens" avec rappel).
  const mySupport = [];
  for(const vid in db.villages){
    const hv = db.villages[vid];
    if(!hv.support) continue;
    for(const s of hv.support){
      if(s.from!==username) continue;
      mySupport.push({ id:s.id, troops:{...s.troops}, arrivedAt:s.arrivedAt, atVillageId:hv.id, atVillageName:hv.name, atCoord:hv.x+"|"+hv.y, atOwner:hv.owner });
    }
  }

  const guild = guildOf(db, username);
  const guildInvites = [];
  for(const gid in db.guilds){
    const g = db.guilds[gid];
    if(g.invites.includes(username)) guildInvites.push({ id:g.id, name:g.name, tag:g.tag, leader:g.leader });
  }

  // Liste des villages possédés par ce joueur (origine + conquêtes), pour le sélecteur de village
  // actif côté client. Le village d'origine (villageId) est toujours listé en premier.
  const homeId = db.users[username].villageId;
  const myVillagesList = myVillages(db, username).map(mv=>({
    id: mv.id, name: mv.name, x: mv.x, y: mv.y,
    hq: (mv.buildings && mv.buildings.hq) || 0,
    isActive: mv.id===v.id, isHome: mv.id===homeId
  })).sort((a,b)=>(b.isHome-a.isHome) || a.name.localeCompare(b.name));

  // Deux salons de discussion : le chat mondial (visible de tous) et le chat de guilde (réservé aux
  // membres de la guilde du joueur, absent si aucune guilde). Les anciens messages sans champ
  // "channel" (avant l'introduction du chat de guilde) sont traités comme mondiaux, par rétrocompatibilité.
  // isAdmin est recalculé à l'envoi de l'instantané (et non figé au moment du message) pour refléter
  // immédiatement une promotion/rétrogradation admin.
  const chatAll = db.chat||[];
  const withChatMeta = m => ({ id:m.id, username:m.username, text:m.text, time:m.time, kind:m.kind||"chat", isAdmin: isAdminUser(db, m.username) });
  const chatGlobal = chatAll.filter(m=>m.channel!=="guild").slice(-60).map(withChatMeta);
  const chatGuild = guild ? chatAll.filter(m=>m.channel==="guild" && m.guildId===guild.id).slice(-60).map(withChatMeta) : [];

  return {
    serverTime: now(),
    village: v,
    missions: myMissions,
    worldMissions,
    reports: (db.reports[username]||[]).slice(0,60),
    villages,
    myVillages: myVillagesList,
    achievements,
    leaderboard,
    isAdmin: isAdminUser(db, username),
    chat: chatGlobal,
    guildChat: chatGuild,
    speedMultiplier: getSpeedMultiplier(db),
    serverEvents: publicServerEvents(db),
    market: (db.market||[]).slice().sort((a,b)=>b.createdAt-a.createdAt),
    mySupport,
    guild: guild ? publicGuildView(db, guild, username) : null,
    guildInvites
  };
}

module.exports = {
  now, villageByUser, homeVillageOf, myVillages, doSwitchVillage,
  villageWall, villageHide, villageResCap, popUsed,
  doBuild, doBuildCancel, doTrain, doDisbandTroops, doMission, doRename, runTick, buildSnapshot,
  completeMission,
  doChatSend, doReportDelete, doReportClear, isAdminUser, adminListPlayers, adminSetAdmin,
  adminDeletePlayer,
  adminUpdateVillage, adminGiveResources, adminGiveResourcesToAll, adminFinishBuildQueue,
  adminFinishTrainQueue, adminSetSpeed, adminAnnounce, getSpeedMultiplier,
  adminListMissions, adminFinishMission,
  adminListAllVillages, adminUpdateVillageById, adminGiveResourcesToVillageById,
  adminFinishBuildQueueForVillage, adminFinishTrainQueueForVillage,
  adminBulkUpdateVillages, adminBulkGiveResourcesToVillages, adminBulkFinishQueues,
  adminListServerEvents, adminStartServerEvent, adminStopServerEvent,
  doSendSupport, doRecallSupport, doGiveResources, doTransferResourcesBetweenVillages,
  doMarketCreateOffer, doMarketCancelOffer, doMarketAcceptOffer,
  doGuildCreate, doGuildInvite, doGuildAccept, doGuildDecline, doGuildKick, doGuildLeave,
  doGuildDonate, doGuildDisband, doGuildBuyBoost, publicPlayerView,
  doDiplomacyPropose, doDiplomacyRespond, doDiplomacyCancel, doDiplomacyDeclareWar, listGuildsPublic
};
