import { useGame } from "../../GameContext.jsx";
import { rankCell } from "../../legacy/art.js";

// Porte renderLeaderboard().
export default function LeaderboardTab() {
  const {
    snapshot,
    username,
    openPlayerProfile
  } = useGame();
  const rows = snapshot.leaderboard;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "\uD83C\uDFC6 Classement"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Les meilleurs joueurs du monde, class\xE9s par points (somme des niveaux de TOUTES les constructions sur TOUS les villages poss\xE9d\xE9s \xD710 + conqu\xEAtes r\xE9alis\xE9es \xD750)."), /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "#"), /*#__PURE__*/React.createElement("th", null, "Joueur"), /*#__PURE__*/React.createElement("th", null, "Villages"), /*#__PURE__*/React.createElement("th", null, "Guilde"), /*#__PURE__*/React.createElement("th", null, "Points"))), /*#__PURE__*/React.createElement("tbody", null, rows.length ? rows.map((p, i) => /*#__PURE__*/React.createElement("tr", {
    key: p.username,
    style: p.username === username ? {
      background: "rgba(193,121,62,0.14)"
    } : undefined
  }, /*#__PURE__*/React.createElement("td", {
    dangerouslySetInnerHTML: {
      __html: rankCell(i + 1)
    }
  }), /*#__PURE__*/React.createElement("td", {
    className: "player-link",
    onClick: () => openPlayerProfile(p.username)
  }, p.username, p.username === username ? " (vous)" : ""), /*#__PURE__*/React.createElement("td", null, p.villageCount), /*#__PURE__*/React.createElement("td", null, p.guild ? `[${p.guild.tag}] ${p.guild.name}` : /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "\u2014")), /*#__PURE__*/React.createElement("td", null, p.points))) : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "5",
    className: "muted"
  }, "Aucun joueur pour l'instant."))))));
}