import { useGame } from "../GameContext.jsx";
import { useTheme } from "../useTheme.js";
import SvgTexDefs from "./SvgTexDefs.jsx";
import TopBar from "./TopBar.jsx";
import Sidebar from "./Sidebar.jsx";
import TabNav from "./TabNav.jsx";
import ChatWidget from "./ChatWidget.jsx";
import BattleBanner from "./BattleBanner.jsx";
import BuildingsTab from "./tabs/BuildingsTab.jsx";
import FarmTab from "./tabs/FarmTab.jsx";
import BarracksTab from "./tabs/BarracksTab.jsx";
import CommanderTab from "./tabs/CommanderTab.jsx";
import MapTab from "./tabs/MapTab.jsx";
import PlaceholderTab from "./tabs/PlaceholderTab.jsx";
import VillageActionModal from "./VillageActionModal.jsx";
import PlayerProfileModal from "./PlayerProfileModal.jsx";
import GuildTab from "./tabs/GuildTab.jsx";
import MarketTab from "./tabs/MarketTab.jsx";
import LeaderboardTab from "./tabs/LeaderboardTab.jsx";
import ReportsTab from "./tabs/ReportsTab.jsx";
import EmpireTab from "./tabs/EmpireTab.jsx";
import InformationTab from "./tabs/InformationTab.jsx";
import TutorialModal from "./TutorialModal.jsx";
const PLACEHOLDER_LABELS = {};
export default function GameScreen() {
  const {
    snapshot,
    activeTab,
    setActiveTab
  } = useGame();
  const {
    theme,
    toggle: toggleTheme
  } = useTheme();
  if (!snapshot) return null;
  function gotoTab(tab) {
    setActiveTab(tab);
  }
  let content;
  if (activeTab === "buildings") content = /*#__PURE__*/React.createElement(BuildingsTab, {
    onGotoTab: gotoTab
  });else if (activeTab === "farm") content = /*#__PURE__*/React.createElement(FarmTab, null);else if (activeTab === "barracks") content = /*#__PURE__*/React.createElement(BarracksTab, null);else if (activeTab === "commander") content = /*#__PURE__*/React.createElement(CommanderTab, null);else if (activeTab === "map") content = /*#__PURE__*/React.createElement(MapTab, null);else if (activeTab === "guild") content = /*#__PURE__*/React.createElement(GuildTab, null);else if (activeTab === "market") content = /*#__PURE__*/React.createElement(MarketTab, null);else if (activeTab === "leaderboard") content = /*#__PURE__*/React.createElement(LeaderboardTab, null);else if (activeTab === "reports") content = /*#__PURE__*/React.createElement(ReportsTab, null);else if (activeTab === "empire") content = /*#__PURE__*/React.createElement(EmpireTab, null);else if (activeTab === "information") content = /*#__PURE__*/React.createElement(InformationTab, null);else content = /*#__PURE__*/React.createElement(PlaceholderTab, {
    label: PLACEHOLDER_LABELS[activeTab] || activeTab
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SvgTexDefs, null), /*#__PURE__*/React.createElement("div", {
    id: "gameRoot"
  }, /*#__PURE__*/React.createElement("header", {
    className: "top-banner"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 64 76",
    xmlns: "http://www.w3.org/2000/svg"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M32 3 L59 13 L59 37 C59 59 46 69 32 75 C18 69 5 59 5 37 L5 13 Z",
    fill: "var(--panel2)",
    stroke: "var(--gold)",
    strokeWidth: "3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "30",
    y1: "28",
    x2: "30",
    y2: "11",
    stroke: "var(--gold)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("polygon", {
    points: "30,11 45,16.5 30,22",
    fill: "var(--red)"
  }), /*#__PURE__*/React.createElement("polygon", {
    points: "19,40 19,32 23,32 23,28 27,28 27,32 33,32 33,28 37,28 37,32 41,32 41,40",
    fill: "var(--gold)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "19",
    y: "40",
    width: "22",
    height: "22",
    fill: "var(--gold)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "26",
    y: "52",
    width: "8",
    height: "10",
    fill: "var(--panel2)"
  })), /*#__PURE__*/React.createElement("span", {
    className: "brand-name"
  }, "Conqu\xEAte Tribale")), /*#__PURE__*/React.createElement("div", {
    className: "app-shell"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "side-nav"
  }, /*#__PURE__*/React.createElement(TabNav, {
    activeTab: activeTab,
    setActiveTab: setActiveTab
  })), /*#__PURE__*/React.createElement("div", {
    id: "app"
  }, /*#__PURE__*/React.createElement(TopBar, null), /*#__PURE__*/React.createElement("div", {
    className: "layout"
  }, /*#__PURE__*/React.createElement("main", {
    id: "tabContent"
  }, content), /*#__PURE__*/React.createElement(Sidebar, {
    openHelpBlackArmy: () => setActiveTab("information")
  })), /*#__PURE__*/React.createElement("footer", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", null, "Conqu\xEAte Tribale \u2014 monde partag\xE9 en temps r\xE9el. Votre progression est sauvegard\xE9e automatiquement sur le serveur."), /*#__PURE__*/React.createElement("button", {
    className: "theme-toggle-btn",
    title: "Changer l'apparence du jeu",
    onClick: toggleTheme
  }, theme === "maquette" ? "📜 Thème : Parchemin" : "🪵 Thème : Bois sombre"))))), /*#__PURE__*/React.createElement(BattleBanner, null), /*#__PURE__*/React.createElement(ChatWidget, null), /*#__PURE__*/React.createElement(VillageActionModal, {
    onGotoTab: gotoTab
  }), /*#__PURE__*/React.createElement(PlayerProfileModal, null), /*#__PURE__*/React.createElement(TutorialModal, null));
}