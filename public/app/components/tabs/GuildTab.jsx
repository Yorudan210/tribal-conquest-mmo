import { useEffect, useRef, useState } from "react";
import { useGame } from "../../GameContext.jsx";
import { BUILDINGS, GUILD_BOOSTS, buildCost } from "../../gameData.js";
import { fmt, fmtTime, canAffordAll, vBuildTime, estimateNow, RES_ICON } from "../../formulas.js";
import { DIPLOMACY_LABEL } from "../../legacy/mapRender.js";
import { DIPLOMACY_LABEL_LOWER } from "../../legacy/reportRender.js";
const GUILD_MAX_BONUS_PERCENT_CLIENT = 25;

// Porte renderGuild()/attachGuildHandlers() : fondation de guilde, Hall de guilde (bâtiment partagé),
// dons, boutique de bonus temporaires, membres, diplomatie entre guildes.
export default function GuildTab() {
  const {
    snapshot,
    username,
    serverTimeOffset,
    adminSpeed,
    doAction,
    call,
    openPlayerProfile
  } = useGame();
  const g = snapshot.guild;
  if (!g) return /*#__PURE__*/React.createElement(NoGuild, null);
  const [subTab, setSubTab] = useState("overview");
  const v = snapshot.village;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "\uD83D\uDC65 [", g.tag, "] ", g.name), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Bonus de production actuel : ", /*#__PURE__*/React.createElement("b", null, "+", g.bonusPercent, "%"), " pour tous les membres (bas\xE9 sur ", fmt(g.totalDonated), " ressources donn\xE9es au total)."), /*#__PURE__*/React.createElement("div", {
    className: "guild-banner"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "guild-banner-bg",
    viewBox: "0 0 1200 100",
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "1200",
    height: "100",
    fill: "url(#tex-cloth-burgundy)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "guild-banner-content"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "44",
    height: "44",
    viewBox: "0 0 24 24",
    fill: "#f6ecd3",
    stroke: "#f6ecd3",
    strokeWidth: "0.5"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 18H20L18 9L14 13L12 7L10 13L6 9L4 18Z"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "guild-banner-title"
  }, "[", g.tag, "] ", g.name), /*#__PURE__*/React.createElement("div", {
    className: "guild-banner-sub"
  }, "+", g.bonusPercent, "% de production partag\xE9e \xB7 ", fmt(g.totalDonated), " ressources donn\xE9es au total")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 16
    }
  }, [["overview", "🏰 Aperçu"], ["shop", "🛒 Boutique"], ["diplomacy", "🕊️ Diplomatie"]].map(([k, label]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: subTab === k ? "primary" : "",
    onClick: () => setSubTab(k)
  }, label))), subTab === "shop" ? /*#__PURE__*/React.createElement(ShopBox, {
    g: g,
    doAction: doAction,
    call: call
  }) : subTab === "diplomacy" ? /*#__PURE__*/React.createElement(DiplomacyBox, {
    g: g,
    doAction: doAction,
    call: call
  }) : /*#__PURE__*/React.createElement(OverviewBox, {
    g: g,
    v: v,
    username: username,
    serverTimeOffset: serverTimeOffset,
    adminSpeed: adminSpeed,
    doAction: doAction,
    call: call,
    openPlayerProfile: openPlayerProfile
  }));
}
function NoGuild() {
  const {
    doAction,
    call
  } = useGame();
  const nameRef = useRef(null),
    tagRef = useRef(null);
  function submit(e) {
    e.preventDefault();
    const name = nameRef.current.value.trim(),
      tag = tagRef.current.value.trim();
    if (!name || !tag) return;
    doAction(() => call("/api/guild/create", "POST", {
      name,
      tag
    }), "👥 Guilde fondée !", null);
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "\uD83D\uDC65 Guilde"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Rejoignez ou fondez une guilde pour construire un Hall de guilde dans votre village : il permet de donner des ressources \xE0 la guilde pour obtenir un bonus de production partag\xE9 par tous ses membres."), /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\u2795 Fonder une guilde"), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "small"
  }, "Nom", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("input", {
    type: "text",
    ref: nameRef,
    maxLength: 30,
    placeholder: "Les Braves"
  })), /*#__PURE__*/React.createElement("label", {
    className: "small"
  }, "Tag", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("input", {
    type: "text",
    ref: tagRef,
    maxLength: 6,
    placeholder: "BRV",
    style: {
      width: 80,
      textTransform: "uppercase"
    }
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "primary"
  }, "Fonder"))), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Si un chef de guilde vous a invit\xE9, vous trouverez son invitation dans l'onglet ", /*#__PURE__*/React.createElement("b", null, "Rapports"), " (cat\xE9gorie \xAB Guilde \xBB), avec un bouton pour l'accepter ou la refuser."));
}
function OverviewBox({
  g,
  v,
  username,
  serverTimeOffset,
  adminSpeed,
  doAction,
  call,
  openPlayerProfile
}) {
  const hallLvl = v.buildings.guildHall || 0;
  const b = BUILDINGS.guildHall;
  const nextLevel = hallLvl + 1;
  const maxed = nextLevel > b.max;
  const lockedReq = b.requires && Object.entries(b.requires).some(([rk, rv]) => (v.buildings[rk] || 0) < rv);
  const cost = maxed ? null : buildCost("guildHall", nextLevel);
  const time = maxed ? null : vBuildTime(v, "guildHall", nextLevel, adminSpeed);
  const affordable = cost && canAffordAll({
    village: v
  }, cost);
  const pendingHall = v.buildQueue.filter(o => o.key === "guildHall").length;
  const donateWood = useRef(null),
    donateClay = useRef(null),
    donateIron = useRef(null);
  const inviteRef = useRef(null);
  function buildHall() {
    doAction(() => call("/api/build", "POST", {
      key: "guildHall"
    }), "Construction ajoutée : " + b.name + " niveau " + nextLevel, "buildQueued");
  }
  function donate() {
    const wood = Number(donateWood.current.value) || 0,
      clay = Number(donateClay.current.value) || 0,
      iron = Number(donateIron.current.value) || 0;
    if (!wood && !clay && !iron) return;
    doAction(() => call("/api/guild/donate", "POST", {
      wood,
      clay,
      iron
    }), "🎁 Don envoyé à la guilde !", null);
  }
  function invite(e) {
    e.preventDefault();
    const u = inviteRef.current.value.trim();
    if (!u) return;
    doAction(() => call("/api/guild/invite", "POST", {
      username: u
    }), "✉️ Invitation envoyée à " + u + ".", null);
    inviteRef.current.value = "";
  }
  function kick(m) {
    doAction(() => call("/api/guild/kick", "POST", {
      username: m
    }), m + " exclu de la guilde.", null);
  }
  function leave() {
    if (!confirm("Quitter la guilde ?")) return;
    doAction(() => call("/api/guild/leave", "POST"), "Vous avez quitté la guilde.", null);
  }
  function disband() {
    if (!confirm("Dissoudre définitivement la guilde pour tous les membres ?")) return;
    doAction(() => call("/api/guild/disband", "POST"), "Guilde dissoute.", null);
  }
  const donorTotalsSorted = Object.entries(g.donorTotals || {}).sort((a, b2) => b2[1] - a[1]);
  const now = estimateNow(serverTimeOffset);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83D\uDC65 Membres (", g.members.length, ")"), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Pseudo"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, g.members.map(m => /*#__PURE__*/React.createElement("tr", {
    key: m
  }, /*#__PURE__*/React.createElement("td", {
    className: "player-link",
    onClick: () => openPlayerProfile(m)
  }, m, m === g.leader ? /*#__PURE__*/React.createElement("span", {
    className: "tag strong"
  }, " CHEF") : null, m === username ? " (vous)" : ""), /*#__PURE__*/React.createElement("td", null, g.isLeader && m !== username ? /*#__PURE__*/React.createElement("button", {
    onClick: () => kick(m)
  }, "Exclure") : null)))))), g.isLeader ? /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\u2709\uFE0F Inviter un joueur"), /*#__PURE__*/React.createElement("form", {
    onSubmit: invite,
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    ref: inviteRef,
    placeholder: "Pseudo du joueur"
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "primary"
  }, "Inviter")), g.invites.length ? /*#__PURE__*/React.createElement("p", {
    className: "small muted",
    style: {
      marginTop: 8
    }
  }, "Invitations en attente : ", g.invites.join(", ")) : null) : null, /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83C\uDFDB\uFE0F Hall de guilde ", hallLvl > 0 ? `(niveau ${hallLvl})` : ""), /*#__PURE__*/React.createElement("div", {
    className: "desc"
  }, b.desc), lockedReq ? /*#__PURE__*/React.createElement("div", {
    className: "req-note"
  }, "N\xE9cessite : ", Object.entries(b.requires).map(([rk, rv]) => BUILDINGS[rk].name + " niv. " + rv).join(", ")) : maxed ? /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Niveau maximum atteint.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "cost",
    style: {
      margin: "8px 0"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: v.resources.wood < cost.wood ? "short" : ""
  }, "\uD83E\uDEB5 ", fmt(cost.wood)), /*#__PURE__*/React.createElement("span", {
    className: v.resources.clay < cost.clay ? "short" : ""
  }, "\uD83E\uDDF1 ", fmt(cost.clay)), /*#__PURE__*/React.createElement("span", {
    className: v.resources.iron < cost.iron ? "short" : ""
  }, "\u26CF\uFE0F ", fmt(cost.iron)), /*#__PURE__*/React.createElement("span", null, "\u23F1 ", fmtTime(time))), pendingHall ? /*#__PURE__*/React.createElement("div", {
    className: "unit-note"
  }, pendingHall, " d\xE9j\xE0 en file d'attente") : null, /*#__PURE__*/React.createElement("button", {
    className: "primary",
    disabled: !affordable,
    onClick: buildHall
  }, hallLvl <= 0 ? "Construire" : "Améliorer", " \u2192 niveau ", nextLevel))), hallLvl > 0 ? /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83C\uDF81 Faire un don \xE0 la guilde"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Chaque don augmente d\xE9finitivement le bonus de production de TOUS les membres (plafonn\xE9 \xE0 ", GUILD_MAX_BONUS_PERCENT_CLIENT, "%). Votre Hall de guilde (niveau ", hallLvl, ") limite chaque don \xE0 ", 1000 * hallLvl, " ressources au total."), /*#__PURE__*/React.createElement("div", {
    className: "inputs",
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginBottom: 8
    }
  }, [["wood", donateWood], ["clay", donateClay], ["iron", donateIron]].map(([r, ref]) => {
    // Max "à vue" pour CE champ pris isolément : le plus petit entre ce que le village possède
    // et le plafond du Hall de guilde (1000*niveau) -- ne tient pas compte de ce qui serait
    // rempli simultanément dans les deux autres champs (comme les max de la Caserne/Empire,
    // volontairement indépendants champ par champ plutôt qu'un calcul croisé plus complexe).
    const donateMax = Math.min(Math.floor(v.resources[r] || 0), 1000 * hallLvl);
    return /*#__PURE__*/React.createElement("div", {
      className: "inp",
      key: r
    }, RES_ICON[r], /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "0",
      max: donateMax,
      defaultValue: "0",
      ref: ref
    }), /*#__PURE__*/React.createElement("a", {
      href: "#",
      className: "small",
      style: {
        fontSize: 10,
        marginLeft: 4
      },
      onClick: e => {
        e.preventDefault();
        ref.current.value = donateMax;
      }
    }, "max ", fmt(donateMax)));
  })), /*#__PURE__*/React.createElement("button", {
    className: "primary",
    onClick: donate
  }, "Donner")) : /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Construisez le Hall de guilde ci-dessus pour pouvoir faire des dons."), /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83C\uDF81 Historique des dons"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      flexWrap: "wrap",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "1 1 260px",
      minWidth: 220
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 4
    }
  }, "Dons r\xE9cents"), (g.donations || []).slice(0, 15).length ? (g.donations || []).slice(0, 15).map((d, i) => /*#__PURE__*/React.createElement("div", {
    className: "donation-row",
    key: i
  }, /*#__PURE__*/React.createElement("span", null, d.username), /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "\uD83E\uDEB5", fmt(d.wood), " \uD83E\uDDF1", fmt(d.clay), " \u26CF\uFE0F", fmt(d.iron)), /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, fmtTime(Math.max(0, now - d.time))))) : /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Aucun don pour l'instant.")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "1 1 200px",
      minWidth: 180
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 4
    }
  }, "Total cumul\xE9 par membre"), /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Membre"), /*#__PURE__*/React.createElement("th", null, "Total"))), /*#__PURE__*/React.createElement("tbody", null, donorTotalsSorted.length ? donorTotalsSorted.map(([u, total]) => /*#__PURE__*/React.createElement("tr", {
    key: u
  }, /*#__PURE__*/React.createElement("td", null, u), /*#__PURE__*/React.createElement("td", null, fmt(total)))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "2",
    className: "muted"
  }, "Aucun don pour l'instant."))))))), /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: leave
  }, "\uD83D\uDEAA Quitter la guilde"), g.isLeader ? /*#__PURE__*/React.createElement("button", {
    style: {
      marginLeft: 8
    },
    onClick: disband
  }, "\uD83D\uDCA5 Dissoudre la guilde") : null));
}
function ShopBox({
  g,
  doAction,
  call
}) {
  const activeBoosts = g.activeBoosts || [];
  function buy(key, boost) {
    doAction(() => call("/api/guild/buy-boost", "POST", {
      key
    }), boost ? "🛒 " + boost.icon + " " + boost.name + " activé pour toute la guilde !" : "🛒 Bonus activé.", null);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83D\uDED2 Boutique de guilde"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "D\xE9pensez les ressources de la ", /*#__PURE__*/React.createElement("b", null, "banque de guilde"), " (aliment\xE9e par les dons ci-dessus) pour offrir un bonus temporaire \xE0 TOUS les membres. Banque actuelle : \uD83E\uDEB5", fmt(g.bank.wood), " \uD83E\uDDF1", fmt(g.bank.clay), " \u26CF\uFE0F", fmt(g.bank.iron), "."), activeBoosts.length ? /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      margin: "8px 0"
    }
  }, "Bonus actifs : ", activeBoosts.map(b => `${b.icon} ${b.name} (encore ${fmtTime(b.secondsLeft)})`).join(" · ")) : /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      margin: "8px 0"
    }
  }, "Aucun bonus actif pour l'instant."), /*#__PURE__*/React.createElement("div", {
    className: "shop-grid"
  }, GUILD_BOOSTS.map(b => {
    const active = activeBoosts.find(x => x.key === b.key);
    const affordable = g.bank.wood >= b.cost.wood && g.bank.clay >= b.cost.clay && g.bank.iron >= b.cost.iron;
    return /*#__PURE__*/React.createElement("div", {
      className: "shop-card" + (active ? " active" : ""),
      key: b.key
    }, /*#__PURE__*/React.createElement("h4", null, b.icon, " ", b.name), /*#__PURE__*/React.createElement("div", {
      className: "small muted",
      style: {
        marginBottom: 6
      }
    }, b.desc), /*#__PURE__*/React.createElement("div", {
      className: "cost small",
      style: {
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: g.bank.wood < b.cost.wood ? "short" : ""
    }, "\uD83E\uDEB5 ", fmt(b.cost.wood)), /*#__PURE__*/React.createElement("span", {
      className: g.bank.clay < b.cost.clay ? "short" : ""
    }, "\uD83E\uDDF1 ", fmt(b.cost.clay)), /*#__PURE__*/React.createElement("span", {
      className: g.bank.iron < b.cost.iron ? "short" : ""
    }, "\u26CF\uFE0F ", fmt(b.cost.iron))), g.isLeader ? /*#__PURE__*/React.createElement("button", {
      className: "primary",
      disabled: !affordable,
      onClick: () => buy(b.key, b)
    }, active ? "Racheter (prolonger)" : "Acheter") : /*#__PURE__*/React.createElement("p", {
      className: "muted small"
    }, "Seul le chef de guilde peut acheter dans la boutique."));
  })));
}
function DiplomacyBox({
  g,
  doAction,
  call
}) {
  const [directory, setDirectory] = useState(null);
  const selectRef = useRef(null);
  async function refreshDirectory() {
    try {
      const data = await call("/api/guilds", "GET");
      setDirectory(data.guilds);
    } catch (err) {}
  }
  useEffect(() => {
    if (g.isLeader && directory === null) refreshDirectory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.isLeader]);
  function cancel(relationId) {
    if (!confirm("Confirmer ?")) return;
    doAction(() => call("/api/guild/diplomacy/cancel", "POST", {
      relationId
    }), "Relation mise à jour.", null);
  }
  function respond(relationId, accept) {
    doAction(() => call("/api/guild/diplomacy/respond", "POST", {
      relationId,
      accept
    }), accept ? "🕊️ Proposition acceptée." : "Proposition refusée.", null);
  }
  function propose(type) {
    const val = selectRef.current && selectRef.current.value;
    if (!val) return;
    doAction(() => call("/api/guild/diplomacy/propose", "POST", {
      targetGuildId: val,
      type
    }), "🕊️ Proposition envoyée.", null);
  }
  function declareWar() {
    const val = selectRef.current && selectRef.current.value;
    if (!val) return;
    if (!confirm("Déclarer la guerre à cette guilde ?")) return;
    doAction(() => call("/api/guild/diplomacy/declare-war", "POST", {
      targetGuildId: val
    }), "⚔️ Guerre déclarée.", null);
  }
  const relTypeCls = r => r.type === "war" ? "war" : r.type === "alliance" ? "ally" : "pact";
  const diplomacy = g.diplomacy || [];
  const activeRelations = diplomacy.filter(r => r.status === "active");
  const incomingPending = diplomacy.filter(r => r.status === "pending" && r.direction === "incoming");
  const outgoingPending = diplomacy.filter(r => r.status === "pending" && r.direction === "outgoing");
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83D\uDD4A\uFE0F Diplomatie"), incomingPending.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 4
    }
  }, "Propositions re\xE7ues"), incomingPending.map(r => /*#__PURE__*/React.createElement("div", {
    className: "donation-row",
    key: r.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag pact"
  }, "Re\xE7ue"), /*#__PURE__*/React.createElement("span", null, "[", r.otherGuild.tag, "] ", r.otherGuild.name, " propose ", DIPLOMACY_LABEL_LOWER[r.type]), g.isLeader ? /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("button", {
    className: "primary",
    onClick: () => respond(r.id, true)
  }, "Accepter"), " ", /*#__PURE__*/React.createElement("button", {
    onClick: () => respond(r.id, false)
  }, "Refuser")) : null))) : null, outgoingPending.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 4
    }
  }, "Propositions envoy\xE9es"), outgoingPending.map(r => /*#__PURE__*/React.createElement("div", {
    className: "donation-row",
    key: r.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag pact"
  }, "Envoy\xE9e"), /*#__PURE__*/React.createElement("span", null, "Proposition de ", DIPLOMACY_LABEL_LOWER[r.type], " envoy\xE9e \xE0 [", r.otherGuild.tag, "] ", r.otherGuild.name), g.isLeader ? /*#__PURE__*/React.createElement("button", {
    onClick: () => cancel(r.id)
  }, "Annuler") : null))) : null, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 4
    }
  }, "Relations actives"), activeRelations.length ? activeRelations.map(r => /*#__PURE__*/React.createElement("div", {
    className: "donation-row",
    key: r.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag " + relTypeCls(r)
  }, DIPLOMACY_LABEL[r.type]), /*#__PURE__*/React.createElement("span", null, "[", r.otherGuild.tag, "] ", r.otherGuild.name), g.isLeader ? /*#__PURE__*/React.createElement("button", {
    onClick: () => cancel(r.id)
  }, r.type === "war" ? "🕊️ Faire la paix" : "💔 Rompre") : null)) : /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Aucune relation active pour l'instant.")), g.isLeader ? /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-between",
    style: {
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "\uD83D\uDD4A\uFE0F Proposer une relation"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: "Actualiser la liste des guildes",
    style: {
      padding: "4px 8px"
    },
    onClick: refreshDirectory
  }, "\uD83D\uDD04")), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Un pacte ou une alliance doit \xEAtre accept\xE9 par l'autre chef de guilde. Une d\xE9claration de guerre est imm\xE9diate et unilat\xE9rale. Ces relations sont purement informatives : elles s'affichent sur la carte et avertissent avant une attaque, mais n'emp\xEAchent aucun combat."), directory === null ? /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Chargement de l'annuaire des guildes\u2026") : directory.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Aucune autre guilde dans le monde pour l'instant.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "small"
  }, "Guilde", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("select", {
    ref: selectRef
  }, directory.map(og => /*#__PURE__*/React.createElement("option", {
    key: og.id,
    value: og.id
  }, "[", og.tag, "] ", og.name, " (", og.memberCount, " membre", og.memberCount > 1 ? "s" : "", ")")))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => propose("pact")
  }, "\uD83D\uDD4A\uFE0F Proposer un pacte"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "primary",
    onClick: () => propose("alliance")
  }, "\uD83E\uDD1D Proposer une alliance"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: declareWar
  }, "\u2694\uFE0F D\xE9clarer la guerre"))) : null);
}