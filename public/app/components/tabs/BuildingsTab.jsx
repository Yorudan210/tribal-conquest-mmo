import { useState } from "react";
import { useGame } from "../../GameContext.jsx";
import { BUILDINGS, BUILD_ORDER, buildCost } from "../../gameData.js";
import { fmt, fmtTime, canAffordAll, vBuildTime, estimateNow } from "../../formulas.js";
import { buildingIconSvg, buildingBadgeSvg } from "../../legacy/art.js";
import { renderVillageSceneMarkup } from "../../legacy/villageScene.js";

// Porte renderBuildings()/renderBuildingsList()/renderBuildMenuCard() : la scène SVG du village
// (générative, voir legacy/villageScene.js) est injectée telle quelle et ses clics captés par
// délégation d'évènement sur le conteneur (data-plot="...") — la liste compacte, le panneau de
// détail et les cartes de construction sont, eux, de vrai JSX interactif.
export default function BuildingsTab({
  onGotoTab
}) {
  const {
    snapshot,
    adminSpeed,
    sparkleUntil,
    doAction,
    call
  } = useGame();
  const v = snapshot.village;
  const [selectedBuilding, setSelectedBuilding] = useState("hq");
  function queueBuild(key) {
    const b = BUILDINGS[key];
    const nextLevel = (v.buildings[key] || 0) + 1;
    doAction(() => call("/api/build", "POST", {
      key
    }), "Construction ajoutée : " + b.name + " niveau " + nextLevel, "buildQueued");
  }
  function onSceneClick(e) {
    const el = e.target.closest("[data-plot]");
    if (el) setSelectedBuilding(el.dataset.plot);
  }
  const sel = BUILDINGS[selectedBuilding] ? selectedBuilding : "hq";
  const b = BUILDINGS[sel],
    lvl = v.buildings[sel] || 0,
    atMax = lvl >= b.max;
  const pendingForSel = v.buildQueue.filter(o => o.key === sel).length;
  const nextLevel = lvl + pendingForSel + 1,
    maxed = nextLevel > b.max;
  const cost = maxed ? null : buildCost(sel, nextLevel);
  const time = maxed ? null : vBuildTime(v, sel, nextLevel, adminSpeed);
  const lockedReq = b.requires && Object.entries(b.requires).some(([rk, rv]) => (v.buildings[rk] || 0) < rv);
  const affordable = cost && canAffordAll(snapshot, cost);
  const isEmpty = lvl <= 0;
  const queueFull = v.buildQueue.length >= 6;
  const sceneMarkup = renderVillageSceneMarkup(v, sel, sparkleUntil);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "Votre village"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Cliquez sur un b\xE2timent du village (ou de la liste ci-contre) pour voir ses d\xE9tails et l'am\xE9liorer."), /*#__PURE__*/React.createElement("div", {
    className: "village-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "village-scene",
    onClick: onSceneClick,
    dangerouslySetInnerHTML: {
      __html: sceneMarkup
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "box village-blist"
  }, /*#__PURE__*/React.createElement(BuildingsList, {
    v: v,
    selectedBuilding: sel,
    onSelect: setSelectedBuilding,
    onGotoTab: onGotoTab
  }))), /*#__PURE__*/React.createElement("div", {
    className: "building-detail box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "icon-big",
    dangerouslySetInnerHTML: {
      __html: buildingIconSvg(sel, lvl)
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "info"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: 2
    }
  }, b.name, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-dim)",
      fontSize: 13,
      fontWeight: "normal"
    }
  }, "\u2014 niveau ", lvl, atMax ? " (max)" : "")), /*#__PURE__*/React.createElement("div", {
    className: "desc",
    style: {
      marginBottom: 8
    }
  }, b.desc), maxed ? /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, atMax ? "Niveau maximum atteint." : "Toutes les améliorations jusqu'au niveau maximum sont déjà en file.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "cost",
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: v.resources.wood < cost.wood ? "short" : ""
  }, "\uD83E\uDEB5 ", fmt(cost.wood)), /*#__PURE__*/React.createElement("span", {
    className: v.resources.clay < cost.clay ? "short" : ""
  }, "\uD83E\uDDF1 ", fmt(cost.clay)), /*#__PURE__*/React.createElement("span", {
    className: v.resources.iron < cost.iron ? "short" : ""
  }, "\u26CF\uFE0F ", fmt(cost.iron)), /*#__PURE__*/React.createElement("span", null, "\u23F1 ", fmtTime(time))), pendingForSel ? /*#__PURE__*/React.createElement("div", {
    className: "unit-note"
  }, pendingForSel, " d\xE9j\xE0 en file d'attente") : null, lockedReq ? /*#__PURE__*/React.createElement("div", {
    className: "req-note"
  }, "N\xE9cessite : ", Object.entries(b.requires).map(([rk, rv]) => BUILDINGS[rk].name + " niv. " + rv).join(", ")) : null, queueFull ? /*#__PURE__*/React.createElement("div", {
    className: "req-note"
  }, "File de construction pleine (max 6).") : null, /*#__PURE__*/React.createElement("button", {
    className: "primary",
    disabled: !affordable || lockedReq || queueFull,
    onClick: () => queueBuild(sel)
  }, isEmpty ? "Construire" : "Améliorer", " \u2192 niveau ", nextLevel)))), sel === "hq" ? /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83C\uDFD7\uFE0F Construire un b\xE2timent"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Depuis l'H\xF4tel de ville, lancez la construction ou l'am\xE9lioration de n'importe quel b\xE2timent sans avoir \xE0 cliquer dessus sur la carte."), /*#__PURE__*/React.createElement("div", {
    className: "grid-buildings"
  }, BUILD_ORDER.filter(k => k !== "hq").map(k => /*#__PURE__*/React.createElement(BuildMenuCard, {
    key: k,
    k: k,
    v: v,
    snapshot: snapshot,
    adminSpeed: adminSpeed,
    onBuild: queueBuild
  })))) : null);
}
function BuildingsList({
  v,
  selectedBuilding,
  onSelect,
  onGotoTab
}) {
  const {
    serverTimeOffset
  } = useGame();
  const now = estimateNow(serverTimeOffset);
  const keys = [...BUILD_ORDER, "guildHall"];
  return /*#__PURE__*/React.createElement(React.Fragment, null, keys.map(key => {
    const b = BUILDINGS[key],
      lvl = v.buildings[key] || 0;
    const lockedReq = b.requires && Object.entries(b.requires).some(([rk, rv]) => (v.buildings[rk] || 0) < rv);
    const isEmpty = lvl <= 0;
    const frontQueued = v.buildQueue.length && v.buildQueue[0].key === key;
    const isGuildHall = key === "guildHall";
    const selected = !isGuildHall && selectedBuilding === key;
    let levelNode, upDisabled;
    if (frontQueued) {
      const remain = Math.max(0, v.buildQueue[0].startAt + v.buildQueue[0].duration - now);
      levelNode = /*#__PURE__*/React.createElement("span", {
        className: "blevel muted"
      }, "\uD83D\uDD28 ", fmtTime(remain));
      upDisabled = true;
    } else if (lockedReq) {
      levelNode = /*#__PURE__*/React.createElement("span", {
        className: "blevel muted"
      }, "Verrouill\xE9");
      upDisabled = true;
    } else if (isEmpty) {
      levelNode = /*#__PURE__*/React.createElement("span", {
        className: "blevel muted"
      }, "Non construit");
      upDisabled = false;
    } else {
      levelNode = /*#__PURE__*/React.createElement("span", {
        className: "blevel"
      }, "Niv. ", lvl, lvl >= b.max ? " (max)" : "");
      upDisabled = false;
    }
    return /*#__PURE__*/React.createElement("div", {
      className: "blist-row" + (selected ? " selected" : ""),
      key: key,
      title: b.name + (isGuildHall ? " — géré depuis l'onglet Guilde" : ""),
      onClick: () => isGuildHall ? onGotoTab && onGotoTab("guild") : onSelect(key)
    }, /*#__PURE__*/React.createElement("span", {
      dangerouslySetInnerHTML: {
        __html: buildingBadgeSvg(key)
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "bname" + (lockedReq && !frontQueued ? " locked" : "")
    }, b.name), levelNode, /*#__PURE__*/React.createElement("span", {
      className: "bup" + (upDisabled ? " disabled" : "")
    }, "\u25B2"));
  }));
}
function BuildMenuCard({
  k,
  v,
  snapshot,
  adminSpeed,
  onBuild
}) {
  const b = BUILDINGS[k],
    lvl = v.buildings[k] || 0,
    atMax = lvl >= b.max;
  const queuedCount = v.buildQueue.filter(q => q.key === k).length;
  const nextLevel = lvl + queuedCount + 1,
    maxed = nextLevel > b.max;
  const cost = maxed ? null : buildCost(k, nextLevel);
  const time = maxed ? null : vBuildTime(v, k, nextLevel, adminSpeed);
  const lockedReq = b.requires && Object.entries(b.requires).some(([rk, rv]) => (v.buildings[rk] || 0) < rv);
  const affordable = cost && canAffordAll(snapshot, cost);
  const isEmpty = lvl <= 0;
  const queueFull = v.buildQueue.length >= 6;
  return /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "icon-mini",
    dangerouslySetInnerHTML: {
      __html: buildingIconSvg(k, lvl)
    }
  }), /*#__PURE__*/React.createElement("h4", null, b.name, /*#__PURE__*/React.createElement("span", {
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
    onClick: () => onBuild(k)
  }, isEmpty ? "Construire" : "Améliorer", " \u2192 niveau ", nextLevel)));
}