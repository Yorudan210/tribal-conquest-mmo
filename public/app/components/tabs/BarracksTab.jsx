import { useRef } from "react";
import { useGame } from "../../GameContext.jsx";
import { BUILDINGS, TROOPS, TROOP_ORDER, INFANTRY, CAVALRY, ARCHERS, clamp, farmCap } from "../../gameData.js";
import { fmt, fmtTime, vTrainTime, nobleCount, NOBLE_CAP_PER_VILLAGE, popUsed } from "../../formulas.js";
import { troopBadgeSvg } from "../../legacy/art.js";

// Porte renderBarracks() : entraînement/licenciement de troupes. Les compteurs (nombre à
// entraîner/licencier) restent des <input> non contrôlés (comme dans l'ancien index.html, lu via
// getElementById au clic) — ici via une ref par ligne, ce qui évite un état React par troupe pour
// une simple valeur jetable relue une fois au clic.
export default function BarracksTab() {
  const {
    snapshot,
    username,
    adminSpeed,
    doAction,
    call
  } = useGame();
  const v = snapshot.village;
  if ((v.buildings.barracks || 0) < 1) {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "Caserne"), /*#__PURE__*/React.createElement("p", {
      className: "muted"
    }, "Construisez d'abord une ", /*#__PURE__*/React.createElement("b", null, "Caserne"), " (onglet B\xE2timents) pour pouvoir entra\xEEner des troupes."));
  }
  function queueTrain(key, count) {
    count = Math.floor(count);
    if (!count || count <= 0) return;
    const t = TROOPS[key];
    doAction(() => call("/api/train", "POST", {
      key,
      count
    }), count + " " + t.name + "(s) mis en formation.", "trainQueued");
  }
  function disbandTroops(key, count) {
    count = Math.floor(count);
    if (!count || count <= 0) return;
    const t = TROOPS[key];
    const have = v.troops[key] || 0;
    if (count > have) {
      return;
    } // le bouton est de toute façon borné par max=have
    if (!confirm("Licencier " + count + " " + t.name + "(s) ? Ces troupes seront définitivement détruites, sans remboursement.")) return;
    doAction(() => call("/api/troops/disband", "POST", {
      key,
      count
    }), count + " " + t.name + "(s) licencié(s).", null);
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "Caserne (niv. ", v.buildings.barracks, ")"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "\u2694\uFE0F attaque \xB7 \uD83D\uDEE1\uFE0F d\xE9fense infanterie/cavalerie/archers \xB7 \uD83C\uDF92 capacit\xE9 de pillage \xB7 \uD83D\uDC0E vitesse (plus bas = plus rapide) \xB7 \u23F1 temps d'entra\xEEnement par unit\xE9 \xE0 ce niveau de Caserne (plus la Caserne est haute, plus l'entra\xEEnement est rapide)"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "La puissance d'une attaque se r\xE9partit entre Infanterie/Cavalerie/Archers selon sa composition, et chaque troupe d\xE9fensive r\xE9siste diff\xE9remment \xE0 chacun de ces trois types (barres ci-dessous, 0-100) : ce n'est pas un triangle strict \"qui bat qui\", mais des r\xE9sistances asym\xE9triques \u2014 par exemple l'Archer d\xE9fend tr\xE8s mal face \xE0 d'autres archers (\uD83C\uDFF9 5) mais bien contre l'infanterie et la cavalerie."), /*#__PURE__*/React.createElement("div", {
    className: "troops-list"
  }, TROOP_ORDER.map(k => /*#__PURE__*/React.createElement(TroopRow, {
    key: k,
    k: k,
    v: v,
    snapshot: snapshot,
    username: username,
    adminSpeed: adminSpeed,
    onTrain: queueTrain,
    onDisband: disbandTroops
  }))));
}
function troopTypeChip(k) {
  if (INFANTRY.includes(k)) return /*#__PURE__*/React.createElement("span", {
    className: "type-chip type-inf",
    title: "Type d'attaque : Infanterie"
  }, "\uD83D\uDDE1\uFE0F Infanterie");
  if (CAVALRY.includes(k)) return /*#__PURE__*/React.createElement("span", {
    className: "type-chip type-cav",
    title: "Type d'attaque : Cavalerie"
  }, "\uD83D\uDC0E Cavalerie");
  if (ARCHERS.includes(k)) return /*#__PURE__*/React.createElement("span", {
    className: "type-chip type-arch",
    title: "Type d'attaque : Archers"
  }, "\uD83C\uDFF9 Archers");
  return null;
}
function TriangleBar({
  cls,
  label,
  val
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ttri-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ttri-lbl"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "ttri-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ttri-fill " + cls,
    style: {
      width: clamp(val, 0, 100) + "%"
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "ttri-val"
  }, val));
}
function TroopRow({
  k,
  v,
  snapshot,
  username,
  adminSpeed,
  onTrain,
  onDisband
}) {
  const t = TROOPS[k];
  const trainRef = useRef(null);
  const disbandRef = useRef(null);
  const lockedEntries = Object.entries(t.requires).filter(([rk, rv]) => (v.buildings[rk] || 0) < rv);
  const locked = lockedEntries.length > 0;
  const home = v.troops[k] || 0;

  // Quantité maximale réellement finançable MAINTENANT pour cette troupe : le minimum entre ce que
  // permettent le bois/l'argile/le fer disponibles et la population libre (capacité de la Ferme moins
  // popUsed, même formule que la barre de population de la Sidebar -- voir doTrain, gameLogic.js, côté
  // serveur, qui applique exactement ces mêmes contraintes et refuse tout l'ordre si l'une d'elles est
  // dépassée). Pour le Noble, contrainte supplémentaire : au plus NOBLE_CAP_PER_VILLAGE vivants/en
  // formation à la fois dans ce village.
  const freePop = farmCap(v.buildings.farm) - popUsed(snapshot, username);
  const maxByWood = t.cost.wood > 0 ? Math.floor((v.resources.wood || 0) / t.cost.wood) : Infinity;
  const maxByClay = t.cost.clay > 0 ? Math.floor((v.resources.clay || 0) / t.cost.clay) : Infinity;
  const maxByIron = t.cost.iron > 0 ? Math.floor((v.resources.iron || 0) / t.cost.iron) : Infinity;
  const maxByPop = t.pop > 0 ? Math.floor(Math.max(0, freePop) / t.pop) : Infinity;
  let maxAffordable = Math.min(maxByWood, maxByClay, maxByIron, maxByPop);
  if (k === "noble") maxAffordable = Math.min(maxAffordable, Math.max(0, NOBLE_CAP_PER_VILLAGE - nobleCount(snapshot, username)));
  if (!Number.isFinite(maxAffordable)) maxAffordable = 0;
  maxAffordable = Math.max(0, maxAffordable);
  return /*#__PURE__*/React.createElement("div", {
    className: "troop-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "thead"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ticon",
    dangerouslySetInnerHTML: {
      __html: troopBadgeSvg(k)
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "tname"
  }, t.name), troopTypeChip(k)), /*#__PURE__*/React.createElement("div", {
    className: "stats-mini"
  }, "\u2694\uFE0F", t.atk, " \uD83D\uDEE1\uFE0F", t.defInf, "/", t.defCav, "/", t.defArch, " \uD83C\uDF92", t.carry, " \uD83D\uDC0E", t.speed), /*#__PURE__*/React.createElement("div", {
    className: "ttriangle"
  }, /*#__PURE__*/React.createElement(TriangleBar, {
    cls: "inf",
    label: "\uD83D\uDDE1\uFE0F vs Inf.",
    val: t.defInf
  }), /*#__PURE__*/React.createElement(TriangleBar, {
    cls: "cav",
    label: "\uD83D\uDC0E vs Cav.",
    val: t.defCav
  }), /*#__PURE__*/React.createElement(TriangleBar, {
    cls: "arch",
    label: "\uD83C\uDFF9 vs Arc.",
    val: t.defArch
  })), /*#__PURE__*/React.createElement("div", {
    className: "small"
  }, "Stock : ", home), /*#__PURE__*/React.createElement("div", {
    className: "cost small"
  }, "\uD83E\uDEB5", fmt(t.cost.wood), " \uD83E\uDDF1", fmt(t.cost.clay), " \u26CF\uFE0F", fmt(t.cost.iron), " \uD83D\uDC65", t.pop, " \u23F1 ", fmtTime(vTrainTime(v, k, adminSpeed))), locked ? /*#__PURE__*/React.createElement("span", {
    className: "req-note"
  }, "N\xE9cessite : ", lockedEntries.map(([rk, rv]) => (BUILDINGS[rk] ? BUILDINGS[rk].name : rk) + " niv. " + rv).join(", ")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "train-row-inputs",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    max: maxAffordable,
    defaultValue: "0",
    ref: trainRef
  }), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "small",
    style: {
      fontSize: 10
    },
    title: "Remplir avec le nombre finan\xE7able maintenant (bois/argile/fer + population libre)",
    onClick: e => {
      e.preventDefault();
      trainRef.current.value = maxAffordable;
    }
  }, "max ", fmt(maxAffordable)), /*#__PURE__*/React.createElement("button", {
    onClick: () => onTrain(k, Number(trainRef.current.value)),
    disabled: maxAffordable <= 0,
    title: maxAffordable <= 0 ? "Ressources ou population insuffisantes pour entraîner cette troupe" : undefined
  }, "Entra\xEEner")), t.note ? /*#__PURE__*/React.createElement("div", {
    className: "unit-note"
  }, t.note) : null, k === "noble" ? /*#__PURE__*/React.createElement("div", {
    className: "unit-note"
  }, "Nobles vivants : ", nobleCount(snapshot, username), " / ", NOBLE_CAP_PER_VILLAGE, " dans ce village (1 seul noble peut partir par attaque)") : null), home > 0 ? /*#__PURE__*/React.createElement("div", {
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
    onClick: () => onDisband(k, Number(disbandRef.current.value))
  }, "\uD83D\uDDD1\uFE0F Licencier")) : null);
}