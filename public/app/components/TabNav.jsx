import { useGame } from "../GameContext.jsx";

// Porte renderTabs() : liste des onglets (avec leurs badges dynamiques) + bouton actif.
export default function TabNav({
  activeTab,
  setActiveTab
}) {
  const {
    snapshot
  } = useGame();
  const s = snapshot;
  const tabs = [["buildings", "🏗️ Bâtiments"], ["barracks", "⚔️ Caserne"], ["commander", "🎖️ Commandant" + (s.commander ? " (niv. " + s.commander.level + ")" : "")], ["map", "🗺️ Carte"], ["farm", "🌾 Pillage"], ["guild", "👥 Guilde" + (s.guild ? " — " + s.guild.tag : "")], ["market", "🏪 Marché" + ((s.market || []).length ? " (" + s.market.length + ")" : "")], ["leaderboard", "🏆 Classement"], ["reports", "📜 Rapports (" + s.reports.length + ")"]];
  if (s.myVillages && s.myVillages.length >= 2) tabs.push(["empire", "🏰 Empire (" + s.myVillages.length + ")"]);
  tabs.push(["information", "ℹ️ Informations"]);
  return /*#__PURE__*/React.createElement("nav", {
    id: "tabs"
  }, tabs.map(([key, label]) => /*#__PURE__*/React.createElement("button", {
    key: key,
    className: activeTab === key ? "active" : "",
    onClick: () => setActiveTab(key)
  }, label)));
}