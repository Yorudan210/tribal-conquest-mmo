import { useGame } from "../GameContext.jsx";
import { storageCap, farmCap, TROOP_ORDER, TROOPS, BUILDINGS } from "../gameData.js";
import { fmt, fmtTime, fmtTroops, estimateNow, popUsed, resProdRate, villageResourceBonus, RES_ICON, RES_NAME } from "../formulas.js";

// Porte renderSidebar() : ressources, troupes stationnées, files de construction/entraînement,
// missions en cours, attaques entrantes, renforts — chaque action (annuler, rappeler) appelle
// directement l'API comme avant (doAction), la liste se met à jour au prochain instantané.
export default function Sidebar({
  openHelpBlackArmy
}) {
  const {
    snapshot,
    username,
    serverTimeOffset,
    doAction,
    call
  } = useGame();
  const s = snapshot;
  const v = s.village;
  const now = estimateNow(serverTimeOffset);
  const cap = storageCap(v.buildings.warehouse);
  const pop = popUsed(s, username),
    popMax = farmCap(v.buildings.farm);
  const presentTroops = TROOP_ORDER.filter(k => (v.troops[k] || 0) > 0);
  const activeMissions = s.missions.filter(m => m.kind !== "raid");
  const incomingRaids = s.missions.filter(m => m.kind === "raid" && !m.resolveDone);
  const MISSION_LABEL = {
    attack: "⚔️ Attaque",
    scout: "🔭 Reconnaissance",
    support: "🤝 Soutien",
    supportReturn: "🤝 Soutien"
  };
  const incomingPlayerAttacks = s.incomingAttacks || [];
  const incomingSupport = v.support || [];
  const mySupport = s.mySupport || [];
  const activeEvents = s.serverEvents || [];
  const ba = s.blackArmyEvent;
  function cancelBuild(index) {
    doAction(() => call("/api/build/cancel", "POST", {
      index
    }), "Construction annulée, ressources remboursées.", null);
  }
  function cancelTrain(index) {
    doAction(() => call("/api/train/cancel", "POST", {
      index
    }), "Entraînement annulé, ressources remboursées.", null);
  }
  function cancelMission(missionId) {
    doAction(() => call("/api/mission/cancel", "POST", {
      missionId
    }), "✖ Mission annulée, les troupes rentrent.", null);
  }
  function recallSupport(supportId) {
    doAction(() => call("/api/support/recall", "POST", {
      supportId
    }), "🤝 Rappel envoyé, vos troupes reviennent.", null);
  }
  return /*#__PURE__*/React.createElement("aside", {
    id: "sidebar"
  }, ba && ba.active ? /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      borderColor: "#9a2b2b",
      background: "linear-gradient(180deg, rgba(20,20,24,.55), rgba(20,20,24,.15))",
      boxShadow: "0 0 14px rgba(154,43,43,.25)"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginTop: 0
    }
  }, "\uD83C\uDFF4 L'Arm\xE9e Noire"), /*#__PURE__*/React.createElement("p", {
    className: "small",
    style: {
      margin: "2px 0 4px"
    }
  }, "Rep\xE9rez les villages ", /*#__PURE__*/React.createElement("b", null, "noirs"), " sur la carte \u2014 encore ", /*#__PURE__*/React.createElement("b", null, fmtTime(ba.remainingSec)), " avant leur retrait."), /*#__PURE__*/React.createElement("p", {
    className: "small muted",
    style: {
      margin: 0
    }
  }, fmt(ba.defeatedCount), " campement", ba.defeatedCount > 1 ? "s" : "", " vaincu", ba.defeatedCount > 1 ? "s" : "", " par la communaut\xE9 \xB7", " ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      openHelpBlackArmy && openHelpBlackArmy();
    }
  }, "r\xE8gles de l'\xE9v\xE8nement"))) : null, activeEvents.length ? /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      borderColor: "var(--gold)"
    }
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83C\uDF89 \xC9v\xE8nements en cours"), /*#__PURE__*/React.createElement("div", {
    className: "event-badges"
  }, activeEvents.map(e => /*#__PURE__*/React.createElement("span", {
    className: "event-badge",
    key: e.id,
    title: `${e.name} ×${e.multiplier} — encore ${fmtTime(e.remainingSec)}`
  }, e.icon, /*#__PURE__*/React.createElement("span", {
    className: "event-badge-mult"
  }, "\xD7", e.multiplier))))) : null, /*#__PURE__*/React.createElement("div", {
    className: "box res-box"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83D\uDCB0 Ressources"), /*#__PURE__*/React.createElement("div", {
    className: "res-group"
  }, ["wood", "clay", "iron"].map(r => {
    const bonus = villageResourceBonus(s, r);
    const warn = v.resources[r] >= cap - 1;
    return /*#__PURE__*/React.createElement("div", {
      className: "res" + (warn ? " warn" : "") + (bonus ? " bonus" : ""),
      key: r,
      title: bonus ? `Gisement riche : +${Math.round(bonus.pct * 100)}% de production de ${RES_NAME[r].toLowerCase()} dans ce village.` : undefined
    }, /*#__PURE__*/React.createElement("div", {
      className: "val"
    }, RES_ICON[r], " ", fmt(v.resources[r]), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-dim)",
        fontWeight: "normal"
      }
    }, "/", fmt(cap))), /*#__PURE__*/React.createElement("div", {
      className: "rate"
    }, "+", fmt(resProdRate(s, r)), "/h", bonus ? " ⭐" : ""));
  }), /*#__PURE__*/React.createElement("div", {
    className: "res"
  }, /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, "\uD83D\uDC65 ", pop, "/", popMax), /*#__PURE__*/React.createElement("div", {
    className: "rate"
  }, "population")))), /*#__PURE__*/React.createElement("div", {
    className: "box res-box"
  }, /*#__PURE__*/React.createElement("h3", null, "\u2694\uFE0F Troupes"), presentTroops.length ? /*#__PURE__*/React.createElement("div", {
    className: "res-group"
  }, presentTroops.map(k => /*#__PURE__*/React.createElement("div", {
    className: "res",
    key: k
  }, /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, fmt(v.troops[k])), /*#__PURE__*/React.createElement("div", {
    className: "rate"
  }, TROOPS[k].name)))) : /*#__PURE__*/React.createElement("p", {
    className: "muted small",
    style: {
      margin: 0
    }
  }, "Aucune troupe stationn\xE9e dans ce village.")), /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83C\uDFD7\uFE0F File de construction"), v.buildQueue.length ? v.buildQueue.map((item, i) => {
    const timeLeft = Math.max(0, item.startAt + item.duration - now);
    const pct = 100 * (1 - timeLeft / item.duration);
    return /*#__PURE__*/React.createElement("div", {
      className: "queue-item",
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex-between"
    }, /*#__PURE__*/React.createElement("span", null, BUILDINGS[item.key].name, " \u2192 niv. ", item.level), /*#__PURE__*/React.createElement("span", null, fmtTime(timeLeft), " ", /*#__PURE__*/React.createElement("a", {
      href: "#",
      title: "Annuler (rembours\xE9)",
      style: {
        marginLeft: 6
      },
      onClick: e => {
        e.preventDefault();
        cancelBuild(i);
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
  }, "File vide.")), /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\u2694\uFE0F File d'entra\xEEnement"), v.trainQueue.length ? v.trainQueue.map((o, i) => {
    const timeLeft = Math.max(0, o.unitStartAt + o.unitDuration - now);
    const pct = 100 * (1 - timeLeft / o.unitDuration);
    return /*#__PURE__*/React.createElement("div", {
      className: "queue-item",
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex-between"
    }, /*#__PURE__*/React.createElement("span", null, TROOPS[o.troop].name, " \xD7", o.count), /*#__PURE__*/React.createElement("span", null, fmtTime(timeLeft), " / unit\xE9 ", /*#__PURE__*/React.createElement("a", {
      href: "#",
      title: "Annuler (rembours\xE9)",
      style: {
        marginLeft: 6
      },
      onClick: e => {
        e.preventDefault();
        cancelTrain(i);
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
  }, "File vide.")), /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83D\uDEA9 Missions en cours"), activeMissions.length ? activeMissions.map(m => {
    const target = s.villages.find(vv => vv.id === m.targetId);
    const source = s.villages.find(vv => vv.id === m.sourceVillageId);
    const label = MISSION_LABEL[m.kind] || m.kind;
    let phase, remain, destName;
    if (m.cancelled) {
      phase = "annulée, retour vers";
      remain = m.returnAt - now;
      destName = source ? source.name : "?";
    } else if (m.kind === "supportReturn") {
      phase = "revient vers";
      remain = m.returnAt - now;
      destName = target ? target.name : "?";
    } else if (!m.resolveDone) {
      phase = "en route vers";
      remain = m.arriveAt - now;
      destName = target ? target.name : "?";
    } else {
      phase = "retour de";
      remain = m.returnAt - now;
      destName = target ? target.name : "?";
    }
    const canCancel = (m.kind === "attack" || m.kind === "scout") && !m.resolveDone;
    return /*#__PURE__*/React.createElement("div", {
      className: "mission-item",
      key: m.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex-between"
    }, /*#__PURE__*/React.createElement("span", null, label, " ", phase, " ", destName), /*#__PURE__*/React.createElement("span", null, fmtTime(remain), canCancel ? /*#__PURE__*/React.createElement("a", {
      href: "#",
      title: "Annuler : les troupes font demi-tour imm\xE9diatement.",
      style: {
        marginLeft: 6
      },
      onClick: e => {
        e.preventDefault();
        cancelMission(m.id);
      }
    }, "\u2716") : null)));
  }) : /*#__PURE__*/React.createElement("div", {
    className: "muted small"
  }, "Aucune troupe en mission.")), incomingRaids.length ? /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      borderColor: "#8a3226"
    }
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83D\uDEA8 Attaques entrantes"), incomingRaids.map(m => /*#__PURE__*/React.createElement("div", {
    className: "mission-item",
    key: m.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-between"
  }, /*#__PURE__*/React.createElement("span", null, m.raidSourceName || "Village barbare", " approche"), /*#__PURE__*/React.createElement("span", null, fmtTime(m.arriveAt - now)))))) : null, incomingPlayerAttacks.length ? /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      borderColor: "#8a3226"
    }
  }, /*#__PURE__*/React.createElement("h3", null, "\u2694\uFE0F Attaques ennemies entrantes"), incomingPlayerAttacks.map((m, i) => {
    const label = m.kind === "scout" ? "🔭 Reconnaissance" : "⚔️ Attaque";
    return /*#__PURE__*/React.createElement("div", {
      className: "mission-item",
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex-between"
    }, /*#__PURE__*/React.createElement("span", null, label, " de ", /*#__PURE__*/React.createElement("b", null, m.attackerUsername), " vers ", m.targetName || "?"), /*#__PURE__*/React.createElement("span", null, fmtTime(m.arriveAt - now))), /*#__PURE__*/React.createElement("div", {
      className: "small muted"
    }, "Depuis ", m.sourceName || "?", " (", m.sourceCoord || "?", ")"));
  })) : null, incomingSupport.length ? /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83E\uDD1D Renforts re\xE7us"), incomingSupport.map((sp, i) => /*#__PURE__*/React.createElement("div", {
    className: "mission-item",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-between"
  }, /*#__PURE__*/React.createElement("span", null, "De ", sp.from), /*#__PURE__*/React.createElement("span", {
    className: "small muted"
  }, fmtTroops(sp.troops)))))) : null, mySupport.length ? /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83E\uDD1D Vos renforts envoy\xE9s"), mySupport.map(sp => /*#__PURE__*/React.createElement("div", {
    className: "mission-item",
    key: sp.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-between"
  }, /*#__PURE__*/React.createElement("span", null, "Chez ", sp.atVillageName, " (", sp.atCoord, ")"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      recallSupport(sp.id);
    }
  }, "\u21A9\uFE0F Rappeler")), /*#__PURE__*/React.createElement("div", {
    className: "small muted"
  }, fmtTroops(sp.troops))))) : null);
}