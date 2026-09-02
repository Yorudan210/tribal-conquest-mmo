import { useGame } from "../GameContext.jsx";
import { RES_ICON } from "../formulas.js";

// Porte renderPlayerProfile() : fiche joueur détaillée (guilde, points, villages, actions), ouverte
// depuis la liste des membres de guilde, le Classement, ou un pseudo cliqué dans le chat -- voir
// GameContext (playerProfile/openPlayerProfile/closePlayerProfile/goToVillageOnMap).
export default function PlayerProfileModal() {
  const {
    snapshot,
    username,
    playerProfile: p,
    closePlayerProfile,
    goToVillageOnMap,
    doAction,
    call
  } = useGame();
  if (!p) return null;
  const isSelf = p.username === username;
  const canAct = !isSelf && p.homeVillageId != null;
  function onBackdropClick(e) {
    if (e.target.id === "playerProfileBackdrop") closePlayerProfile();
  }
  function sendGift() {
    const amt = {};
    let any = false;
    for (const r of ["wood", "clay", "iron"]) {
      const el = document.getElementById("profileGift_" + r);
      if (!el) continue;
      let n = Math.floor(Number(el.value) || 0);
      n = Math.max(0, Math.min(n, Math.floor(snapshot.village.resources[r] || 0)));
      if (n > 0) {
        amt[r] = n;
        any = true;
      }
    }
    if (!any) return;
    doAction(() => call("/api/gift", "POST", {
      username: p.username,
      wood: amt.wood || 0,
      clay: amt.clay || 0,
      iron: amt.iron || 0
    }), "🎁 Don envoyé à " + p.username + ".", null);
    closePlayerProfile();
  }
  function goToVillage() {
    closePlayerProfile();
    goToVillageOnMap(p.homeVillageId);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "tutorial-backdrop",
    id: "playerProfileBackdrop",
    onClick: onBackdropClick
  }, /*#__PURE__*/React.createElement("div", {
    className: "tutorial-card",
    style: {
      maxWidth: 360
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-between",
    style: {
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "\uD83D\uDC64 ", p.isAdmin ? /*#__PURE__*/React.createElement("span", {
    className: "admin-name"
  }, p.username) : p.username, isSelf ? " (vous)" : ""), /*#__PURE__*/React.createElement("button", {
    title: "Fermer",
    style: {
      padding: "4px 8px"
    },
    onClick: closePlayerProfile
  }, "\u2716")), /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      margin: "10px 0",
      lineHeight: 1.6
    }
  }, "\uD83D\uDC65 ", p.guild ? `Guilde : [${p.guild.tag}] ${p.guild.name}${p.guild.isLeader ? " (chef)" : ""}` : "Aucune guilde", /*#__PURE__*/React.createElement("br", null), "\uD83C\uDFC6 Points : ", p.points, " (niveau total des constructions ", p.buildingLevels, " sur ", p.villageCount, " village", p.villageCount > 1 ? "s" : "", ", H\xF4tel de ville capitale niv. ", p.hq, ", ", p.conquered, " conqu\xEAte", p.conquered > 1 ? "s" : "", ")", /*#__PURE__*/React.createElement("br", null), "\uD83C\uDFF0 ", p.villageCount, " village", p.villageCount > 1 ? "s" : "", p.homeCoord ? " · capitale à " + p.homeCoord : ""), p.villages && p.villages.length ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      margin: "4px 0 6px"
    }
  }, "Villages (clic pour voir sur la carte) :"), /*#__PURE__*/React.createElement("div", {
    className: "profile-village-list",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
      maxHeight: 160,
      overflowY: "auto",
      marginBottom: 10
    }
  }, p.villages.map(v => /*#__PURE__*/React.createElement("button", {
    key: v.id,
    className: "profile-village-row",
    style: {
      textAlign: "left",
      display: "flex",
      justifyContent: "space-between",
      gap: 8,
      padding: "6px 8px"
    },
    onClick: () => {
      closePlayerProfile();
      goToVillageOnMap(v.id);
    }
  }, /*#__PURE__*/React.createElement("span", null, v.isHome ? "👑 " : "🏰 ", v.name), /*#__PURE__*/React.createElement("span", {
    className: "muted small"
  }, v.x, "|", v.y))))) : null, /*#__PURE__*/React.createElement("div", {
    className: "player-card-actions",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, isSelf ? /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "C'est vous !") : !canAct ? /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Aucune action disponible (village introuvable).") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "send-form open"
  }, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 6
    }
  }, "\uD83C\uDF81 Envoyer des ressources (livr\xE9 \xE0 sa capitale)"), /*#__PURE__*/React.createElement("div", {
    className: "inputs",
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, ["wood", "clay", "iron"].map(r => {
    const giftMax = Math.floor(snapshot.village.resources[r] || 0);
    return /*#__PURE__*/React.createElement("div", {
      className: "inp",
      key: r
    }, RES_ICON[r], /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "0",
      max: giftMax,
      defaultValue: "0",
      id: "profileGift_" + r
    }), /*#__PURE__*/React.createElement("a", {
      href: "#",
      style: {
        fontSize: 10
      },
      onClick: e => {
        e.preventDefault();
        document.getElementById("profileGift_" + r).value = giftMax;
      }
    }, "max ", giftMax));
  })), /*#__PURE__*/React.createElement("button", {
    onClick: sendGift
  }, "\uD83C\uDF81 Envoyer")), /*#__PURE__*/React.createElement("button", {
    className: "primary",
    onClick: goToVillage
  }, "\uD83D\uDD2D Espionner / voir sur la carte")))));
}