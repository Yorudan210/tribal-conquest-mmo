import { useState } from "react";
import { useGame } from "../../GameContext.jsx";
import { fmt } from "../../formulas.js";
import { ACHIEVEMENT_TIER_LABELS, clamp } from "../../gameData.js";
import { helpSections } from "../../legacy/helpContent.js";
import { ChangelogCards } from "../AuthScreen.jsx";
import AdminPanel from "./AdminPanel.jsx";
const ACHIEVEMENT_TIER_COLORS = ["#a9895f", "#cd7f32", "#c0c0c0", "#e0b83c"];

// Porte renderInformation() (index.html ~5384-5439) : regroupe Aide / Succès / Admin (si admin) /
// Mises à jour derrière une petite navigation secondaire (infoSubTab, ici un simple useState local --
// ce n'est qu'une page consultée ponctuellement, pas un outil de jeu courant comme les autres onglets).
export default function InformationTab() {
  const {
    snapshot,
    replayTutorial,
    doAction,
    call
  } = useGame();
  const [subTab, setSubTab] = useState("help");
  const achievementPoints = (snapshot.achievements || []).reduce((s, a) => s + a.points, 0);
  const tabs = [["help", "❓ Aide"], ["achievements", "🎖️ Succès (" + achievementPoints + " pts)"]];
  if (snapshot.isAdmin) tabs.push(["admin", "🛠️ Admin"]);
  tabs.push(["changelog", "🗞️ Mises à jour"]);
  const active = tabs.some(([k]) => k === subTab) ? subTab : "help";
  let content;
  if (active === "achievements") content = /*#__PURE__*/React.createElement(AchievementsBox, {
    achievements: snapshot.achievements || []
  });else if (active === "admin" && snapshot.isAdmin) content = /*#__PURE__*/React.createElement(AdminPanel, null);else if (active === "changelog") content = /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640
    }
  }, /*#__PURE__*/React.createElement(ChangelogCards, null));else content = /*#__PURE__*/React.createElement(HelpBox, {
    isAdmin: snapshot.isAdmin,
    replayTutorial: replayTutorial,
    doAction: doAction,
    call: call
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 16
    }
  }, tabs.map(([k, label]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: active === k ? "primary" : "",
    onClick: () => setSubTab(k)
  }, label))), content);
}
function HelpBox({
  isAdmin,
  replayTutorial,
  doAction,
  call
}) {
  const sections = helpSections("⛏️");
  const [openSet, setOpenSet] = useState(() => new Set([0]));
  function toggle(i) {
    setOpenSet(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "Aide & r\xE8gles du jeu"), /*#__PURE__*/React.createElement("div", {
    className: "flex-between",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0
    }
  }, "Conqu\xEAte Tribale est un jeu de gestion de village m\xE9di\xE9val type ", /*#__PURE__*/React.createElement("i", null, "Tribal Wars"), ", qui tourne d\xE9sormais dans un ", /*#__PURE__*/React.createElement("b", null, "monde partag\xE9 en temps r\xE9el"), " : les autres joueurs sont de vraies personnes, connect\xE9es avec leur propre compte, et vous pouvez les attaquer comme ils peuvent vous attaquer. Les \xAB villages barbares \xBB de la carte restent contr\xF4l\xE9s par le jeu et servent de cibles faciles pour d\xE9marrer."), /*#__PURE__*/React.createElement("button", {
    onClick: replayTutorial
  }, "\uD83D\uDD30 Revoir le tutoriel")), /*#__PURE__*/React.createElement("div", {
    className: "accordion"
  }, sections.map((sec, i) => {
    const open = openSet.has(i);
    return /*#__PURE__*/React.createElement("div", {
      className: "acc-item" + (open ? " open" : ""),
      key: i,
      id: sec.id
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "acc-head",
      "aria-expanded": open,
      onClick: () => toggle(i)
    }, /*#__PURE__*/React.createElement("span", null, sec.title), /*#__PURE__*/React.createElement("span", {
      className: "chev"
    }, "\u2304")), /*#__PURE__*/React.createElement("div", {
      className: "acc-body-wrap"
    }, /*#__PURE__*/React.createElement("div", {
      className: "acc-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "acc-body-inner",
      dangerouslySetInnerHTML: {
        __html: sec.html
      }
    }))));
  })), !isAdmin && /*#__PURE__*/React.createElement("div", {
    className: "box",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83D\uDD11 Devenir administrateur"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Si vous disposez du code d'acc\xE8s administrateur, saisissez-le ici pour d\xE9bloquer le panneau d'administration sur votre compte."), /*#__PURE__*/React.createElement("form", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    },
    onSubmit: e => {
      e.preventDefault();
      const inp = document.getElementById("adminClaimCode");
      const code = inp.value;
      doAction(() => call("/api/admin/claim", "POST", {
        code
      }), "🛠️ Accès administrateur accordé !", null).then(() => {
        inp.value = "";
      }).catch(() => {});
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    id: "adminClaimCode",
    placeholder: "Code administrateur",
    style: {
      flex: "1 1 200px"
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "primary"
  }, "Valider"))));
}
function AchievementsBox({
  achievements
}) {
  const totalPoints = achievements.reduce((s, a) => s + a.points, 0);
  const maxPoints = achievements.length * 10;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "\uD83C\uDF96\uFE0F Succ\xE8s"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, totalPoints, "/", maxPoints, " points de succ\xE8s \u2014 m\xEAmes cat\xE9gories et paliers (Bois/Bronze/Argent/Or) que le jeu officiel, purement indicatifs (pas de r\xE9compense)."), /*#__PURE__*/React.createElement("div", {
    className: "grid-buildings"
  }, achievements.map((a, i) => {
    const tierLabel = a.tier > 0 ? ACHIEVEMENT_TIER_LABELS[a.tier - 1] : null;
    const floorValue = a.tier > 0 ? a.tiers[a.tier - 1] : 0;
    const progressPct = a.nextThreshold != null ? clamp(100 * (a.value - floorValue) / (a.nextThreshold - floorValue), 0, 100) : 100;
    return /*#__PURE__*/React.createElement("div", {
      className: "card" + (a.tier >= 4 ? " quest-done" : ""),
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      className: "card-head"
    }, /*#__PURE__*/React.createElement("div", {
      className: "icon-mini shop-icon"
    }, a.icon), /*#__PURE__*/React.createElement("h4", null, a.name, /*#__PURE__*/React.createElement("span", {
      className: "small muted",
      style: {
        fontWeight: "normal"
      }
    }, tierLabel ? "Palier " + tierLabel : "Non débuté"))), /*#__PURE__*/React.createElement("div", {
      className: "desc"
    }, a.desc), /*#__PURE__*/React.createElement("div", {
      className: "bar-bg",
      style: {
        margin: "8px 0 4px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "bar-fill",
      style: {
        width: progressPct + "%"
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "small muted flex-between"
    }, /*#__PURE__*/React.createElement("span", null, fmt(a.value), a.nextThreshold != null ? " / " + fmt(a.nextThreshold) : " — maximum atteint"), /*#__PURE__*/React.createElement("span", null, a.tiers.map((t, ti) => {
      const reached = a.tier > ti;
      return /*#__PURE__*/React.createElement("span", {
        key: ti,
        className: "tier-pip" + (reached ? " reached" : ""),
        style: reached ? {
          background: ACHIEVEMENT_TIER_COLORS[ti]
        } : undefined,
        title: ACHIEVEMENT_TIER_LABELS[ti] + " — " + fmt(t)
      });
    }))));
  })));
}