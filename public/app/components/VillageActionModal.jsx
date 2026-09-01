import { useRef, useMemo } from "react";
import { useGame } from "../GameContext.jsx";
import { TROOP_ORDER, TROOPS, VILLAGE_TAGS, PERMANENT_FACTIONS } from "../gameData.js";
import { fmt, fmtTime, estimateNow, RES_ICON, RES_NAME } from "../formulas.js";
import { villageTagBadgeSvg, legendaryCampSceneSvg } from "../legacy/art.js";
import { guildRelationFor, TIER_CLASS, TIER_LABEL, FACTION_PIN } from "../legacy/mapRender.js";

// Porte renderVillageActionModal()/wireVillageActionModal()/sendMission()/sendGift()/
// villageTagPickerHtml() : la fenêtre de mission ouverte en cliquant un village sur la carte (ou,
// plus tard, depuis l'onglet Empire). Rendue au niveau de GameScreen (comme dans l'ancien
// index.html, où #villageActionModal est un <div> de haut niveau, frère de #tabContent) pour rester
// ouverte même si on change d'onglet -- voir GameContext (selectedVillage/openVillageAction/
// closeVillageAction).
export default function VillageActionModal({
  onGotoTab
}) {
  const {
    snapshot,
    username,
    scoutIntel,
    selectedVillage,
    closeVillageAction,
    doAction,
    call,
    applySnapshot
  } = useGame();
  if (selectedVillage == null) return null;
  const v = snapshot.village;
  function setTag(villageId, tag) {
    call("/api/map/tag", "POST", {
      villageId,
      tag
    }).then(data => applySnapshot(data.snapshot)).catch(() => {});
  }
  function switchVillage(villageId, goToBuildings) {
    doAction(() => call("/api/village/switch", "POST", {
      villageId
    }), "🏰 Village actif changé.", null).then(() => {
      if (goToBuildings && onGotoTab) onGotoTab("buildings");
    }).catch(() => {});
  }
  function sendMission(villageId, kind) {
    const troops = {};
    let any = false;
    for (const k of TROOP_ORDER) {
      const el = document.getElementById("send_" + villageId + "_" + k);
      if (!el) continue;
      let n = Math.floor(Number(el.value) || 0);
      n = Math.max(0, Math.min(n, v.troops[k] || 0));
      if (k === "noble") n = Math.min(n, 1);
      if (n > 0) {
        troops[k] = n;
        any = true;
      }
    }
    if (!any) return;
    if (kind === "scout" && !troops.scout) return;
    const target = snapshot.villages.find(t => t.id === villageId);
    if (kind === "support") {
      doAction(() => call("/api/support/send", "POST", {
        targetId: villageId,
        troops
      }), "🤝 Renfort envoyé" + (target ? " vers " + target.name + " (" + target.x + "|" + target.y + ")" : "") + ".", "depart");
    } else {
      doAction(() => call("/api/mission", "POST", {
        targetId: villageId,
        kind,
        troops
      }), (kind === "attack" ? "⚔️ Attaque" : "🔭 Reconnaissance") + " envoyée" + (target ? " vers " + target.name + " (" + target.x + "|" + target.y + ")" : "") + ".", "depart");
    }
    closeVillageAction();
  }
  function sendGift(villageId) {
    const target = snapshot.villages.find(t => t.id === villageId);
    if (!target || !target.isPlayer) return;
    const amt = {};
    let any = false;
    for (const r of ["wood", "clay", "iron"]) {
      const el = document.getElementById("gift_" + villageId + "_" + r);
      if (!el) continue;
      let n = Math.floor(Number(el.value) || 0);
      n = Math.max(0, Math.min(n, Math.floor(v.resources[r] || 0)));
      if (n > 0) {
        amt[r] = n;
        any = true;
      }
    }
    if (!any) return;
    doAction(() => call("/api/gift", "POST", {
      username: target.owner,
      wood: amt.wood || 0,
      clay: amt.clay || 0,
      iron: amt.iron || 0
    }), "🎁 Don envoyé à " + target.owner + ".", null);
    closeVillageAction();
  }
  function onBackdropClick(e) {
    if (e.target.id === "villageActionBackdrop") closeVillageAction();
  }

  // ---- Cas 1 : notre propre village (actif ou non) ----
  if (selectedVillage === "home") {
    return /*#__PURE__*/React.createElement("div", {
      className: "tutorial-backdrop",
      id: "villageActionBackdrop",
      onClick: onBackdropClick
    }, /*#__PURE__*/React.createElement("div", {
      className: "tutorial-card village-action-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex-between",
      style: {
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: 0
      }
    }, "\uD83C\uDFF0 ", v.name), /*#__PURE__*/React.createElement("button", {
      title: "Fermer",
      style: {
        padding: "4px 8px"
      },
      onClick: closeVillageAction
    }, "\u2716")), /*#__PURE__*/React.createElement("p", {
      className: "muted small"
    }, "Votre village (", v.x, "|", v.y, "). Impossible de s'attaquer soi-m\xEAme."), v.resourceBonus ? /*#__PURE__*/React.createElement("p", {
      className: "small",
      style: {
        color: "var(--gold)",
        background: "rgba(193,121,62,.16)",
        border: "1px solid rgba(193,121,62,.5)",
        borderRadius: 8,
        padding: "6px 10px"
      }
    }, RES_ICON[v.resourceBonus.res], " Gisement riche : +", Math.round(v.resourceBonus.pct * 100), "% de production de ", RES_NAME[v.resourceBonus.res].toLowerCase(), " dans ce village pr\xE9cis.") : null, /*#__PURE__*/React.createElement(TagPicker, {
      villageId: v.id,
      snapshot: snapshot,
      onSetTag: setTag
    })));
  }
  const t = snapshot.villages.find(x => x.id === selectedVillage);
  if (!t) return null;
  const dx = t.x - v.x,
    dy = t.y - v.y,
    dist = Math.sqrt(dx * dx + dy * dy);

  // ---- Cas 2 : un de nos AUTRES villages (conquis) ----
  if (t.owner === username) {
    const isActive = t.id === v.id;
    return /*#__PURE__*/React.createElement("div", {
      className: "tutorial-backdrop",
      id: "villageActionBackdrop",
      onClick: onBackdropClick
    }, /*#__PURE__*/React.createElement("div", {
      className: "tutorial-card village-action-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex-between",
      style: {
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: 0
      }
    }, "\uD83D\uDEA9 ", t.name), /*#__PURE__*/React.createElement("button", {
      title: "Fermer",
      style: {
        padding: "4px 8px"
      },
      onClick: closeVillageAction
    }, "\u2716")), /*#__PURE__*/React.createElement("div", {
      className: "small muted",
      style: {
        margin: "2px 0 10px"
      }
    }, t.x, "|", t.y, " \xB7 \xE0 ", dist.toFixed(1), " champs ", /*#__PURE__*/React.createElement("span", {
      className: "tag weak"
    }, "Conquis")), /*#__PURE__*/React.createElement("p", {
      className: "muted small"
    }, "Ce village vous appartient : vous pouvez l'am\xE9liorer et y entra\xEEner des troupes comme votre premier village (ressources et troupes qui lui sont propres)."), t.resourceBonus ? /*#__PURE__*/React.createElement("p", {
      className: "small",
      style: {
        color: "var(--gold)",
        background: "rgba(193,121,62,.16)",
        border: "1px solid rgba(193,121,62,.5)",
        borderRadius: 8,
        padding: "6px 10px"
      }
    }, RES_ICON[t.resourceBonus.res], " Gisement riche : +", Math.round(t.resourceBonus.pct * 100), "% de production de ", RES_NAME[t.resourceBonus.res].toLowerCase(), " dans ce village pr\xE9cis.") : null, isActive ? /*#__PURE__*/React.createElement("p", {
      className: "sub small"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tag strong"
    }, "Village actif"), " \u2014 c'est celui que vous g\xE9rez actuellement (onglets B\xE2timents/Caserne).") : /*#__PURE__*/React.createElement("button", {
      className: "primary",
      onClick: () => switchVillage(t.id, true)
    }, "\uD83C\uDFD7\uFE0F G\xE9rer ce village"), /*#__PURE__*/React.createElement(TagPicker, {
      villageId: t.id,
      snapshot: snapshot,
      onSetTag: setTag
    })));
  }

  // ---- Cas 3 : village barbare ou d'un autre joueur ----
  const intel = scoutIntel[t.id];
  const rel = t.isPlayer ? guildRelationFor(snapshot, t.guildId) : null;
  const factionInfo = !t.isPlayer && t.faction ? FACTION_PIN[t.faction] : null;
  const raidersCfg = t.faction === "raiders" ? (PERMANENT_FACTIONS || {}).raiders : null;
  const legendaryCfg = t.faction === "legendary" ? (PERMANENT_FACTIONS || {}).legendary : null;
  // Illustration isométrique de la citadelle légendaire (Phase 2) -- mémoïsée sur l'id du village
  // ciblé pour ne pas régénérer ce gros bloc de markup SVG à chaque rafraîchissement du polling.
  const legendarySceneSvg = useMemo(() => legendaryCfg ? legendaryCampSceneSvg() : null, [legendaryCfg, t.id]);
  return /*#__PURE__*/React.createElement("div", {
    className: "tutorial-backdrop",
    id: "villageActionBackdrop",
    onClick: onBackdropClick
  }, /*#__PURE__*/React.createElement("div", {
    className: "tutorial-card village-action-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-between",
    style: {
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, t.name), /*#__PURE__*/React.createElement("button", {
    title: "Fermer",
    style: {
      padding: "4px 8px"
    },
    onClick: closeVillageAction
  }, "\u2716")), legendarySceneSvg ? /*#__PURE__*/React.createElement("div", {
    className: "legendary-camp-scene",
    dangerouslySetInnerHTML: {
      __html: legendarySceneSvg
    }
  }) : null, /*#__PURE__*/React.createElement("div", {
    className: "flex-between",
    style: {
      margin: "2px 0 8px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "muted small"
  }, t.x, "|", t.y, " \xB7 \xE0 ", dist.toFixed(1), " champs"), t.isPlayer ? /*#__PURE__*/React.createElement("span", {
    className: "tag " + (rel ? rel.cls : "medium")
  }, "Joueur : ", t.owner, rel ? " · " + rel.label : "") : /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag " + TIER_CLASS[t.tier]
  }, TIER_LABEL[t.tier]), factionInfo ? /*#__PURE__*/React.createElement("span", {
    className: "tag " + factionInfo.cls
  }, factionInfo.icon, " ", factionInfo.label) : null)), /*#__PURE__*/React.createElement("div", {
    className: "sub small",
    style: {
      marginBottom: 8
    }
  }, intel ? `Vue lors d'une reconnaissance il y a ${fmtTime(Math.max(0, estimateNow() - intel.time))} : lanciers ${intel.troops.spear || 0} · épéistes ${intel.troops.sword || 0} · archers ${intel.troops.archer || 0}${intel.loyalty != null ? " · Loyauté " + Math.round(intel.loyalty) + "%" : ""} — 🪵${fmt(intel.resources.wood)} 🧱${fmt(intel.resources.clay)} ⛏️${fmt(intel.resources.iron)}` : "Troupes et ressources inconnues — envoyez une reconnaissance pour les révéler.", t.wallLevel > 0 ? " · Muraille niv." + t.wallLevel : ""), t.resourceBonus ? /*#__PURE__*/React.createElement("p", {
    className: "small",
    style: {
      color: "var(--gold)",
      background: "rgba(193,121,62,.16)",
      border: "1px solid rgba(193,121,62,.5)",
      borderRadius: 8,
      padding: "6px 10px",
      margin: "0 0 8px"
    }
  }, RES_ICON[t.resourceBonus.res], " Gisement riche : ce village produit +", Math.round(t.resourceBonus.pct * 100), "% de ", RES_NAME[t.resourceBonus.res].toLowerCase(), t.isPlayer ? "" : " une fois conquis", " \u2014 le bonus reste propre \xE0 ce village.") : null, raidersCfg && raidersCfg.boostOnVictory ? /*#__PURE__*/React.createElement("p", {
    className: "small",
    style: {
      color: "#f0b060",
      background: "rgba(224,138,48,.14)",
      border: "1px solid rgba(224,138,48,.45)",
      borderRadius: 8,
      padding: "6px 10px",
      margin: "0 0 8px"
    }
  }, raidersCfg.boostOnVictory.icon, " Victoire = ", raidersCfg.boostOnVictory.name, " : +", Math.round((raidersCfg.boostOnVictory.multiplier - 1) * 100), "% de production pendant ", Math.round(raidersCfg.boostOnVictory.durationSec / 3600), "h sur le village attaquant.") : null, legendaryCfg ? /*#__PURE__*/React.createElement("p", {
    className: "small",
    style: {
      color: "#f2c94c",
      background: "rgba(242,201,76,.12)",
      border: "1px solid rgba(242,201,76,.45)",
      borderRadius: 8,
      padding: "6px 10px",
      margin: "0 0 8px"
    }
  }, "\uD83D\uDC51 Campement l\xE9gendaire : bien trop fort pour \xEAtre vaincu par un seul village, et ses d\xE9fenses ne se r\xE9g\xE9n\xE8rent jamais -- chaque assaut, gagn\xE9 ou perdu, l'affaiblit durablement. Sa chute r\xE9compense tous les joueurs qui y auront pris part (succ\xE8s Chasseur de l\xE9gende).", t.contributorCount > 0 ? ` Déjà entamé par ${t.contributorCount} joueur${t.contributorCount > 1 ? "s" : ""} différent${t.contributorCount > 1 ? "s" : ""}.` : "") : null, t.isPlayer ? /*#__PURE__*/React.createElement("p", {
    className: "small muted",
    style: {
      background: "rgba(0,0,0,.12)",
      border: "1px solid var(--border-soft)",
      borderRadius: 8,
      padding: "6px 10px",
      margin: "8px 0"
    }
  }, "\uD83D\uDD4A\uFE0F Ce monde est int\xE9gralement JcE : les attaques entre joueurs sont d\xE9sactiv\xE9es. Vous pouvez tout de m\xEAme reconna\xEEtre ce village ou lui envoyer un soutien.") : null, /*#__PURE__*/React.createElement("div", {
    className: "send-form open"
  }, /*#__PURE__*/React.createElement("div", {
    className: "inputs"
  }, TROOP_ORDER.map(k => {
    const avail = v.troops[k] || 0;
    const maxSend = k === "noble" ? Math.min(avail, 1) : avail;
    return /*#__PURE__*/React.createElement("div", {
      className: "inp",
      key: k
    }, /*#__PURE__*/React.createElement("span", null, TROOPS[k].name), /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "0",
      max: maxSend,
      defaultValue: "0",
      id: "send_" + t.id + "_" + k
    }), /*#__PURE__*/React.createElement("a", {
      href: "#",
      style: {
        fontSize: 10
      },
      onClick: e => {
        e.preventDefault();
        document.getElementById("send_" + t.id + "_" + k).value = maxSend;
      }
    }, "max ", maxSend));
  })), t.isPlayer ? null : /*#__PURE__*/React.createElement("button", {
    className: "primary",
    onClick: () => sendMission(t.id, "attack")
  }, "\u2694\uFE0F Attaquer"), /*#__PURE__*/React.createElement("button", {
    onClick: () => sendMission(t.id, "scout")
  }, "\uD83D\uDD2D Reconna\xEEtre"), t.isPlayer ? /*#__PURE__*/React.createElement("button", {
    onClick: () => sendMission(t.id, "support")
  }, "\uD83E\uDD1D Envoyer en soutien") : null), t.isPlayer ? /*#__PURE__*/React.createElement("div", {
    className: "send-form open",
    style: {
      marginTop: 14,
      paddingTop: 10,
      borderTop: "1px dashed var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 6
    }
  }, "\uD83C\uDF81 Donner des ressources (imm\xE9diat, sans marchand)"), /*#__PURE__*/React.createElement("div", {
    className: "inputs",
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    }
  }, ["wood", "clay", "iron"].map(r => /*#__PURE__*/React.createElement("div", {
    className: "inp",
    key: r
  }, RES_ICON[r], /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    max: Math.floor(v.resources[r]),
    defaultValue: "0",
    id: "gift_" + t.id + "_" + r
  })))), /*#__PURE__*/React.createElement("button", {
    onClick: () => sendGift(t.id)
  }, "\uD83C\uDF81 Envoyer le don")) : null, /*#__PURE__*/React.createElement(TagPicker, {
    villageId: t.id,
    snapshot: snapshot,
    onSetTag: setTag
  })));
}
function TagPicker({
  villageId,
  snapshot,
  onSetTag
}) {
  const current = (snapshot.villageTags || {})[villageId] || "";
  return /*#__PURE__*/React.createElement("div", {
    className: "village-tag-picker"
  }, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 6
    }
  }, "\uD83C\uDFF3\uFE0F Marqueur personnel (visible seulement par vous) :"), /*#__PURE__*/React.createElement("div", {
    className: "tag-chip-row"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "tag-chip tag-chip-clear" + (current ? "" : " active"),
    title: "Aucun marqueur",
    onClick: () => onSetTag(villageId, "")
  }, "\u2715"), VILLAGE_TAGS.map(tg => /*#__PURE__*/React.createElement("button", {
    type: "button",
    key: tg.key,
    className: "tag-chip" + (current === tg.key ? " active" : ""),
    title: tg.label,
    onClick: () => onSetTag(villageId, tg.key),
    dangerouslySetInnerHTML: {
      __html: villageTagBadgeSvg(tg.key)
    }
  }))));
}