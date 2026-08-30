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

export default function GameScreen(){
  const { snapshot, activeTab, setActiveTab } = useGame();
  const { theme, toggle: toggleTheme } = useTheme();

  if(!snapshot) return null;

  function gotoTab(tab){ setActiveTab(tab); }

  let content;
  if(activeTab==="buildings") content = <BuildingsTab onGotoTab={gotoTab} />;
  else if(activeTab==="farm") content = <FarmTab />;
  else if(activeTab==="barracks") content = <BarracksTab />;
  else if(activeTab==="commander") content = <CommanderTab />;
  else if(activeTab==="map") content = <MapTab />;
  else if(activeTab==="guild") content = <GuildTab />;
  else if(activeTab==="market") content = <MarketTab />;
  else if(activeTab==="leaderboard") content = <LeaderboardTab />;
  else if(activeTab==="reports") content = <ReportsTab />;
  else if(activeTab==="empire") content = <EmpireTab />;
  else if(activeTab==="information") content = <InformationTab />;
  else content = <PlaceholderTab label={PLACEHOLDER_LABELS[activeTab] || activeTab} />;

  return (
    <>
      <SvgTexDefs />
      <div id="gameRoot">
        <header className="top-banner">
          <svg viewBox="0 0 64 76" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 3 L59 13 L59 37 C59 59 46 69 32 75 C18 69 5 59 5 37 L5 13 Z" fill="var(--panel2)" stroke="var(--gold)" strokeWidth="3"/>
            <line x1="30" y1="28" x2="30" y2="11" stroke="var(--gold)" strokeWidth="2"/>
            <polygon points="30,11 45,16.5 30,22" fill="var(--red)"/>
            <polygon points="19,40 19,32 23,32 23,28 27,28 27,32 33,32 33,28 37,28 37,32 41,32 41,40" fill="var(--gold)"/>
            <rect x="19" y="40" width="22" height="22" fill="var(--gold)"/>
            <rect x="26" y="52" width="8" height="10" fill="var(--panel2)"/>
          </svg>
          <span className="brand-name">Conquête Tribale</span>
        </header>
        <div className="app-shell">
          <aside className="side-nav">
            <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />
          </aside>
          <div id="app">
            <TopBar />
            <div className="layout">
              <main id="tabContent">{content}</main>
              <Sidebar openHelpBlackArmy={()=>setActiveTab("information")} />
            </div>
            <footer style={{display:"flex", flexDirection:"column", alignItems:"center", gap:8}}>
              <span>Conquête Tribale — monde partagé en temps réel. Votre progression est sauvegardée automatiquement sur le serveur.</span>
              <button className="theme-toggle-btn" title="Changer l'apparence du jeu" onClick={toggleTheme}>
                {theme==="maquette" ? "📜 Thème : Parchemin" : "🪵 Thème : Bois sombre"}
              </button>
            </footer>
          </div>
        </div>
      </div>
      <BattleBanner />
      <ChatWidget />
      <VillageActionModal onGotoTab={gotoTab} />
      <PlayerProfileModal />
      <TutorialModal />
    </>
  );
}
