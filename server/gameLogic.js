"use strict";
const GameData = require("../shared/gameData.js");
const { BUILDINGS, TROOPS, TROOP_ORDER, INFANTRY, CAVALRY, ARCHERS, clamp,
        buildCost, buildTime, prodPerHour, storageCap, farmCap, trainTime } = GameData;

function now(){ return Date.now()/1000; } // "temps de jeu" en secondes réelles (vitesse toujours x1 en multijoueur)

/* Multiplicateur de vitesse global, réglable par un administrateur (panneau Admin).
   S'applique aux NOUVELLES files de construction/entraînement lancées après le changement
   (les files déjà en cours gardent leur durée d'origine — utiliser "Terminer instantanément"
   depuis le panneau Admin pour accélérer une file déjà lancée). */
function getSpeedMultiplier(db){
  return (db.settings && db.settings.speedMultiplier) || 1;
}

function villageWall(v){ return v.owner==="barbarian" ? (v.wallLevel||0) : (v.buildings.wall||0); }
function villageHide(v){ return v.owner==="barbarian" ? (v.hideLevel||0) : (v.buildings.hide||0); }
function villageResCap(v){ return v.owner==="barbarian" ? (v.resCap||600) : storageCap(v.buildings.warehouse); }

function pushReport(db, username, report){
  if(!db.reports[username]) db.reports[username] = [];
  db.reports[username].unshift(report);
  if(db.reports[username].length>60) db.reports[username].length=60;
}

function villageByUser(db, username){
  const u = db.users[username];
  if(!u) return null;
  return db.villages[u.villageId] || null;
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
  const dur = buildTime(key, nextLevel, v.buildings.hq) / getSpeedMultiplier(db);
  // Les mises à niveau d'un même bâtiment s'enchaînent : celle-ci démarre seulement à la fin
  // de la dernière déjà en file pour ce bâtiment (pas immédiatement), pour un minutage correct.
  let chainStart = now();
  for(const o of v.buildQueue){ if(o.key===key){ const end=o.startAt+o.duration; if(end>chainStart) chainStart=end; } }
  v.buildQueue.push({ key, level: nextLevel, startAt: chainStart, duration: dur });
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
    const cap = v.buildings.academy||0;
    const alive = (v.troops.noble||0) + v.trainQueue.filter(o=>o.troop==="noble").reduce((s,o)=>s+o.count,0);
    if(alive+count > cap) return { error: "Académie niveau "+cap+" : "+cap+" noble(s) vivant(s) maximum à la fois." };
  }
  const cost = { wood:t.cost.wood*count, clay:t.cost.clay*count, iron:t.cost.iron*count };
  if(v.resources.wood<cost.wood || v.resources.clay<cost.clay || v.resources.iron<cost.iron) return { error: "Ressources insuffisantes pour entraîner "+count+" "+t.name+"." };
  const used = popUsed(v);
  const free = farmCap(v.buildings.farm) - used;
  if(t.pop*count > free) return { error: "Population insuffisante (ferme trop petite)." };
  if(v.trainQueue.length>=8) return { error: "File d'entraînement pleine (max 8)." };
  v.resources.wood-=cost.wood; v.resources.clay-=cost.clay; v.resources.iron-=cost.iron;
  v.trainQueue.push({ troop:key, count, unitStartAt: now(), unitDuration: trainTime(key, v.buildings.barracks) / getSpeedMultiplier(db) });
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
    if(n>0){ troops[k]=n; any=true; maxSpeed=Math.max(maxSpeed, TROOPS[k].speed); }
  }
  if(!any) return { error: "Sélectionnez au moins une troupe à envoyer." };
  if(kind==="scout" && !troops.scout) return { error: "Une reconnaissance nécessite au moins un éclaireur." };
  for(const k in troops) v.troops[k]-=troops[k];
  const dx=target.x-v.x, dy=target.y-v.y, dist=Math.sqrt(dx*dx+dy*dy);
  const travel = Math.max(4, Math.round(dist*maxSpeed));
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

function resolveAttack(db, m){
  const target = db.villages[m.targetId];
  m.resolveDone=true; m.returnAt=m.arriveAt+m.travel;
  const attackerVillage = villageByUser(db, m.attackerUsername);
  if(!target){ pushReport(db, m.attackerUsername, {kind:"attack", time:now(), lost:true, text:"Le village ciblé n'existe plus."}); return; }

  const { power: attackPower, shareInf, shareCav, shareArch } = computePower(m.troops);
  const defensePower = defensePowerOf(target.troops, shareInf, shareCav, shareArch, villageWall(target));
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
  const attackerLosses={}, defenderLosses={};
  for(const k in m.troops){
    if(k==="noble") continue; // le noble a sa propre règle de survie ci-dessous, pas la fraction générale
    const survivors=Math.floor(m.troops[k]*(1-attackerLossFrac));
    attackerLosses[k]=m.troops[k]-survivors;
    m.troops[k]=survivors;
  }
  for(const k of TROOP_ORDER){
    const c=target.troops[k]||0;
    if(!c) continue;
    const survivors=Math.floor(c*(1-defenderLossFrac));
    defenderLosses[k]=c-survivors;
    target.troops[k]=survivors;
  }

  /* Survie du noble : avec l'ancienne règle (même fraction de pertes que le reste de l'armée),
     un noble envoyé seul (le cas le plus courant) mourait TOUJOURS dès qu'il y avait la moindre
     perte, même infime (Math.floor(1*0.98)=0) — impossible de conquérir quoi que ce soit.
     Nouvelle règle : chaque noble est tiré au sort indépendamment, avec une chance de survie qui
     augmente avec la domination de l'attaque (donc avec l'escorte envoyée pour le protéger). */
  if(originalNobleCount>0){
    let noblesSurviving=0;
    if(winner==="attacker"){
      const dominance = clamp(1-attackerLossFrac, 0, 1); // proche de 1 si l'attaque écrase la défense
      const survivalChance = clamp(0.15+dominance*0.8, 0.05, 0.97);
      for(let i=0;i<originalNobleCount;i++){ if(Math.random()<survivalChance) noblesSurviving++; }
    } else {
      const survivalChance = 0.05; // défaite : le noble a une petite chance de s'échapper malgré tout
      for(let i=0;i<originalNobleCount;i++){ if(Math.random()<survivalChance) noblesSurviving++; }
    }
    m.troops.noble = noblesSurviving;
    attackerLosses.noble = originalNobleCount-noblesSurviving;
  }

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
      }
    } else if(nobleSurvivors>0){
      m.troops.noble = 0; // consommé même contre un joueur (pas de conquête de joueur en MVP)
    }
  }

  let loot={wood:0,clay:0,iron:0};
  if(winner==="attacker" && target.owner!==m.attackerUsername){
    let carryCap=0;
    for(const k in m.troops) carryCap+=m.troops[k]*TROOPS[k].carry;
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

  const report = {
    kind:"attack", time:now(), winner, target:target.name, coord:target.x+"|"+target.y,
    targetIsPlayer: target.owner!=="barbarian", targetOwner: target.owner==="barbarian"?null:target.owner,
    attackPower:Math.round(attackPower), effAttack:Math.round(effAttack), defensePower:Math.round(defensePower),
    luck, attackerLosses, defenderLosses, loot,
    wallDamage, storageDamageFrac, loyaltyReduced, conquered, targetLoyalty: target.loyalty
  };
  pushReport(db, m.attackerUsername, report);

  // rapport de défense pour la victime, si c'est un vrai joueur
  if(target.owner!=="barbarian" && target.owner!==m.attackerUsername){
    pushReport(db, target.owner, {
      kind:"defense", time:now(), winner, source: m.attackerUsername,
      attackPower:Math.round(attackPower), effAttack:Math.round(effAttack), defensePower:Math.round(defensePower),
      luck, defenderLosses, loot, wallDamage, storageDamageFrac
    });
  }
}

function resolveRaid(db, m){
  const target = db.villages[m.targetId]; // le village du joueur visé
  m.resolveDone=true; m.returnAt=m.arriveAt+m.travel;
  if(!target){ return; }
  const { power: attackPower, shareInf, shareCav, shareArch } = computePower(m.troops);
  const defensePower = defensePowerOf(target.troops, shareInf, shareCav, shareArch, target.buildings.wall);
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
  const defenderLosses={};
  for(const k of TROOP_ORDER){
    const c=target.troops[k]||0; if(!c) continue;
    const survivors=Math.floor(c*(1-defenderLossFrac));
    defenderLosses[k]=c-survivors; target.troops[k]=survivors;
  }
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
    luck, defenderLosses, loot
  });
}

function completeMission(db, m){
  const v = m.kind==="raid" ? db.villages[m.sourceVillageId] : villageByUser(db, m.attackerUsername);
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
    for(const r of ["wood","clay","iron"]){
      const perSec = prodPerHour(r, v.buildings[r])/3600*empireMult*speedMult;
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
        else { order.unitStartAt = order.unitStartAt+order.unitDuration; order.unitDuration = trainTime(order.troop, v.buildings.barracks) / getSpeedMultiplier(db); }
      } else break;
    }
  }

  // missions : arrivée -> résolution ; retour -> troupes de retour
  for(const m of db.missions){
    if(!m.resolveDone && t>=m.arriveAt){
      if(m.kind==="scout") resolveScout(db, m);
      else if(m.kind==="raid") resolveRaid(db, m);
      else resolveAttack(db, m);
    } else if(m.resolveDone && !m.completed && t>=m.returnAt){
      completeMission(db, m);
    }
  }
  db.missions = db.missions.filter(m=>!m.completed);

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
  const attackerVillage = villageByUser(db, attackerUsername);
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
/*  Objectifs (jalons de progression, récompense unique)                   */
/* ---------------------------------------------------------------------- */

const QUESTS = [
  {key:"hq3", title:"Bâtisseur en herbe", desc:"Faites atteindre le niveau 3 à votre Hôtel de ville.", icon:"🏗️",
    check:v=>v.buildings.hq>=3, reward:{wood:500,clay:500,iron:500}},
  {key:"economy5", title:"Économie locale", desc:"Amenez le Camp de bûcherons, la Carrière d'argile et la Fonderie de fer au niveau 5.", icon:"🌾",
    check:v=>v.buildings.wood>=5 && v.buildings.clay>=5 && v.buildings.iron>=5, reward:{wood:1000,clay:1000,iron:1000}},
  {key:"barracks1", title:"Premiers soldats", desc:"Construisez une Caserne.", icon:"⚔️",
    check:v=>(v.buildings.barracks||0)>=1, reward:{troops:{spear:10}}},
  {key:"wall1", title:"Fortification", desc:"Construisez une Muraille.", icon:"🧱",
    check:v=>(v.buildings.wall||0)>=1, reward:{wood:800,clay:800,iron:800}},
  {key:"troops50", title:"Armée en marche", desc:"Possédez au moins 50 troupes au total.", icon:"🪖",
    check:v=>TROOP_ORDER.reduce((s,k)=>s+(v.troops[k]||0),0)>=50, reward:{wood:1500,clay:1500,iron:1500}},
  {key:"firstVictory", title:"Premier assaut", desc:"Remportez votre première attaque contre un village.", icon:"🏆",
    check:(v,db,username)=>(db.reports[username]||[]).some(r=>r.kind==="attack" && r.winner==="attacker"), reward:{wood:2000,clay:2000,iron:2000}},
  {key:"firstConquest", title:"Premier fief", desc:"Conquérez votre premier village.", icon:"👑",
    check:v=>(v.conqueredCount||0)>=1, reward:{wood:4000,clay:4000,iron:4000}},
  {key:"hq20", title:"Métropole", desc:"Faites atteindre le niveau 20 à votre Hôtel de ville.", icon:"🏛️",
    check:v=>v.buildings.hq>=20, reward:{wood:8000,clay:8000,iron:8000}}
];

function doClaimQuest(db, username, key){
  const v = villageByUser(db, username);
  if(!v) return { error:"Village introuvable." };
  const q = QUESTS.find(x=>x.key===key);
  if(!q) return { error:"Objectif inconnu." };
  v.claimedQuests = v.claimedQuests||[];
  if(v.claimedQuests.includes(key)) return { error:"Récompense déjà réclamée." };
  if(!q.check(v, db, username)) return { error:"Objectif pas encore atteint." };
  if(q.reward.wood||q.reward.clay||q.reward.iron){
    const cap = storageCap(v.buildings.warehouse);
    for(const r of ["wood","clay","iron"]) if(q.reward[r]) v.resources[r]=clamp(v.resources[r]+q.reward[r],0,cap);
  }
  if(q.reward.troops) for(const tk in q.reward.troops) v.troops[tk]=(v.troops[tk]||0)+q.reward.troops[tk];
  v.claimedQuests.push(key);
  return { ok:true };
}

/* ---------------------------------------------------------------------- */
/*  Chat mondial (un seul salon, tous les joueurs)                         */
/* ---------------------------------------------------------------------- */

function doChatSend(db, username, text){
  text = String(text||"").trim();
  if(!text) return { error:"Message vide." };
  if(text.length>300) text = text.slice(0,300);
  const u = db.users[username];
  const t = Date.now();
  if(u && u.lastChatAt && (t-u.lastChatAt) < 1200) return { error:"Vous envoyez des messages trop vite, patientez un instant." };
  if(u) u.lastChatAt = t;
  db.chat = db.chat||[];
  db.chat.push({ id:"c"+t+Math.floor(Math.random()*100000), username, text, time: now() });
  if(db.chat.length>200) db.chat.splice(0, db.chat.length-200);
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
      trainQueueLen: v ? v.trainQueue.length : 0
    };
  }).sort((a,b)=>a.username.localeCompare(b.username));
}

function adminSetAdmin(db, targetUsername, flag){
  const u = db.users[targetUsername];
  if(!u) return { error:"Joueur introuvable." };
  u.isAdmin = !!flag;
  return { ok:true };
}

function adminUpdateVillage(db, targetUsername, patch){
  const v = villageByUser(db, targetUsername);
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
  const v = villageByUser(db, targetUsername);
  if(!v) return { error:"Village introuvable pour "+targetUsername+"." };
  const add = { wood:Number(wood)||0, clay:Number(clay)||0, iron:Number(iron)||0 };
  for(const r of ["wood","clay","iron"]) v.resources[r] = clamp(v.resources[r]+add[r], 0, 1e12);
  return { ok:true };
}

function adminFinishBuildQueue(db, targetUsername){
  const v = villageByUser(db, targetUsername);
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
  const v = villageByUser(db, targetUsername);
  if(!v) return { error:"Village introuvable." };
  if(!v.trainQueue.length) return { error:"File d'entraînement déjà vide." };
  for(const order of v.trainQueue) v.troops[order.troop] = (v.troops[order.troop]||0)+order.count;
  v.trainQueue = [];
  return { ok:true };
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
  return { ok:true };
}

function adminGiveResourcesToAll(db, wood, clay, iron){
  const add = { wood:Number(wood)||0, clay:Number(clay)||0, iron:Number(iron)||0 };
  let count=0;
  for(const uname in db.users){
    const v = villageByUser(db, uname);
    if(!v) continue;
    for(const r of ["wood","clay","iron"]) v.resources[r] = clamp(v.resources[r]+add[r], 0, 1e12);
    count++;
  }
  return { ok:true, count };
}

/* ---------------------------------------------------------------------- */
/*  Instantané d'état envoyé au client                                     */
/* ---------------------------------------------------------------------- */

function publicVillageView(v){
  return {
    id: v.id, x: v.x, y: v.y, name: v.name,
    owner: v.owner, isPlayer: v.owner!=="barbarian",
    tier: v.tier, wallLevel: villageWall(v)
  };
}

function buildSnapshot(db, username){
  const v = villageByUser(db, username);
  if(!v) return null;
  const myMissions = db.missions.filter(m=>m.attackerUsername===username || (m.kind==="raid" && db.villages[m.targetId] && db.villages[m.targetId].owner===username));
  const villages = Object.values(db.villages).map(publicVillageView);
  const questStatus = QUESTS.map(q=>({
    key:q.key, title:q.title, desc:q.desc, icon:q.icon, reward:q.reward,
    claimed: (v.claimedQuests||[]).includes(q.key),
    met: q.check(v, db, username)
  }));
  const leaderboard = Object.entries(db.users).map(([uname,u])=>{
    const pv = db.villages[u.villageId];
    if(!pv) return null;
    const hq = pv.buildings ? pv.buildings.hq : 0;
    const points = (hq||0)*10 + (pv.conqueredCount||0)*50;
    return { username: uname, hq: hq||0, conquered: pv.conqueredCount||0, points };
  }).filter(Boolean).sort((a,b)=>b.points-a.points).slice(0,20);

  return {
    serverTime: now(),
    village: v,
    missions: myMissions,
    reports: (db.reports[username]||[]).slice(0,60),
    villages,
    quests: questStatus,
    leaderboard,
    isAdmin: isAdminUser(db, username),
    chat: (db.chat||[]).slice(-50),
    speedMultiplier: getSpeedMultiplier(db)
  };
}

module.exports = {
  now, villageByUser, villageWall, villageHide, villageResCap, popUsed,
  doBuild, doTrain, doMission, doClaimQuest, doRename, runTick, buildSnapshot, QUESTS,
  doChatSend, isAdminUser, adminListPlayers, adminSetAdmin, adminUpdateVillage,
  adminGiveResources, adminGiveResourcesToAll, adminFinishBuildQueue, adminFinishTrainQueue,
  adminSetSpeed, adminAnnounce, getSpeedMultiplier
};
