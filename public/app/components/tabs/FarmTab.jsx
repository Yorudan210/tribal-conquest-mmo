import { useMemo, useState } from "react";
import { useGame } from "../../GameContext.jsx";
import { useToast } from "../../ToastContext.jsx";
import { TROOP_ORDER, TROOPS } from "../../gameData.js";
import { villageTagBadgeSvg } from "../../legacy/art.js";
import Audio from "../../legacy/audio.js";

// Indexés par t.tier (0-4), pas par nom — voir la même définition dans l'ancien index.html.
const TIER_CLASS = ["weak", "weak", "medium", "strong", "strong"];
const TIER_LABEL = ["Très faible", "Faible", "Moyen", "Fort", "Très fort"];
function formatDurationShort(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600),
    m = Math.floor(sec % 3600 / 60),
    s = sec % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (m > 0) return `${m}min${String(s).padStart(2, "0")}`;
  return `${s}s`;
}
function emptyComposition() {
  const c = {};
  for (const k of TROOP_ORDER) if (k !== "noble") c[k] = 0;
  return c;
}

// Porte fidèlement l'assistant de pillage (renderFarm/attachFarmHandlers de l'ancien index.html,
// déjà corrigé cette session pour le bug de re-cochage automatique — voir farmDeselectedIds) : la
// composition de troupes, le rayon de recherche et la sélection vivent maintenant en state React,
// qui persiste naturellement entre deux rendus déclenchés par le WebSocket/sondage — exactement le
// bug qu'on avait dû corriger à la main côté ancien DOM disparaît de lui-même avec un vrai state.
export default function FarmTab() {
  const {
    snapshot,
    applySnapshot,
    call
  } = useGame();
  const toast = useToast();
  const v = snapshot.village;
  const [composition, setComposition] = useState(emptyComposition);
  const [radius, setRadius] = useState(15);
  const [deselectedIds, setDeselectedIds] = useState(() => new Set());
  const [sending, setSending] = useState(false);
  const targets = useMemo(() => {
    const busyTargets = new Set((snapshot.missions || []).filter(m => m.kind === "attack" && !m.resolveDone && m.sourceVillageId === v.id).map(m => m.targetId));
    return (snapshot.villages || []).filter(t => t.owner === "barbarian").map(t => {
      const dx = t.x - v.x,
        dy = t.y - v.y;
      return {
        ...t,
        dist: Math.sqrt(dx * dx + dy * dy),
        busy: busyTargets.has(t.id)
      };
    }).filter(t => t.dist <= radius).sort((a, b) => a.dist - b.dist);
  }, [snapshot.missions, snapshot.villages, v.id, v.x, v.y, radius]);
  const available = targets.filter(t => !t.busy);
  const selectedIds = available.filter(t => !deselectedIds.has(t.id)).map(t => t.id);
  const compKeys = Object.keys(composition).filter(k => composition[k] > 0);
  let maxByTroops = compKeys.length ? Infinity : 0;
  for (const k of compKeys) maxByTroops = Math.min(maxByTroops, Math.floor((v.troops[k] || 0) / composition[k]));
  if (!Number.isFinite(maxByTroops)) maxByTroops = 0;
  const willSend = Math.min(maxByTroops, selectedIds.length);
  let maxSpeed = 0;
  for (const k of compKeys) maxSpeed = Math.max(maxSpeed, TROOPS[k].speed);
  let moveMult = 1;
  for (const e of snapshot.serverEvents || []) if (e.affects === "move") moveMult *= e.multiplier;
  function estimateTravelSec(dist) {
    if (!maxSpeed) return null;
    return Math.max(4, Math.round(dist * maxSpeed / moveMult));
  }
  function setTroopCount(k, n) {
    setComposition(c => ({
      ...c,
      [k]: Math.max(0, Math.floor(Number(n) || 0))
    }));
  }
  function toggleSelected(id, selected) {
    setDeselectedIds(prev => {
      const next = new Set(prev);
      if (selected) next.delete(id);else next.add(id);
      return next;
    });
  }
  function selectAll() {
    setDeselectedIds(new Set());
  }
  function selectNone() {
    setDeselectedIds(new Set(available.map(t => t.id)));
  }

  // Porte le handler du bouton d'envoi tel quel : contrairement aux autres actions (voir doAction
  // dans GameContext), celle-ci compose un message de succès VARIABLE selon la réponse du serveur
  // (nombre réellement envoyé / ignoré faute de troupes ou déjà en cours), donc appelle l'API et
  // affiche le toast elle-même plutôt que de passer par un successMsg fixe.
  async function sendFarm() {
    const ids = available.filter(t => !deselectedIds.has(t.id)).map(t => t.id);
    if (!ids.length) return;
    const comp = {};
    for (const k in composition) if (composition[k] > 0) comp[k] = composition[k];
    if (!Object.keys(comp).length) {
      toast("Composez au moins une troupe pour le modèle de pillage.");
      return;
    }
    setSending(true);
    try {
      const data = await call("/api/farm/send", "POST", {
        targetIds: ids,
        troops: comp
      });
      applySnapshot(data.snapshot);
      const parts = [];
      if (data.sent) parts.push(`🌾 ${data.sent} pillage${data.sent > 1 ? "s" : ""} envoyé${data.sent > 1 ? "s" : ""}`);
      if (data.skippedBusy) parts.push(`${data.skippedBusy} déjà en cours`);
      if (data.skippedTroops) parts.push(`${data.skippedTroops} faute de troupes`);
      toast(parts.length ? parts.join(" · ") : "Aucun pillage envoyé.");
      if (data.sent) Audio.SFX.depart();
    } catch (err) {
      toast("⚠️ " + err.message);
    } finally {
      setSending(false);
    }
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "\uD83C\uDF3E Assistant de pillage"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Compose un mod\xE8le de troupes une bonne fois pour toutes, puis envoie-le en un clic vers tous les villages barbares \xE0 port\xE9e de ", /*#__PURE__*/React.createElement("b", null, v.name), " \u2014 plus besoin de remplir le formulaire d'attaque cible par cible. Ne cible jamais un autre joueur, m\xEAme par erreur. Clique une ligne (ou sa case) pour l'exclure de l'envoi : ce choix est conserv\xE9 m\xEAme pendant les mises \xE0 jour automatiques."), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-between",
    style: {
      alignItems: "flex-start",
      flexWrap: "wrap",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 6
    }
  }, "Mod\xE8le de pillage"), /*#__PURE__*/React.createElement("div", {
    className: "inputs"
  }, TROOP_ORDER.filter(k => k !== "noble").map(k => {
    const avail = v.troops[k] || 0;
    return /*#__PURE__*/React.createElement("div", {
      className: "inp",
      key: k
    }, /*#__PURE__*/React.createElement("span", null, TROOPS[k].name), /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: 0,
      max: avail,
      value: composition[k] || 0,
      onChange: e => setTroopCount(k, e.target.value)
    }), /*#__PURE__*/React.createElement("a", {
      href: "#",
      style: {
        fontSize: 10
      },
      onClick: e => {
        e.preventDefault();
        setTroopCount(k, avail);
      }
    }, "max ", avail));
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 6
    }
  }, "Rayon de recherche"), /*#__PURE__*/React.createElement("div", {
    className: "inp"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: 1,
    max: 500,
    style: {
      width: 70
    },
    value: radius,
    onChange: e => setRadius(Math.max(1, Math.min(500, Math.floor(Number(e.target.value) || 15))))
  }), " champs")))), /*#__PURE__*/React.createElement("div", {
    className: "flex-between",
    style: {
      alignItems: "center",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "small",
    style: {
      margin: 0
    }
  }, targets.length, " village", targets.length > 1 ? "s" : "", " barbare", targets.length > 1 ? "s" : "", " \xE0 port\xE9e \xB7", " ", /*#__PURE__*/React.createElement("b", null, selectedIds.length), " s\xE9lectionn\xE9", selectedIds.length > 1 ? "s" : "", " (sur ", available.length, " disponible", available.length > 1 ? "s" : "", ") \xB7 le mod\xE8le actuel permet d'en viser ", /*#__PURE__*/React.createElement("b", null, maxByTroops === Infinity ? "—" : maxByTroops), " \xE0 la fois avec les troupes pr\xE9sentes ici."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "small",
    type: "button",
    disabled: available.length === 0,
    onClick: selectAll
  }, "Tout s\xE9lectionner"), /*#__PURE__*/React.createElement("button", {
    className: "small",
    type: "button",
    disabled: available.length === 0,
    onClick: selectNone
  }, "Tout d\xE9s\xE9lectionner"))), /*#__PURE__*/React.createElement("button", {
    className: "primary",
    disabled: willSend <= 0 || sending,
    onClick: sendFarm
  }, "\uD83C\uDF3E Piller la s\xE9lection (", willSend, ")"), /*#__PURE__*/React.createElement("table", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null), /*#__PURE__*/React.createElement("th", null, "Village"), /*#__PURE__*/React.createElement("th", null, "Distance"), /*#__PURE__*/React.createElement("th", null, "Rang"), /*#__PURE__*/React.createElement("th", null, "Trajet"))), /*#__PURE__*/React.createElement("tbody", null, targets.length ? targets.map(t => {
    const tagKey = (snapshot.villageTags || {})[t.id];
    const checked = !t.busy && !deselectedIds.has(t.id);
    const etaSec = t.busy ? null : estimateTravelSec(t.dist);
    const etaHtml = t.busy ? "🚩 pillage en cours" : etaSec == null ? "—" : `⏱️ ${formatDurationShort(etaSec)}`;
    return /*#__PURE__*/React.createElement("tr", {
      className: "farm-row" + (checked ? " farm-row-selected" : "") + (t.busy ? " farm-row-busy" : ""),
      key: t.id,
      onClick: e => {
        if (t.busy) return;
        if (e.target.tagName === "INPUT") return;
        toggleSelected(t.id, !checked);
      }
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      disabled: t.busy,
      checked: checked,
      onChange: e => toggleSelected(t.id, e.target.checked)
    })), /*#__PURE__*/React.createElement("td", null, tagKey ? /*#__PURE__*/React.createElement("span", {
      className: "village-tag-badge",
      style: {
        position: "static",
        display: "inline-block",
        width: 14,
        height: 14,
        verticalAlign: -2
      },
      dangerouslySetInnerHTML: {
        __html: villageTagBadgeSvg(tagKey)
      }
    }) : null, " ", t.name, " ", /*#__PURE__*/React.createElement("span", {
      className: "small muted"
    }, "(", t.x, "|", t.y, ")")), /*#__PURE__*/React.createElement("td", null, t.dist.toFixed(1)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: "tag " + TIER_CLASS[t.tier]
    }, TIER_LABEL[t.tier])), /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, etaHtml));
  }) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 5,
    className: "muted small"
  }, "Aucun village barbare dans ce rayon \u2014 augmentez le rayon de recherche.")))));
}