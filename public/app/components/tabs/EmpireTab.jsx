import { useRef, useState } from "react";
import { useGame } from "../../GameContext.jsx";
import { BUILD_ORDER, BUILDINGS, TROOP_ORDER, TROOPS, buildCost } from "../../gameData.js";
import { fmt, fmtTime, estimateNow, vBuildTime, vTrainTime, canAffordAll, nobleCount, NOBLE_CAP_PER_VILLAGE, RES_ICON } from "../../formulas.js";

// Porte renderEmpire() et ses 5 sous-onglets (Aperçu/Notifications/Construction/Troupes/Envoi de
// ressources) + attachEmpireHandlers()/empireQueueBuild()/etc. : gestion groupée de tous les
// villages du compte sans avoir à basculer dessus un par un.
export default function EmpireTab() {
  const {
    snapshot,
    username,
    serverTimeOffset,
    adminSpeed,
    doAction,
    call,
    setActiveTab
  } = useGame();
  const villages = snapshot.myVillagesDetailed || [];
  const [subTab, setSubTab] = useState("apercu");
  const [selectedVillageId, setSelectedVillageId] = useState(null);
  const now = estimateNow(serverTimeOffset);
  function gotoVillage(villageId) {
    doAction(() => call("/api/village/switch", "POST", {
      villageId
    }), "🏰 Village actif changé.", null).then(() => setActiveTab("buildings")).catch(() => {});
  }
  const subTabs = [["apercu", "📊 Aperçu"], ["notifications", "🔔 Notifications"], ["construction", "🏗️ Construction"], ["troupes", "⚔️ Troupes"], ["resources", "📦 Envoi de ressources"]];
  let content;
  if (subTab === "notifications") content = /*#__PURE__*/React.createElement(NotificationsBox, {
    villages: villages,
    snapshot: snapshot,
    now: now
  });else if (subTab === "construction") content = /*#__PURE__*/React.createElement(ConstructionBox, {
    villages: villages,
    snapshot: snapshot,
    now: now,
    adminSpeed: adminSpeed,
    selectedVillageId: selectedVillageId,
    onSelect: setSelectedVillageId,
    doAction: doAction,
    call: call
  });else if (subTab === "troupes") content = /*#__PURE__*/React.createElement(TroopsBox, {
    villages: villages,
    snapshot: snapshot,
    now: now,
    adminSpeed: adminSpeed,
    selectedVillageId: selectedVillageId,
    onSelect: setSelectedVillageId,
    doAction: doAction,
    call: call
  });else if (subTab === "resources") content = /*#__PURE__*/React.createElement(ResourcesBox, {
    villages: villages,
    snapshot: snapshot,
    doAction: doAction,
    call: call
  });else content = /*#__PURE__*/React.createElement(OverviewBox, {
    villages: villages,
    snapshot: snapshot,
    now: now,
    username: username,
    onGoto: gotoVillage
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "\uD83C\uDFF0 Gestion de l'empire"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Vue d'ensemble et gestion group\xE9e de vos ", villages.length, " villages, sans avoir \xE0 basculer sur chacun d'eux."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 16
    }
  }, subTabs.map(([k, label]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: subTab === k ? "primary" : "",
    onClick: () => setSubTab(k)
  }, label))), content);
}
function empireBuildQueueHead(v, now) {
  if (!v.buildQueue.length) return /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "File vide");
  const item = v.buildQueue[0];
  const b = BUILDINGS[item.key];
  const remain = Math.max(0, item.startAt + item.duration - now);
  return /*#__PURE__*/React.createElement(React.Fragment, null, b.name, " \u2192 niv.", item.level, " ", /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "(", fmtTime(remain), ")"), v.buildQueue.length > 1 ? /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, " +", v.buildQueue.length - 1) : null);
}
function empireTrainQueueHead(v, now) {
  if (!v.trainQueue.length) return /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "File vide");
  const o = v.trainQueue[0];
  const remain = Math.max(0, o.unitStartAt + o.unitDuration - now);
  return /*#__PURE__*/React.createElement(React.Fragment, null, TROOPS[o.troop].name, " \xD7", o.count, " ", /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "(", fmtTime(remain), "/unit\xE9)"), v.trainQueue.length > 1 ? /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, " +", v.trainQueue.length - 1) : null);
}
function OverviewBox({
  villages,
  snapshot,
  now,
  username,
  onGoto
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Cliquez sur un village pour y basculer directement (onglet B\xE2timents)."), /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Village"), /*#__PURE__*/React.createElement("th", null, "HdV"), /*#__PURE__*/React.createElement("th", null, "Niveaux cumul\xE9s"), /*#__PURE__*/React.createElement("th", null, "Ressources"), /*#__PURE__*/React.createElement("th", null, "Pop."), /*#__PURE__*/React.createElement("th", null, "Construction"), /*#__PURE__*/React.createElement("th", null, "Entra\xEEnement"), /*#__PURE__*/React.createElement("th", null, "Missions"))), /*#__PURE__*/React.createElement("tbody", null, villages.map(v => {
    const buildLevels = BUILD_ORDER.reduce((s, k) => s + (v.buildings[k] || 0), 0);
    const outMissions = snapshot.missions.filter(m => m.sourceVillageId === v.id && m.attackerUsername === username && !m.completed).length;
    const inThreats = (snapshot.incomingAttacks || []).filter(m => m.targetVillageId === v.id).length + snapshot.missions.filter(m => m.kind === "raid" && !m.resolveDone && m.targetId === v.id).length;
    return /*#__PURE__*/React.createElement("tr", {
      key: v.id,
      style: {
        cursor: "pointer"
      },
      onClick: () => onGoto(v.id)
    }, /*#__PURE__*/React.createElement("td", null, v.isHome ? "🏠 " : "🚩 ", v.name, /*#__PURE__*/React.createElement("div", {
      className: "small muted"
    }, v.x, "|", v.y)), /*#__PURE__*/React.createElement("td", null, v.buildings.hq || 0), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, buildLevels), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, RES_ICON.wood, " ", fmt(v.resources.wood), " \xB7 ", RES_ICON.clay, " ", fmt(v.resources.clay), " \xB7 ", RES_ICON.iron, " ", fmt(v.resources.iron), /*#__PURE__*/React.createElement("div", {
      className: "muted"
    }, "/ ", fmt(v.resCap))), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, v.pop, "/", v.popMax), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, empireBuildQueueHead(v, now)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, empireTrainQueueHead(v, now)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, outMissions ? /*#__PURE__*/React.createElement(React.Fragment, null, outMissions, " envoy\xE9e(s)", /*#__PURE__*/React.createElement("br", null)) : null, inThreats ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: "#e05a4a"
      }
    }, "\u26A0\uFE0F ", inThreats, " entrante(s)") : outMissions ? null : /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "\u2014")));
  })))));
}
function NotificationsBox({
  villages,
  snapshot,
  now
}) {
  const items = [];
  for (const v of villages) {
    for (const item of v.buildQueue) {
      const b = BUILDINGS[item.key];
      items.push({
        time: item.startAt + item.duration,
        icon: "🏗️",
        text: `${b.name} → niv. ${item.level} — ${v.name}`
      });
    }
    for (const o of v.trainQueue) {
      items.push({
        time: o.unitStartAt + o.unitDuration,
        icon: "⚔️",
        text: `${TROOPS[o.troop].name} — ${v.name} (encore ${o.count} unité(s) dans cette file)`
      });
    }
  }
  for (const m of snapshot.incomingAttacks || []) {
    const label = m.kind === "scout" ? "🔭 Reconnaissance" : "⚔️ Attaque";
    items.push({
      time: m.arriveAt,
      icon: "🚨",
      text: `${label} de ${m.attackerUsername} vers ${m.targetName || "?"}`,
      danger: true
    });
  }
  for (const m of snapshot.missions.filter(mm => mm.kind === "raid" && !mm.resolveDone)) {
    items.push({
      time: m.arriveAt,
      icon: "🚨",
      text: `Riposte de ${m.raidSourceName || "village barbare"} approche`,
      danger: true
    });
  }
  items.sort((a, b) => a.time - b.time);
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginTop: 0
    }
  }, "\uD83D\uDD14 Notifications \u2014 tout votre empire"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Constructions et entra\xEEnements en cours, et attaques entrantes, sur TOUS vos villages, tri\xE9s par ordre d'arriv\xE9e."), items.length ? items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    className: "mission-item",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-between"
  }, /*#__PURE__*/React.createElement("span", null, it.icon, " ", it.text), /*#__PURE__*/React.createElement("span", {
    style: it.danger ? {
      color: "#e05a4a"
    } : undefined
  }, fmtTime(Math.max(0, it.time - now)))))) : /*#__PURE__*/React.createElement("div", {
    className: "muted small"
  }, "Rien \xE0 signaler pour l'instant."));
}
function ConstructionBox({
  villages,
  snapshot,
  now,
  adminSpeed,
  selectedVillageId,
  onSelect,
  doAction,
  call
}) {
  const selV = villages.find(v => v.id === selectedVillageId) || villages.find(v => v.id === snapshot.village.id) || villages[0];
  function queueBuild(villageId, key) {
    doAction(() => call("/api/build", "POST", {
      key,
      villageId
    }), "🏗️ Construction lancée.", null);
  }
  function cancelBuild(villageId, index) {
    doAction(() => call("/api/build/cancel", "POST", {
      index,
      villageId
    }), "Construction annulée, ressources remboursées.", null);
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginTop: 0
    }
  }, "\uD83C\uDFD7\uFE0F Construction \u2014 tous vos villages"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Cliquez sur un village pour lancer une construction directement, sans y basculer."), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 220,
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Village"), /*#__PURE__*/React.createElement("th", null, "Coord."), /*#__PURE__*/React.createElement("th", null, "HdV"), /*#__PURE__*/React.createElement("th", null, "File en cours"), /*#__PURE__*/React.createElement("th", null, "Occupation"))), /*#__PURE__*/React.createElement("tbody", null, villages.map(v => /*#__PURE__*/React.createElement("tr", {
    key: v.id,
    className: selV && selV.id === v.id ? "admin-selected" : "",
    style: {
      cursor: "pointer"
    },
    onClick: () => onSelect(v.id)
  }, /*#__PURE__*/React.createElement("td", null, v.isHome ? "🏠 " : "🚩 ", v.name), /*#__PURE__*/React.createElement("td", null, v.x, "|", v.y), /*#__PURE__*/React.createElement("td", null, v.buildings.hq || 0), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, empireBuildQueueHead(v, now)), /*#__PURE__*/React.createElement("td", null, v.buildQueue.length, "/6"))))))), selV ? /*#__PURE__*/React.createElement(ConstructionEditor, {
    v: selV,
    now: now,
    adminSpeed: adminSpeed,
    onBuild: queueBuild,
    onCancel: cancelBuild
  }) : null);
}
function ConstructionEditor({
  v,
  now,
  adminSpeed,
  onBuild,
  onCancel
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginTop: 0
    }
  }, "\u270F\uFE0F ", v.isHome ? "🏠 " : "🚩 ", v.name, " ", /*#__PURE__*/React.createElement("span", {
    className: "small muted",
    style: {
      fontWeight: "normal"
    }
  }, "(", v.x, "|", v.y, ")")), /*#__PURE__*/React.createElement("h4", null, "File de construction"), v.buildQueue.length ? v.buildQueue.map((item, i) => {
    const b = BUILDINGS[item.key];
    const timeLeft = Math.max(0, item.startAt + item.duration - now);
    const pct = 100 * (1 - timeLeft / item.duration);
    return /*#__PURE__*/React.createElement("div", {
      className: "queue-item",
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex-between"
    }, /*#__PURE__*/React.createElement("span", null, b.name, " \u2192 niv. ", item.level), /*#__PURE__*/React.createElement("span", null, fmtTime(timeLeft), " ", /*#__PURE__*/React.createElement("a", {
      href: "#",
      style: {
        marginLeft: 6
      },
      title: "Annuler (rembours\xE9)",
      onClick: e => {
        e.preventDefault();
        onCancel(v.id, i);
      }
    }, "\u2716"))), /*#__PURE__*/React.createElement("div", {
      className: "bar-bg"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bar-fill",
      style: {
        width: pct + "%"
      }
    })));
  }) : /*#__PURE__*/React.createElement("div", {
    className: "muted small"
  }, "File vide."), /*#__PURE__*/React.createElement("h4", null, "B\xE2timents"), /*#__PURE__*/React.createElement("div", {
    className: "grid-buildings"
  }, BUILD_ORDER.filter(k => k !== "hq").map(key => {
    const b = BUILDINGS[key],
      lvl = v.buildings[key] || 0,
      atMax = lvl >= b.max;
    const queuedCount = v.buildQueue.filter(q => q.key === key).length;
    const nextLevel = lvl + queuedCount + 1,
      maxed = nextLevel > b.max;
    const cost = maxed ? null : buildCost(key, nextLevel);
    const time = maxed ? null : vBuildTime(v, key, nextLevel, adminSpeed);
    const lockedReq = b.requires && Object.entries(b.requires).some(([rk, rv]) => (v.buildings[rk] || 0) < rv);
    const affordable = cost && v.resources.wood >= cost.wood && v.resources.clay >= cost.clay && v.resources.iron >= cost.iron;
    const isEmpty = lvl <= 0;
    const queueFull = v.buildQueue.length >= 6;
    return /*#__PURE__*/React.createElement("div", {
      className: "card",
      key: key
    }, /*#__PURE__*/React.createElement("div", {
      className: "card-head"
    }, /*#__PURE__*/React.createElement("h4", null, b.name, /*#__PURE__*/React.createElement("span", {
      className: "small muted",
      style: {
        fontWeight: "normal"
      }
    }, "niveau ", lvl, atMax ? " (max)" : ""))), /*#__PURE__*/React.createElement("div", {
      className: "desc"
    }, b.desc), maxed ? /*#__PURE__*/React.createElement("p", {
      className: "muted small"
    }, atMax ? "Niveau maximum atteint." : "Toutes les améliorations jusqu'au niveau maximum sont déjà en file.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "cost"
    }, /*#__PURE__*/React.createElement("span", {
      className: v.resources.wood < cost.wood ? "short" : ""
    }, "\uD83E\uDEB5 ", fmt(cost.wood)), /*#__PURE__*/React.createElement("span", {
      className: v.resources.clay < cost.clay ? "short" : ""
    }, "\uD83E\uDDF1 ", fmt(cost.clay)), /*#__PURE__*/React.createElement("span", {
      className: v.resources.iron < cost.iron ? "short" : ""
    }, "\u26CF\uFE0F ", fmt(cost.iron)), /*#__PURE__*/React.createElement("span", null, "\u23F1 ", fmtTime(time))), lockedReq ? /*#__PURE__*/React.createElement("div", {
      className: "req-note"
    }, "N\xE9cessite : ", Object.entries(b.requires).map(([rk, rv]) => BUILDINGS[rk].name + " niv. " + rv).join(", ")) : null, queuedCount ? /*#__PURE__*/React.createElement("div", {
      className: "unit-note"
    }, queuedCount, " d\xE9j\xE0 en file d'attente") : null, /*#__PURE__*/React.createElement("button", {
      className: "primary",
      disabled: !affordable || lockedReq || queueFull,
      onClick: () => onBuild(v.id, key)
    }, isEmpty ? "Construire" : "Améliorer", " \u2192 niveau ", nextLevel)));
  })));
}
function TroopsBox({
  villages,
  snapshot,
  now,
  adminSpeed,
  selectedVillageId,
  onSelect,
  doAction,
  call
}) {
  const selV = villages.find(v => v.id === selectedVillageId) || villages.find(v => v.id === snapshot.village.id) || villages[0];
  function queueTrain(villageId, key, count) {
    count = Math.floor(count);
    if (!count || count <= 0) return;
    doAction(() => call("/api/train", "POST", {
      key,
      count,
      villageId
    }), "⚔️ Entraînement lancé.", null);
  }
  function cancelTrain(villageId, index) {
    doAction(() => call("/api/train/cancel", "POST", {
      index,
      villageId
    }), "Entraînement annulé, ressources remboursées.", null);
  }
  function disbandTroops(villageId, key, count) {
    count = Math.floor(count);
    if (!count || count <= 0) return;
    if (!confirm("Licencier ces troupes ? Elles seront définitivement détruites, sans remboursement.")) return;
    doAction(() => call("/api/troops/disband", "POST", {
      key,
      count,
      villageId
    }), "🗑️ Troupes licenciées.", null);
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginTop: 0
    }
  }, "\u2694\uFE0F Troupes \u2014 tous vos villages"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Cliquez sur un village pour entra\xEEner ou licencier des troupes directement, sans y basculer."), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 220,
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Village"), /*#__PURE__*/React.createElement("th", null, "Coord."), /*#__PURE__*/React.createElement("th", null, "Pop."), /*#__PURE__*/React.createElement("th", null, "File en cours"), /*#__PURE__*/React.createElement("th", null, "Troupes (total)"))), /*#__PURE__*/React.createElement("tbody", null, villages.map(v => {
    const totalTroops = TROOP_ORDER.reduce((s, k) => s + (v.troops[k] || 0), 0);
    return /*#__PURE__*/React.createElement("tr", {
      key: v.id,
      className: selV && selV.id === v.id ? "admin-selected" : "",
      style: {
        cursor: "pointer"
      },
      onClick: () => onSelect(v.id)
    }, /*#__PURE__*/React.createElement("td", null, v.isHome ? "🏠 " : "🚩 ", v.name), /*#__PURE__*/React.createElement("td", null, v.x, "|", v.y), /*#__PURE__*/React.createElement("td", null, v.pop, "/", v.popMax), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, empireTrainQueueHead(v, now)), /*#__PURE__*/React.createElement("td", null, totalTroops));
  }))))), selV ? /*#__PURE__*/React.createElement(TroopsEditor, {
    v: selV,
    now: now,
    adminSpeed: adminSpeed,
    onTrain: queueTrain,
    onCancel: cancelTrain,
    onDisband: disbandTroops
  }) : null);
}
function TroopsEditor({
  v,
  now,
  adminSpeed,
  onTrain,
  onCancel,
  onDisband
}) {
  if ((v.buildings.barracks || 0) < 1) {
    return /*#__PURE__*/React.createElement("div", {
      className: "box"
    }, /*#__PURE__*/React.createElement("h3", {
      style: {
        marginTop: 0
      }
    }, "\u270F\uFE0F ", v.isHome ? "🏠 " : "🚩 ", v.name, " ", /*#__PURE__*/React.createElement("span", {
      className: "small muted",
      style: {
        fontWeight: "normal"
      }
    }, "(", v.x, "|", v.y, ")")), /*#__PURE__*/React.createElement("p", {
      className: "muted small"
    }, "Ce village n'a pas encore de Caserne : construisez-en une (sous-onglet Construction) pour pouvoir y entra\xEEner des troupes."));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginTop: 0
    }
  }, "\u270F\uFE0F ", v.isHome ? "🏠 " : "🚩 ", v.name, " ", /*#__PURE__*/React.createElement("span", {
    className: "small muted",
    style: {
      fontWeight: "normal"
    }
  }, "(", v.x, "|", v.y, ")"), " \u2014 Caserne niv. ", v.buildings.barracks), /*#__PURE__*/React.createElement("h4", null, "File d'entra\xEEnement"), v.trainQueue.length ? v.trainQueue.map((o, i) => {
    const timeLeft = Math.max(0, o.unitStartAt + o.unitDuration - now);
    const pct = 100 * (1 - timeLeft / o.unitDuration);
    return /*#__PURE__*/React.createElement("div", {
      className: "queue-item",
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex-between"
    }, /*#__PURE__*/React.createElement("span", null, TROOPS[o.troop].name, " \xD7", o.count), /*#__PURE__*/React.createElement("span", null, fmtTime(timeLeft), " / unit\xE9 ", /*#__PURE__*/React.createElement("a", {
      href: "#",
      style: {
        marginLeft: 6
      },
      title: "Annuler (rembours\xE9)",
      onClick: e => {
        e.preventDefault();
        onCancel(v.id, i);
      }
    }, "\u2716"))), /*#__PURE__*/React.createElement("div", {
      className: "bar-bg"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bar-fill",
      style: {
        width: pct + "%"
      }
    })));
  }) : /*#__PURE__*/React.createElement("div", {
    className: "muted small"
  }, "File vide."), /*#__PURE__*/React.createElement("h4", null, "Troupes"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "\u23F1 temps d'entra\xEEnement par unit\xE9 au niveau de Caserne de ", /*#__PURE__*/React.createElement("b", null, "ce"), " village (plus elle est haute, plus l'entra\xEEnement est rapide)."), TROOP_ORDER.map(k => /*#__PURE__*/React.createElement(EmpireTroopRow, {
    key: k,
    k: k,
    v: v,
    adminSpeed: adminSpeed,
    onTrain: onTrain,
    onDisband: onDisband
  })));
}
function EmpireTroopRow({
  k,
  v,
  adminSpeed,
  onTrain,
  onDisband
}) {
  const t = TROOPS[k];
  const trainRef = useRef(null),
    disbandRef = useRef(null);
  const lockedEntries = Object.entries(t.requires).filter(([rk, rv]) => (v.buildings[rk] || 0) < rv);
  const locked = lockedEntries.length > 0;
  const home = v.troops[k] || 0;
  const nobleAlive = k === "noble" ? (v.troops.noble || 0) + v.trainQueue.filter(o => o.troop === "noble").reduce((s, o) => s + o.count, 0) : 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "troop-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tname"
  }, t.name), /*#__PURE__*/React.createElement("div", {
    className: "stats-mini"
  }, "\u2694\uFE0F", t.atk, " \uD83D\uDEE1\uFE0F", t.defInf, "/", t.defCav, "/", t.defArch, " \uD83C\uDF92", t.carry, " \uD83D\uDC0E", t.speed), /*#__PURE__*/React.createElement("div", {
    className: "small"
  }, "Stock : ", home), /*#__PURE__*/React.createElement("div", {
    className: "cost small"
  }, "\uD83E\uDEB5", fmt(t.cost.wood), " \uD83E\uDDF1", fmt(t.cost.clay), " \u26CF\uFE0F", fmt(t.cost.iron), " \uD83D\uDC65", t.pop, " \u23F1 ", fmtTime(vTrainTime(v, k, adminSpeed))), locked ? /*#__PURE__*/React.createElement("span", {
    className: "req-note"
  }, "N\xE9cessite : ", lockedEntries.map(([rk, rv]) => (BUILDINGS[rk] ? BUILDINGS[rk].name : rk) + " niv. " + rv).join(", ")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    defaultValue: "0",
    ref: trainRef
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => onTrain(v.id, k, Number(trainRef.current.value))
  }, "Entra\xEEner"), t.note ? /*#__PURE__*/React.createElement("div", {
    className: "unit-note"
  }, t.note) : null, k === "noble" ? /*#__PURE__*/React.createElement("div", {
    className: "unit-note"
  }, "Nobles vivants : ", nobleAlive, " / ", NOBLE_CAP_PER_VILLAGE, " dans ce village (1 seul noble peut partir par attaque)") : null), home > 0 ? /*#__PURE__*/React.createElement("div", {
    className: "disband-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    max: home,
    defaultValue: "0",
    ref: disbandRef
  }), /*#__PURE__*/React.createElement("button", {
    className: "danger",
    title: "Licencier d\xE9finitivement, sans remboursement",
    onClick: () => onDisband(v.id, k, Number(disbandRef.current.value))
  }, "\uD83D\uDDD1\uFE0F Licencier")) : null);
}
function ResourcesBox({
  villages,
  snapshot,
  doAction,
  call
}) {
  if (villages.length < 2) return /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Il vous faut au moins 2 villages pour transf\xE9rer des ressources entre eux.");
  const activeId = snapshot.village.id;
  const defaultTargetId = (villages.find(v => v.id !== activeId) || villages[0]).id;
  const sourceRef = useRef(null),
    targetRef = useRef(null);
  const woodRef = useRef(null),
    clayRef = useRef(null),
    ironRef = useRef(null);
  function transfer() {
    const srcId = sourceRef.current.value,
      tgtId = targetRef.current.value;
    if (!srcId || !tgtId || srcId === tgtId) return;
    const source = villages.find(v => v.id === srcId);
    const target = (snapshot.myVillages || []).find(mv => mv.id === tgtId);
    const amt = {};
    let any = false;
    for (const [r, ref] of [["wood", woodRef], ["clay", clayRef], ["iron", ironRef]]) {
      let n = Math.floor(Number(ref.current.value) || 0);
      n = Math.max(0, Math.min(n, source ? Math.floor(source.resources[r] || 0) : 0));
      if (n > 0) {
        amt[r] = n;
        any = true;
      }
    }
    if (!any) return;
    doAction(() => call("/api/village/transfer", "POST", {
      sourceVillageId: srcId,
      targetVillageId: tgtId,
      wood: amt.wood || 0,
      clay: amt.clay || 0,
      iron: amt.iron || 0
    }), "🚚 Ressources transférées" + (source && target ? " de " + source.name + " vers " + target.name : "") + ".", null);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginTop: 0
    }
  }, "\uD83D\uDCE6 Envoi de ressources entre vos villages"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Transfert instantan\xE9 (aucun trajet, aucun marchand) : choisissez le village source et le village de destination parmi TOUS les v\xF4tres, sans avoir \xE0 basculer dessus au pr\xE9alable. Plafonn\xE9 par la capacit\xE9 d'entrep\xF4t du village de destination."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      flexWrap: "wrap",
      alignItems: "flex-end",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "small muted"
  }, "Depuis"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("select", {
    ref: sourceRef,
    defaultValue: activeId
  }, villages.map(v => /*#__PURE__*/React.createElement("option", {
    key: v.id,
    value: v.id
  }, v.isHome ? "🏠 " : "🚩 ", v.name, " (", v.x, "|", v.y, ") \u2014 \uD83E\uDEB5", fmt(v.resources.wood), " \uD83E\uDDF1", fmt(v.resources.clay), " \u26CF\uFE0F", fmt(v.resources.iron))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "small muted"
  }, "Vers"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("select", {
    ref: targetRef,
    defaultValue: defaultTargetId
  }, villages.map(v => /*#__PURE__*/React.createElement("option", {
    key: v.id,
    value: v.id
  }, v.isHome ? "🏠 " : "🚩 ", v.name, " (", v.x, "|", v.y, ")"))))), /*#__PURE__*/React.createElement("div", {
    className: "inputs",
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "inp"
  }, RES_ICON.wood, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    defaultValue: "0",
    ref: woodRef
  })), /*#__PURE__*/React.createElement("div", {
    className: "inp"
  }, RES_ICON.clay, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    defaultValue: "0",
    ref: clayRef
  })), /*#__PURE__*/React.createElement("div", {
    className: "inp"
  }, RES_ICON.iron, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    defaultValue: "0",
    ref: ironRef
  }))), /*#__PURE__*/React.createElement("button", {
    className: "primary",
    onClick: transfer
  }, "\uD83D\uDE9A Transf\xE9rer"));
}