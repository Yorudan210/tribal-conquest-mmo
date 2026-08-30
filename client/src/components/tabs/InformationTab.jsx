import { useState } from "react";
import { useGame } from "../../GameContext.jsx";
import { fmt } from "../../formulas.js";
import { ACHIEVEMENT_TIER_LABELS, clamp } from "../../gameData.js";
import { helpBodyHtml } from "../../legacy/helpContent.js";
import { ChangelogCards } from "../AuthScreen.jsx";
import AdminPanel from "./AdminPanel.jsx";

const ACHIEVEMENT_TIER_COLORS = ["#a9895f","#cd7f32","#c0c0c0","#e0b83c"];

// Porte renderInformation() (index.html ~5384-5439) : regroupe Aide / Succès / Admin (si admin) /
// Mises à jour derrière une petite navigation secondaire (infoSubTab, ici un simple useState local --
// ce n'est qu'une page consultée ponctuellement, pas un outil de jeu courant comme les autres onglets).
export default function InformationTab(){
  const { snapshot, replayTutorial, doAction, call } = useGame();
  const [subTab, setSubTab] = useState("help");

  const achievementPoints = (snapshot.achievements||[]).reduce((s,a)=>s+a.points, 0);
  const tabs = [["help","❓ Aide"],["achievements","🎖️ Succès ("+achievementPoints+" pts)"]];
  if(snapshot.isAdmin) tabs.push(["admin","🛠️ Admin"]);
  tabs.push(["changelog","🗞️ Mises à jour"]);
  const active = tabs.some(([k])=>k===subTab) ? subTab : "help";

  let content;
  if(active==="achievements") content = <AchievementsBox achievements={snapshot.achievements||[]} />;
  else if(active==="admin" && snapshot.isAdmin) content = <AdminPanel />;
  else if(active==="changelog") content = <div style={{maxWidth:640}}><ChangelogCards /></div>;
  else content = <HelpBox isAdmin={snapshot.isAdmin} replayTutorial={replayTutorial} doAction={doAction} call={call} />;

  return (
    <div>
      <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:16}}>
        {tabs.map(([k,label]) => (
          <button key={k} className={active===k?"primary":""} onClick={()=>setSubTab(k)}>{label}</button>
        ))}
      </div>
      {content}
    </div>
  );
}

function HelpBox({ isAdmin, replayTutorial, doAction, call }){
  return (
    <div>
      <h2>Aide &amp; règles du jeu</h2>
      <div className="flex-between" style={{marginBottom:10}}>
        <p style={{margin:0}}>Conquête Tribale est un jeu de gestion de village médiéval type <i>Tribal Wars</i>, qui tourne désormais dans un <b>monde partagé en temps réel</b> : les autres joueurs sont de vraies personnes, connectées avec leur propre compte, et vous pouvez les attaquer comme ils peuvent vous attaquer. Les « villages barbares » de la carte restent contrôlés par le jeu et servent de cibles faciles pour démarrer.</p>
        <button onClick={replayTutorial}>🔰 Revoir le tutoriel</button>
      </div>
      <div dangerouslySetInnerHTML={{__html: helpBodyHtml("⛏️")}} />
      {!isAdmin && (
        <div className="box" style={{marginTop:16}}>
          <h3>🔑 Devenir administrateur</h3>
          <p className="small muted">Si vous disposez du code d'accès administrateur, saisissez-le ici pour débloquer le panneau d'administration sur votre compte.</p>
          <form style={{display:"flex", gap:8, flexWrap:"wrap"}} onSubmit={e=>{
            e.preventDefault();
            const inp = document.getElementById("adminClaimCode");
            const code = inp.value;
            doAction(()=>call("/api/admin/claim","POST",{code}), "🛠️ Accès administrateur accordé !", null)
              .then(()=>{ inp.value=""; }).catch(()=>{});
          }}>
            <input type="password" id="adminClaimCode" placeholder="Code administrateur" style={{flex:"1 1 200px"}} />
            <button type="submit" className="primary">Valider</button>
          </form>
        </div>
      )}
    </div>
  );
}

function AchievementsBox({ achievements }){
  const totalPoints = achievements.reduce((s,a)=>s+a.points, 0);
  const maxPoints = achievements.length*10;
  return (
    <div>
      <h2>🎖️ Succès</h2>
      <p className="muted small">{totalPoints}/{maxPoints} points de succès — mêmes catégories et paliers (Bois/Bronze/Argent/Or) que le jeu officiel, purement indicatifs (pas de récompense).</p>
      <div className="grid-buildings">
        {achievements.map((a,i) => {
          const tierLabel = a.tier>0 ? ACHIEVEMENT_TIER_LABELS[a.tier-1] : null;
          const floorValue = a.tier>0 ? a.tiers[a.tier-1] : 0;
          const progressPct = a.nextThreshold!=null ? clamp(100*(a.value-floorValue)/(a.nextThreshold-floorValue), 0, 100) : 100;
          return (
            <div className={"card"+(a.tier>=4?" quest-done":"")} key={i}>
              <div className="card-head">
                <div className="icon-mini shop-icon">{a.icon}</div>
                <h4>{a.name}<span className="small muted" style={{fontWeight:"normal"}}>{tierLabel ? ("Palier "+tierLabel) : "Non débuté"}</span></h4>
              </div>
              <div className="desc">{a.desc}</div>
              <div className="bar-bg" style={{margin:"8px 0 4px"}}><div className="bar-fill" style={{width:progressPct+"%"}} /></div>
              <div className="small muted flex-between">
                <span>{fmt(a.value)}{a.nextThreshold!=null ? (" / "+fmt(a.nextThreshold)) : " — maximum atteint"}</span>
                <span>
                  {a.tiers.map((t,ti) => {
                    const reached = a.tier>ti;
                    return <span key={ti} className={"tier-pip"+(reached?" reached":"")} style={reached?{background:ACHIEVEMENT_TIER_COLORS[ti]}:undefined} title={ACHIEVEMENT_TIER_LABELS[ti]+" — "+fmt(t)} />;
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
