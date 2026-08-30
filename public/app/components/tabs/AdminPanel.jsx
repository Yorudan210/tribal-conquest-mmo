import { useEffect, useState } from "react";
import { useGame } from "../../GameContext.jsx";
import { useToast } from "../../ToastContext.jsx";
import { BUILD_ORDER, BUILDINGS, TROOP_ORDER, TROOPS, SERVER_EVENTS } from "../../gameData.js";
import { fmt, fmtTime, RES_ICON } from "../../formulas.js";

// Porte renderAdmin()/renderAdminBlackArmyBox()/renderAdminBulkVillagesBox()/renderAdminVillagesTable()/
// renderAdminVillageEditor()/renderAdminEditor()/attachAdminHandlers() (index.html ~4837-5378) : le plus
// gros morceau du panneau, entièrement réservé aux comptes administrateurs (voir InformationTab, qui ne
// monte ce composant que si snapshot.isAdmin). adminPlayers/adminMissions/adminVillages restent un state
// LOCAL à ce composant (comme farmComposition dans FarmTab) plutôt que remonté dans GameContext : ils sont
// chargés à la demande, ne servent qu'ici, et un refetch à chaque ouverture de l'onglet Admin est un
// détail mineur, pas un problème -- exactement le même arbitrage que pour les autres états "confort"
// déjà tranché ailleurs dans cette réécriture.
export default function AdminPanel() {
  const {
    snapshot,
    username,
    adminSpeed,
    applySnapshot,
    call
  } = useGame();
  const toast = useToast();
  const [players, setPlayers] = useState(null);
  const [missions, setMissions] = useState(null);
  const [villages, setVillages] = useState(null);
  const [playerFilter, setPlayerFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [villageFilter, setVillageFilter] = useState("");
  const [selectedVillageId, setSelectedVillageId] = useState(null);
  const [bulkScope, setBulkScope] = useState("all");
  const [eventKey, setEventKey] = useState(SERVER_EVENTS[0]?.key || "");

  // Chargement à la demande (une seule fois, à l'ouverture du sous-onglet Admin) -- porte
  // refreshAdminData(), appelée dans l'ancien index.html seulement "si adminPlayers est encore null".
  useEffect(() => {
    let cancelled = false;
    Promise.all([call("/api/admin/players", "GET"), call("/api/admin/villages", "GET")]).then(([playersData, villagesData]) => {
      if (cancelled) return;
      setPlayers(playersData.players);
      setMissions(playersData.missions);
      setVillages(villagesData.villages);
    }).catch(err => {
      if (!cancelled) toast("⚠️ " + err.message);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function adminAction(promiseFn, successMsg) {
    try {
      const data = await promiseFn();
      if (data.snapshot) applySnapshot(data.snapshot);
      if (data.players) setPlayers(data.players);
      if (data.villages) setVillages(data.villages);
      if (data.missions) setMissions(data.missions);
      if (successMsg) toast(successMsg);
    } catch (err) {
      toast("⚠️ " + err.message);
    }
  }
  const filter = playerFilter.trim().toLowerCase();
  const filteredPlayers = (players || []).filter(p => !filter || p.username.toLowerCase().includes(filter) || (p.villageName || "").toLowerCase().includes(filter));
  const selP = (players || []).find(p => p.username === selected);
  const vfilter = villageFilter.trim().toLowerCase();
  const filteredVillages = (villages || []).filter(v => !vfilter || v.name.toLowerCase().includes(vfilter) || (v.x + "|" + v.y).includes(vfilter) || (v.owner || "").toLowerCase().includes(vfilter));
  const selV = (villages || []).find(v => v.id === selectedVillageId);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "\uD83D\uDEE0\uFE0F Panneau d'administration"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "R\xE9serv\xE9 aux comptes administrateurs. Ces actions modifient directement le monde \u2014 utilisez-les avec prudence."), /*#__PURE__*/React.createElement(SpeedBox, {
    adminSpeed: adminSpeed,
    adminAction: adminAction,
    call: call,
    toast: toast
  }), /*#__PURE__*/React.createElement(AnnounceBox, {
    adminAction: adminAction,
    call: call,
    toast: toast
  }), /*#__PURE__*/React.createElement(GiveAllBox, {
    adminAction: adminAction,
    call: call,
    toast: toast
  }), /*#__PURE__*/React.createElement(BulkVillagesBox, {
    bulkScope: bulkScope,
    setBulkScope: setBulkScope,
    adminAction: adminAction,
    call: call,
    toast: toast
  }), /*#__PURE__*/React.createElement(ServerEventsBox, {
    snapshot: snapshot,
    eventKey: eventKey,
    setEventKey: setEventKey,
    adminAction: adminAction,
    call: call,
    toast: toast
  }), /*#__PURE__*/React.createElement(BlackArmyBox, {
    snapshot: snapshot,
    adminAction: adminAction,
    call: call,
    toast: toast
  }), /*#__PURE__*/React.createElement(PermanentFactionsBox, {
    adminAction: adminAction,
    call: call
  }), /*#__PURE__*/React.createElement(MissionsBox, {
    missions: missions,
    adminAction: adminAction,
    call: call
  }), /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-between"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "\uD83D\uDC65 Joueurs (", filteredPlayers.length, filteredPlayers.length !== (players || []).length ? " / " + (players || []).length : "", ")"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "\uD83D\uDD0E Filtrer par pseudo ou village\u2026",
    style: {
      maxWidth: 240
    },
    value: playerFilter,
    onChange: e => setPlayerFilter(e.target.value)
  })), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Cliquez sur un joueur pour modifier son village (ressources, b\xE2timents, troupes)."), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 280,
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Pseudo"), /*#__PURE__*/React.createElement("th", null, "Village"), /*#__PURE__*/React.createElement("th", null, "Coord."), /*#__PURE__*/React.createElement("th", null, "Ressources"), /*#__PURE__*/React.createElement("th", null, "HdV"), /*#__PURE__*/React.createElement("th", null, "Files (constr./entr.)"), /*#__PURE__*/React.createElement("th", null, "Villages"))), /*#__PURE__*/React.createElement("tbody", null, filteredPlayers.length ? filteredPlayers.map(p => /*#__PURE__*/React.createElement("tr", {
    key: p.username,
    className: selected === p.username ? "admin-selected" : "",
    onClick: () => setSelected(p.username)
  }, /*#__PURE__*/React.createElement("td", null, p.username, p.isAdmin ? /*#__PURE__*/React.createElement("span", {
    className: "tag strong"
  }, " ADMIN") : null), /*#__PURE__*/React.createElement("td", null, p.villageName || "-"), /*#__PURE__*/React.createElement("td", null, p.coord || "-"), /*#__PURE__*/React.createElement("td", null, RES_ICON.wood, fmt(p.resources ? p.resources.wood : 0), " ", RES_ICON.clay, fmt(p.resources ? p.resources.clay : 0), " ", RES_ICON.iron, fmt(p.resources ? p.resources.iron : 0)), /*#__PURE__*/React.createElement("td", null, "\uD83C\uDFDB\uFE0F ", p.buildings ? p.buildings.hq || 0 : 0), /*#__PURE__*/React.createElement("td", null, p.buildQueueLen || 0, " / ", p.trainQueueLen || 0), /*#__PURE__*/React.createElement("td", null, p.villageCount || 1))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 7,
    className: "muted"
  }, (players || []).length ? "Aucun joueur ne correspond à la recherche." : "Chargement…")))))), selP ? /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement(PlayerEditor, {
    key: selP.username,
    player: selP,
    username: username,
    adminAction: adminAction,
    call: call,
    toast: toast,
    onDeleted: () => setSelected(null)
  })) : /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "S\xE9lectionnez un joueur ci-dessus pour l'\xE9diter."), /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-between"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "\uD83C\uDFD8\uFE0F Tous les villages (", filteredVillages.length, filteredVillages.length !== (villages || []).length ? " / " + (villages || []).length : "", ")"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "\uD83D\uDD0E Filtrer par nom, coord. ou propri\xE9taire\u2026",
    style: {
      maxWidth: 260
    },
    value: villageFilter,
    onChange: e => setVillageFilter(e.target.value)
  })), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Cliquez sur un village pour l'\xE9diter individuellement, y compris une conqu\xEAte d'un joueur qui n'est pas son village d'origine."), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 280,
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Village"), /*#__PURE__*/React.createElement("th", null, "Coord."), /*#__PURE__*/React.createElement("th", null, "Propri\xE9taire"), /*#__PURE__*/React.createElement("th", null, "HdV"), /*#__PURE__*/React.createElement("th", null, "Ressources"), /*#__PURE__*/React.createElement("th", null, "Files (constr./entr.)"))), /*#__PURE__*/React.createElement("tbody", null, filteredVillages.length ? filteredVillages.map(v => /*#__PURE__*/React.createElement("tr", {
    key: v.id,
    className: selectedVillageId === v.id ? "admin-selected" : "",
    onClick: () => setSelectedVillageId(v.id)
  }, /*#__PURE__*/React.createElement("td", null, v.name), /*#__PURE__*/React.createElement("td", null, v.x, "|", v.y), /*#__PURE__*/React.createElement("td", null, v.isPlayer ? v.owner : "🏚️ barbare"), /*#__PURE__*/React.createElement("td", null, v.hq != null ? v.hq : "—"), /*#__PURE__*/React.createElement("td", null, RES_ICON.wood, fmt(v.resources.wood), " ", RES_ICON.clay, fmt(v.resources.clay), " ", RES_ICON.iron, fmt(v.resources.iron)), /*#__PURE__*/React.createElement("td", null, v.buildQueueLen, "/", v.trainQueueLen))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 6,
    className: "muted"
  }, (villages || []).length ? "Aucun village ne correspond à la recherche." : "Chargement…")))))), selV ? /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement(VillageEditor, {
    key: selV.id,
    village: selV,
    adminAction: adminAction,
    call: call
  })) : /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "S\xE9lectionnez un village ci-dessus pour l'\xE9diter."));
}
function SpeedBox({
  adminSpeed,
  adminAction,
  call,
  toast
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", null, "\u26A1 Vitesse du monde"), /*#__PURE__*/React.createElement("div", {
    className: "flex-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "small"
  }, "Multiplicateur actuel : ", /*#__PURE__*/React.createElement("b", null, adminSpeed, "\xD7"), " \u2014 s'applique imm\xE9diatement \xE0 tout : ressources, files de construction et d'entra\xEEnement d\xE9j\xE0 en cours ", /*#__PURE__*/React.createElement("i", null, "et"), " nouvelles (temps divis\xE9 par ce facteur)."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminSpeedInput",
    min: "0.01",
    max: "1000",
    step: "0.1",
    defaultValue: adminSpeed,
    style: {
      width: 90
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "primary",
    onClick: () => {
      const v = Number(document.getElementById("adminSpeedInput").value);
      if (!v || v <= 0) {
        toast("⚠️ Valeur invalide.");
        return;
      }
      adminAction(() => call("/api/admin/speed", "POST", {
        multiplier: v
      }), "Vitesse du monde réglée sur " + v + "×.");
    }
  }, "Appliquer"))));
}
function AnnounceBox({
  adminAction,
  call,
  toast
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83D\uDCE2 Annonce \xE0 tous les joueurs"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Envoie un message qui appara\xEEt imm\xE9diatement dans la bo\xEEte de rapports de tous les joueurs actuels."), /*#__PURE__*/React.createElement("form", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "flex-start"
    },
    onSubmit: e => {
      e.preventDefault();
      const inp = document.getElementById("adminAnnounceText");
      const text = (inp.value || "").trim();
      if (!text) {
        toast("⚠️ Message vide.");
        return;
      }
      adminAction(() => call("/api/admin/announce", "POST", {
        text
      }), "📢 Annonce publiée à tous les joueurs.");
      inp.value = "";
    }
  }, /*#__PURE__*/React.createElement("textarea", {
    id: "adminAnnounceText",
    rows: 2,
    maxLength: 500,
    placeholder: "Message de l'administration\u2026",
    style: {
      flex: "1 1 260px"
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "primary"
  }, "Publier")));
}
function GiveAllBox({
  adminAction,
  call,
  toast
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83C\uDF81 Ressources pour tous les joueurs"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Ajoute ces montants au stock actuel de chaque joueur, en une seule fois."), /*#__PURE__*/React.createElement("div", {
    className: "inputs",
    style: {
      display: "flex",
      gap: 14,
      marginBottom: 8,
      flexWrap: "wrap"
    }
  }, ["wood", "clay", "iron"].map(r => /*#__PURE__*/React.createElement("div", {
    className: "inp",
    key: r
  }, RES_ICON[r], /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminGiveAll_" + r,
    min: "0",
    defaultValue: 0
  }))), /*#__PURE__*/React.createElement("button", {
    className: "primary",
    onClick: () => {
      const wood = Number(document.getElementById("adminGiveAll_wood").value) || 0;
      const clay = Number(document.getElementById("adminGiveAll_clay").value) || 0;
      const iron = Number(document.getElementById("adminGiveAll_iron").value) || 0;
      if (!wood && !clay && !iron) {
        toast("⚠️ Indiquez au moins une ressource à donner.");
        return;
      }
      adminAction(() => call("/api/admin/give-all", "POST", {
        wood,
        clay,
        iron
      }), "Ressources données à tous les joueurs.");
    }
  }, "\u2795 Donner \xE0 tous")));
}
const BULK_SCOPE_LABEL = {
  all: "tous les villages",
  players: "les villages de joueurs",
  barbarians: "les villages barbares"
};
function BulkVillagesBox({
  bulkScope,
  setBulkScope,
  adminAction,
  call,
  toast
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83C\uDF0D Gestion group\xE9e de tous les villages"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Applique une action \xE0 plusieurs villages \xE0 la fois. Choisissez d'abord la port\xE9e ci-dessous ; pour les b\xE2timents et les troupes, ne remplissez que les champs que vous voulez r\xE9ellement changer \u2014 un champ laiss\xE9 vide n'est pas touch\xE9."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "small muted"
  }, "Port\xE9e de l'action"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("select", {
    value: bulkScope,
    onChange: e => setBulkScope(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "\uD83C\uDF10 Tous les villages (joueurs + barbares)"), /*#__PURE__*/React.createElement("option", {
    value: "players"
  }, "\uD83D\uDC65 Villages de joueurs uniquement (origine + conqu\xEAtes)"), /*#__PURE__*/React.createElement("option", {
    value: "barbarians"
  }, "\uD83C\uDFDA\uFE0F Villages barbares uniquement"))), /*#__PURE__*/React.createElement("h4", null, "Ressources"), /*#__PURE__*/React.createElement("p", {
    className: "small muted",
    style: {
      marginTop: 0
    }
  }, "Ajoute ces montants au stock actuel de chaque village de la port\xE9e (pas de plafond d'entrep\xF4t)."), /*#__PURE__*/React.createElement("div", {
    className: "inputs",
    style: {
      display: "flex",
      gap: 14,
      marginBottom: 8,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, ["wood", "clay", "iron"].map(r => /*#__PURE__*/React.createElement("div", {
    className: "inp",
    key: r
  }, RES_ICON[r], /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminBulkGive_" + r,
    min: "0",
    placeholder: "0"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "primary",
    onClick: () => {
      const wood = Number(document.getElementById("adminBulkGive_wood").value) || 0;
      const clay = Number(document.getElementById("adminBulkGive_clay").value) || 0;
      const iron = Number(document.getElementById("adminBulkGive_iron").value) || 0;
      if (!wood && !clay && !iron) {
        toast("⚠️ Indiquez au moins une ressource à donner.");
        return;
      }
      adminAction(() => call("/api/admin/villages/bulk-give", "POST", {
        scope: bulkScope,
        wood,
        clay,
        iron
      }), "Ressources données à " + BULK_SCOPE_LABEL[bulkScope] + ".");
    }
  }, "\u2795 Donner \xE0 la port\xE9e s\xE9lectionn\xE9e")), /*#__PURE__*/React.createElement("h4", null, "B\xE2timents ", /*#__PURE__*/React.createElement("span", {
    className: "small muted",
    style: {
      fontWeight: "normal"
    }
  }, "(niveau exact \u2014 ignor\xE9 pour les villages barbares, qui n'en ont pas)")), /*#__PURE__*/React.createElement("div", {
    className: "grid-buildings",
    style: {
      gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
      marginBottom: 8
    }
  }, BUILD_ORDER.map(k => /*#__PURE__*/React.createElement("div", {
    className: "troop-row",
    key: k
  }, /*#__PURE__*/React.createElement("span", {
    className: "tname"
  }, BUILDINGS[k].name), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminBulkBuild_" + k,
    min: "0",
    max: BUILDINGS[k].max,
    placeholder: "\u2014"
  })))), /*#__PURE__*/React.createElement("button", {
    className: "primary",
    style: {
      marginBottom: 14
    },
    onClick: () => {
      const buildings = {};
      BUILD_ORDER.forEach(k => {
        const el = document.getElementById("adminBulkBuild_" + k);
        if (el && el.value !== "") buildings[k] = Number(el.value) || 0;
      });
      if (!Object.keys(buildings).length) {
        toast("⚠️ Remplissez au moins un niveau de bâtiment à appliquer.");
        return;
      }
      adminAction(() => call("/api/admin/villages/bulk-update", "POST", {
        scope: bulkScope,
        buildings
      }), "Bâtiments appliqués à " + BULK_SCOPE_LABEL[bulkScope] + ".");
    }
  }, "Appliquer les b\xE2timents remplis \xE0 la port\xE9e"), /*#__PURE__*/React.createElement("h4", null, "Troupes ", /*#__PURE__*/React.createElement("span", {
    className: "small muted",
    style: {
      fontWeight: "normal"
    }
  }, "(nombre exact)")), /*#__PURE__*/React.createElement("div", {
    className: "grid-buildings",
    style: {
      gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
      marginBottom: 8
    }
  }, TROOP_ORDER.map(k => /*#__PURE__*/React.createElement("div", {
    className: "troop-row",
    key: k
  }, /*#__PURE__*/React.createElement("span", {
    className: "tname"
  }, TROOPS[k].name), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminBulkTroop_" + k,
    min: "0",
    placeholder: "\u2014"
  })))), /*#__PURE__*/React.createElement("button", {
    className: "primary",
    style: {
      marginBottom: 14
    },
    onClick: () => {
      const troops = {};
      TROOP_ORDER.forEach(k => {
        const el = document.getElementById("adminBulkTroop_" + k);
        if (el && el.value !== "") troops[k] = Number(el.value) || 0;
      });
      if (!Object.keys(troops).length) {
        toast("⚠️ Remplissez au moins un nombre de troupes à appliquer.");
        return;
      }
      adminAction(() => call("/api/admin/villages/bulk-update", "POST", {
        scope: bulkScope,
        troops
      }), "Troupes appliquées à " + BULK_SCOPE_LABEL[bulkScope] + ".");
    }
  }, "Appliquer les troupes remplies \xE0 la port\xE9e"), /*#__PURE__*/React.createElement("h4", null, "Files d'attente"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => adminAction(() => call("/api/admin/villages/bulk-finish-build", "POST", {
      scope: bulkScope
    }), "Constructions terminées pour " + BULK_SCOPE_LABEL[bulkScope] + ".")
  }, "\u2705 Terminer toutes les constructions en cours (port\xE9e)"), /*#__PURE__*/React.createElement("button", {
    onClick: () => adminAction(() => call("/api/admin/villages/bulk-finish-train", "POST", {
      scope: bulkScope
    }), "Entraînements terminés pour " + BULK_SCOPE_LABEL[bulkScope] + ".")
  }, "\u2705 Terminer tous les entra\xEEnements en cours (port\xE9e)")));
}
function ServerEventsBox({
  snapshot,
  eventKey,
  setEventKey,
  adminAction,
  call,
  toast
}) {
  const def = SERVER_EVENTS.find(e => e.key === eventKey) || SERVER_EVENTS[0];
  const isInstant = def?.kind === "instant";
  const activeEvents = snapshot.serverEvents || [];
  return /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83C\uDF89 \xC9v\xE8nements du serveur"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Lance un \xE9v\xE8nement temporaire visible par tous les joueurs (banni\xE8re + annonce automatique dans leurs rapports). Un seul \xE9v\xE8nement actif \xE0 la fois par type d'effet : en relancer un remplace celui en cours."), activeEvents.length ? /*#__PURE__*/React.createElement("div", {
    className: "event-badges",
    style: {
      marginBottom: 12
    }
  }, activeEvents.map(e => /*#__PURE__*/React.createElement("span", {
    key: e.id,
    className: "event-badge admin",
    title: e.name + " ×" + e.multiplier + " — encore " + fmtTime(e.remainingSec) + " (cliquer pour arrêter)",
    onClick: () => adminAction(() => call("/api/admin/event/stop", "POST", {
      id: e.id
    }), "Évènement arrêté.")
  }, e.icon, /*#__PURE__*/React.createElement("span", {
    className: "event-badge-mult"
  }, "\xD7", e.multiplier), /*#__PURE__*/React.createElement("span", {
    className: "event-badge-stop"
  }, "\u2715")))) : /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Aucun \xE9v\xE8nement actif actuellement."), /*#__PURE__*/React.createElement("form", {
    style: {
      display: "flex",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "flex-end"
    },
    onSubmit: e => {
      e.preventDefault();
      if (!def) return;
      if (isInstant) {
        const amount = Number(document.getElementById("adminEventAmount").value);
        if (!amount || amount <= 0) {
          toast("⚠️ Montant invalide.");
          return;
        }
        adminAction(() => call("/api/admin/event/start", "POST", {
          key: def.key,
          amount
        }), def.icon + " " + def.name + " envoyé à tous les joueurs.");
      } else {
        const multiplier = Number(document.getElementById("adminEventMultiplier").value);
        const minutes = Number(document.getElementById("adminEventMinutes").value);
        if (!multiplier || multiplier <= 1) {
          toast("⚠️ Le multiplicateur doit être supérieur à 1.");
          return;
        }
        if (!minutes || minutes <= 0) {
          toast("⚠️ Durée invalide.");
          return;
        }
        adminAction(() => call("/api/admin/event/start", "POST", {
          key: def.key,
          multiplier,
          minutes
        }), def.icon + " " + def.name + " lancé pour " + minutes + " min.");
      }
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "small muted"
  }, "Type d'\xE9v\xE8nement"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("select", {
    value: eventKey,
    onChange: e => setEventKey(e.target.value)
  }, SERVER_EVENTS.map(e => /*#__PURE__*/React.createElement("option", {
    key: e.key,
    value: e.key
  }, e.icon, " ", e.name)))), isInstant && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "small muted"
  }, "Montant (bois + argile + fer, chacun)"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminEventAmount",
    min: "1",
    max: "1000000",
    defaultValue: 1000
  })), !isInstant && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "small muted"
  }, "Multiplicateur (\xD7)"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminEventMultiplier",
    min: "1.1",
    max: "20",
    step: "0.1",
    defaultValue: 2
  })), !isInstant && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "small muted"
  }, "Dur\xE9e (minutes)"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminEventMinutes",
    min: "1",
    max: "10080",
    defaultValue: 60
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "primary"
  }, "\uD83D\uDE80 Lancer")), /*#__PURE__*/React.createElement("p", {
    className: "small muted",
    style: {
      marginTop: 8
    }
  }, def?.desc));
}
function BlackArmyBox({
  snapshot,
  adminAction,
  call,
  toast
}) {
  const ba = snapshot.blackArmyEvent;
  const active = ba && ba.active;
  return /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginBottom: 14,
      borderColor: "#9a2b2b"
    }
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83C\uDFF4 \xC9v\xE8nement : l'Arm\xE9e Noire"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Fait appara\xEEtre une vague de campements PNJ (pins noirs sur la Carte), plus forts et plus riches que des barbares ordinaires, r\xE9partis en 5 Rangs (I faible \u2192 V redoutable) pour donner un objectif aussi bien aux nouveaux joueurs qu'aux joueurs multi-villages. Une annonce automatique explique les r\xE8gles \xE0 tous. Un seul \xE9v\xE8nement \xE0 la fois."), active ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "event-badges",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "event-badge admin",
    title: "🏴 L'Armée Noire — encore " + fmtTime(ba.remainingSec) + " (cliquer pour arrêter)",
    onClick: () => adminAction(() => call("/api/admin/blackarmy/stop", "POST", {}), "Évènement Armée Noire arrêté.")
  }, "\uD83C\uDFF4", /*#__PURE__*/React.createElement("span", {
    className: "event-badge-mult"
  }, fmt(ba.totalSpawned), " campements"), /*#__PURE__*/React.createElement("span", {
    className: "event-badge-stop"
  }, "\u2715"))), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Encore ", /*#__PURE__*/React.createElement("b", null, fmtTime(ba.remainingSec)), " avant le retrait automatique des campements non conquis \u2014 ", fmt(ba.defeatedCount), " victoire", ba.defeatedCount > 1 ? "s" : "", " enregistr\xE9e", ba.defeatedCount > 1 ? "s" : "", " jusqu'ici.")) : /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Aucun \xE9v\xE8nement Arm\xE9e Noire actif actuellement."), /*#__PURE__*/React.createElement("form", {
    style: {
      display: "flex",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "flex-end"
    },
    inert: active ? "" : undefined,
    onSubmit: e => {
      e.preventDefault();
      if (active) return;
      const count = Number(document.getElementById("adminBlackArmyCount").value);
      const minutes = Number(document.getElementById("adminBlackArmyMinutes").value);
      if (!count || count <= 0) {
        toast("⚠️ Nombre de campements invalide.");
        return;
      }
      if (!minutes || minutes <= 0) {
        toast("⚠️ Durée invalide.");
        return;
      }
      adminAction(() => call("/api/admin/blackarmy/start", "POST", {
        count,
        minutes
      }), "🏴 L'Armée Noire envahit le monde !");
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "small muted"
  }, "Nombre de campements"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminBlackArmyCount",
    min: "5",
    max: "150",
    defaultValue: 40
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "small muted"
  }, "Dur\xE9e (minutes)"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminBlackArmyMinutes",
    min: "60",
    max: "10080",
    defaultValue: 4320
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "primary",
    disabled: active
  }, "\uD83C\uDFF4 Lancer l'Arm\xE9e Noire")));
}

/* Peuple rétroactivement un monde déjà généré en repaires de brigands/camps de maraudeurs (Phase 1
   "variété des cibles PvE") -- utile pour tout monde de production existant depuis avant l'ajout de
   ces factions (spawnPermanentFactions ne s'exécute normalement qu'à l'init d'un monde neuf, voir
   server/store.js). Action à usage unique et sans danger : le serveur refuse de dupliquer la
   population si ces factions existent déjà (voir adminSeedPermanentFactions, server/gameLogic.js). */
function PermanentFactionsBox({
  adminAction,
  call
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83D\uDDE1\uFE0F Repaires de brigands & camps de maraudeurs"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Peuple la carte en factions PvE permanentes (voir la section d'aide d\xE9di\xE9e) si ce n'est pas d\xE9j\xE0 fait -- utile une seule fois pour un monde qui existait d\xE9j\xE0 avant l'ajout de cette fonctionnalit\xE9. Sans effet si d\xE9j\xE0 peupl\xE9 (le serveur refuse toute duplication)."), /*#__PURE__*/React.createElement("button", {
    onClick: () => adminAction(() => call("/api/admin/factions/seed", "POST", {}), "🗡️🐎 Factions permanentes peuplées avec succès !")
  }, "Peupler les factions permanentes"));
}
function MissionsBox({
  missions,
  adminAction,
  call
}) {
  const list = missions || [];
  return /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83D\uDEA9 Missions en cours (", list.length, ")"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Force la r\xE9solution/arriv\xE9e imm\xE9diate d'une mission (attaque, reconnaissance, soutien...), utile pour d\xE9bloquer un joueur ou tester."), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 220,
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Type"), /*#__PURE__*/React.createElement("th", null, "Joueur"), /*#__PURE__*/React.createElement("th", null, "Cible"), /*#__PURE__*/React.createElement("th", null, "Statut"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, list.length ? list.map(m => /*#__PURE__*/React.createElement("tr", {
    key: m.id
  }, /*#__PURE__*/React.createElement("td", null, m.kindLabel), /*#__PURE__*/React.createElement("td", null, m.attacker || "-"), /*#__PURE__*/React.createElement("td", null, m.targetName ? m.targetName + " (" + m.targetCoord + ")" : "-"), /*#__PURE__*/React.createElement("td", null, m.resolveDone ? "retour" : "en route"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
    onClick: () => adminAction(() => call("/api/admin/finish-mission", "POST", {
      missionId: m.id
    }), "Mission résolue instantanément.")
  }, "\u2705 Terminer")))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 5,
    className: "muted"
  }, "Aucune mission en cours."))))));
}
function PlayerEditor({
  player: p,
  username,
  adminAction,
  call,
  toast,
  onDeleted
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex-between",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "\u270F\uFE0F ", p.username, " ", p.isAdmin ? /*#__PURE__*/React.createElement("span", {
    className: "tag strong"
  }, "ADMIN") : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => adminAction(() => call("/api/admin/setadmin", "POST", {
      username: p.username,
      isAdmin: !p.isAdmin
    }), p.isAdmin ? "Droits admin retirés à " + p.username + "." : "Droits admin accordés à " + p.username + ".")
  }, p.isAdmin ? "Retirer les droits admin" : "Promouvoir administrateur"), /*#__PURE__*/React.createElement("button", {
    className: "danger",
    title: "Supprime le compte d\xE9finitivement. Ses villages redeviennent barbares (jamais supprim\xE9s de la carte).",
    onClick: () => {
      if (p.username === username) {
        toast("⚠️ Vous ne pouvez pas supprimer votre propre compte.");
        return;
      }
      if (!confirm("Supprimer définitivement le compte « " + p.username + " » ? Cette action est irréversible : son compte, ses rapports, son adhésion à sa guilde et ses offres au marché seront supprimés, et son ou ses village(s) redeviendront des villages barbares.")) return;
      onDeleted();
      adminAction(() => call("/api/admin/delete-player", "POST", {
        username: p.username
      }), "🗑️ Compte « " + p.username + " » supprimé.");
    }
  }, "\uD83D\uDDD1\uFE0F Supprimer le joueur"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => adminAction(() => call("/api/admin/finish-build", "POST", {
      username: p.username
    }), "Construction(s) terminée(s) instantanément.")
  }, "\u2705 Terminer la construction en cours"), /*#__PURE__*/React.createElement("button", {
    onClick: () => adminAction(() => call("/api/admin/finish-train", "POST", {
      username: p.username
    }), "Entraînement(s) terminé(s) instantanément.")
  }, "\u2705 Terminer l'entra\xEEnement en cours")), /*#__PURE__*/React.createElement("h4", null, "Ressources"), /*#__PURE__*/React.createElement("div", {
    className: "inputs",
    style: {
      display: "flex",
      gap: 14,
      marginBottom: 8
    }
  }, ["wood", "clay", "iron"].map(r => /*#__PURE__*/React.createElement("div", {
    className: "inp",
    key: r
  }, RES_ICON[r], /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminRes_" + r,
    min: "0",
    defaultValue: p.resources ? Math.round(p.resources[r] || 0) : 0
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "primary",
    onClick: () => {
      const resources = {
        wood: Number(document.getElementById("adminRes_wood").value) || 0,
        clay: Number(document.getElementById("adminRes_clay").value) || 0,
        iron: Number(document.getElementById("adminRes_iron").value) || 0
      };
      adminAction(() => call("/api/admin/village", "POST", {
        username: p.username,
        resources
      }), "Ressources mises à jour pour " + p.username + ".");
    }
  }, "D\xE9finir (valeur exacte)"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      const wood = Number(document.getElementById("adminRes_wood").value) || 0;
      const clay = Number(document.getElementById("adminRes_clay").value) || 0;
      const iron = Number(document.getElementById("adminRes_iron").value) || 0;
      adminAction(() => call("/api/admin/give", "POST", {
        username: p.username,
        wood,
        clay,
        iron
      }), "Ressources données à " + p.username + ".");
    }
  }, "\u2795 Donner (ajoute ces montants au stock actuel)")), /*#__PURE__*/React.createElement("h4", null, "B\xE2timents"), /*#__PURE__*/React.createElement("div", {
    className: "grid-buildings",
    style: {
      gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
      marginBottom: 8
    }
  }, BUILD_ORDER.map(k => /*#__PURE__*/React.createElement("div", {
    className: "troop-row",
    key: k
  }, /*#__PURE__*/React.createElement("span", {
    className: "tname"
  }, BUILDINGS[k].name), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminBuild_" + k,
    min: "0",
    max: BUILDINGS[k].max,
    defaultValue: p.buildings ? p.buildings[k] || 0 : 0
  })))), /*#__PURE__*/React.createElement("button", {
    className: "primary",
    style: {
      marginBottom: 14
    },
    onClick: () => {
      const buildings = {};
      BUILD_ORDER.forEach(k => {
        const el = document.getElementById("adminBuild_" + k);
        if (el) buildings[k] = Number(el.value) || 0;
      });
      adminAction(() => call("/api/admin/village", "POST", {
        username: p.username,
        buildings
      }), "Bâtiments mis à jour pour " + p.username + ".");
    }
  }, "Enregistrer les b\xE2timents"), /*#__PURE__*/React.createElement("h4", null, "Troupes"), /*#__PURE__*/React.createElement("div", {
    className: "grid-buildings",
    style: {
      gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
      marginBottom: 8
    }
  }, TROOP_ORDER.map(k => /*#__PURE__*/React.createElement("div", {
    className: "troop-row",
    key: k
  }, /*#__PURE__*/React.createElement("span", {
    className: "tname"
  }, TROOPS[k].name), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminTroop_" + k,
    min: "0",
    defaultValue: p.troops ? p.troops[k] || 0 : 0
  })))), /*#__PURE__*/React.createElement("button", {
    className: "primary",
    onClick: () => {
      const troops = {};
      TROOP_ORDER.forEach(k => {
        const el = document.getElementById("adminTroop_" + k);
        if (el) troops[k] = Number(el.value) || 0;
      });
      adminAction(() => call("/api/admin/village", "POST", {
        username: p.username,
        troops
      }), "Troupes mises à jour pour " + p.username + ".");
    }
  }, "Enregistrer les troupes"));
}
function VillageEditor({
  village: v,
  adminAction,
  call
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex-between",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "\u270F\uFE0F ", v.name, " ", /*#__PURE__*/React.createElement("span", {
    className: "small muted",
    style: {
      fontWeight: "normal"
    }
  }, "(", v.x, "|", v.y, ") \u2014 ", v.isPlayer ? v.owner : "🏚️ village barbare"))), v.isPlayer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => adminAction(() => call("/api/admin/villages/finish-build", "POST", {
      villageId: v.id
    }), "Construction(s) terminée(s) pour ce village.")
  }, "\u2705 Terminer la construction en cours"), /*#__PURE__*/React.createElement("button", {
    onClick: () => adminAction(() => call("/api/admin/villages/finish-train", "POST", {
      villageId: v.id
    }), "Entraînement(s) terminé(s) pour ce village.")
  }, "\u2705 Terminer l'entra\xEEnement en cours")), /*#__PURE__*/React.createElement("h4", null, "Ressources"), /*#__PURE__*/React.createElement("div", {
    className: "inputs",
    style: {
      display: "flex",
      gap: 14,
      marginBottom: 8
    }
  }, ["wood", "clay", "iron"].map(r => /*#__PURE__*/React.createElement("div", {
    className: "inp",
    key: r
  }, RES_ICON[r], /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminVRes_" + r,
    min: "0",
    defaultValue: Math.round(v.resources ? v.resources[r] || 0 : 0)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "primary",
    onClick: () => {
      const resources = {
        wood: Number(document.getElementById("adminVRes_wood").value) || 0,
        clay: Number(document.getElementById("adminVRes_clay").value) || 0,
        iron: Number(document.getElementById("adminVRes_iron").value) || 0
      };
      adminAction(() => call("/api/admin/villages/update", "POST", {
        villageId: v.id,
        resources
      }), "Ressources mises à jour pour ce village.");
    }
  }, "D\xE9finir (valeur exacte)"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      const wood = Number(document.getElementById("adminVRes_wood").value) || 0;
      const clay = Number(document.getElementById("adminVRes_clay").value) || 0;
      const iron = Number(document.getElementById("adminVRes_iron").value) || 0;
      adminAction(() => call("/api/admin/villages/give", "POST", {
        villageId: v.id,
        wood,
        clay,
        iron
      }), "Ressources données à ce village.");
    }
  }, "\u2795 Donner (ajoute ces montants au stock actuel)")), v.buildings ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "B\xE2timents"), /*#__PURE__*/React.createElement("div", {
    className: "grid-buildings",
    style: {
      gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
      marginBottom: 8
    }
  }, BUILD_ORDER.map(k => /*#__PURE__*/React.createElement("div", {
    className: "troop-row",
    key: k
  }, /*#__PURE__*/React.createElement("span", {
    className: "tname"
  }, BUILDINGS[k].name), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminVBuild_" + k,
    min: "0",
    max: BUILDINGS[k].max,
    defaultValue: v.buildings[k] || 0
  })))), /*#__PURE__*/React.createElement("button", {
    className: "primary",
    style: {
      marginBottom: 14
    },
    onClick: () => {
      const buildings = {};
      BUILD_ORDER.forEach(k => {
        const el = document.getElementById("adminVBuild_" + k);
        if (el) buildings[k] = Number(el.value) || 0;
      });
      adminAction(() => call("/api/admin/villages/update", "POST", {
        villageId: v.id,
        buildings
      }), "Bâtiments mis à jour pour ce village.");
    }
  }, "Enregistrer les b\xE2timents")) : /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Village barbare : pas de b\xE2timents (niveau de muraille actuel : ", v.wallLevel || 0, ")."), /*#__PURE__*/React.createElement("h4", null, "Troupes"), /*#__PURE__*/React.createElement("div", {
    className: "grid-buildings",
    style: {
      gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
      marginBottom: 8
    }
  }, TROOP_ORDER.map(k => /*#__PURE__*/React.createElement("div", {
    className: "troop-row",
    key: k
  }, /*#__PURE__*/React.createElement("span", {
    className: "tname"
  }, TROOPS[k].name), /*#__PURE__*/React.createElement("input", {
    type: "number",
    id: "adminVTroop_" + k,
    min: "0",
    defaultValue: v.troops ? v.troops[k] || 0 : 0
  })))), /*#__PURE__*/React.createElement("button", {
    className: "primary",
    onClick: () => {
      const troops = {};
      TROOP_ORDER.forEach(k => {
        const el = document.getElementById("adminVTroop_" + k);
        if (el) troops[k] = Number(el.value) || 0;
      });
      adminAction(() => call("/api/admin/villages/update", "POST", {
        villageId: v.id,
        troops
      }), "Troupes mises à jour pour ce village.");
    }
  }, "Enregistrer les troupes"));
}