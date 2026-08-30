import { useGame } from "../../GameContext.jsx";
import { COMMANDER_BRANCHES, COMMANDER_MAX_TIER, clamp } from "../../gameData.js";

// Porte renderCommander() : arbre de compétences à 3 branches indépendantes (Attaque/Défense/
// Économie), propre au COMPTE (pas au village actif) — voir GameContext pour le détail de
// l'accumulation d'XP côté serveur (grantCommanderXp).
export default function CommanderTab() {
  const {
    snapshot,
    doAction,
    call
  } = useGame();
  const c = snapshot.commander;
  if (!c) {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "\uD83C\uDF96\uFE0F Commandant"), /*#__PURE__*/React.createElement("p", {
      className: "muted"
    }, "Informations de Commandant indisponibles pour le moment."));
  }
  const pct = c.xpToNext > 0 ? clamp(Math.round(c.xp / c.xpToNext * 100), 0, 100) : 0;
  function upgrade(branch) {
    const name = (COMMANDER_BRANCHES[branch] || {}).name || branch;
    doAction(() => call("/api/commander/upgrade", "POST", {
      branch
    }), "🎖️ Palier débloqué : " + name + " !", null);
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "\uD83C\uDF96\uFE0F Commandant"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Votre Commandant est propre \xE0 votre ", /*#__PURE__*/React.createElement("b", null, "compte"), " (pas \xE0 un village pr\xE9cis) : il gagne de l'exp\xE9rience \xE0 chaque combat \u2014 pertes inflig\xE9es \xE0 l'adversaire, aussi bien en attaque qu'en d\xE9fense \u2014 et monte de niveau, ce qui octroie 1 point de comp\xE9tence \xE0 r\xE9partir librement entre 3 branches ind\xE9pendantes. Chaque branche a 4 paliers ; les 3 premiers accordent un bonus progressif, le 4\u1D49 un bonus sp\xE9cial plus marqu\xE9."), /*#__PURE__*/React.createElement("div", {
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
  }, "Niveau ", c.level), /*#__PURE__*/React.createElement("span", {
    className: "small muted"
  }, c.skillPoints, " point(s) de comp\xE9tence disponible(s)")), /*#__PURE__*/React.createElement("div", {
    className: "bar-bg"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar-fill",
    style: {
      width: pct + "%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginTop: 4
    }
  }, c.xp, " / ", c.xpToNext, " XP jusqu'au niveau ", c.level + 1)), /*#__PURE__*/React.createElement("div", {
    className: "cmd-branches"
  }, Object.keys(COMMANDER_BRANCHES).map(bk => /*#__PURE__*/React.createElement(CommanderBranch, {
    key: bk,
    bk: bk,
    c: c,
    onUpgrade: upgrade
  }))));
}
function CommanderBranch({
  bk,
  c,
  onUpgrade
}) {
  const branch = COMMANDER_BRANCHES[bk];
  const cur = c.skills[bk] || 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "cmd-branch"
  }, /*#__PURE__*/React.createElement("h3", null, branch.icon, " ", branch.name, " ", /*#__PURE__*/React.createElement("span", {
    className: "small muted"
  }, "(palier ", cur, "/", COMMANDER_MAX_TIER, ")")), branch.tiers.map((tier, i) => {
    const tierNum = i + 1;
    const unlocked = cur >= tierNum;
    const canUnlock = !unlocked && cur === tierNum - 1 && c.skillPoints > 0;
    const isFinal = tierNum === COMMANDER_MAX_TIER;
    return /*#__PURE__*/React.createElement("div", {
      className: "cmd-tier" + (unlocked ? " unlocked" : "") + (isFinal ? " cmd-tier-final" : ""),
      key: tierNum
    }, /*#__PURE__*/React.createElement("div", {
      className: "cmd-tier-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "cmd-tier-num"
    }, tierNum), /*#__PURE__*/React.createElement("span", {
      className: "cmd-tier-desc"
    }, tier.desc)), unlocked ? /*#__PURE__*/React.createElement("span", {
      className: "cmd-tier-status cmd-status-done"
    }, "\u2705 Acquis") : canUnlock ? /*#__PURE__*/React.createElement("button", {
      onClick: () => onUpgrade(bk)
    }, "\uD83D\uDD13 D\xE9bloquer (1 pt)") : /*#__PURE__*/React.createElement("span", {
      className: "cmd-tier-status muted small"
    }, "\uD83D\uDD12 Verrouill\xE9"));
  }));
}