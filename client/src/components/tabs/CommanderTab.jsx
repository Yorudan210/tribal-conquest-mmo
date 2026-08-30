import { useGame } from "../../GameContext.jsx";
import { COMMANDER_BRANCHES, COMMANDER_MAX_TIER, clamp } from "../../gameData.js";

// Porte renderCommander() : arbre de compétences à 3 branches indépendantes (Attaque/Défense/
// Économie), propre au COMPTE (pas au village actif) — voir GameContext pour le détail de
// l'accumulation d'XP côté serveur (grantCommanderXp).
export default function CommanderTab(){
  const { snapshot, doAction, call } = useGame();
  const c = snapshot.commander;

  if(!c){
    return (
      <div>
        <h2>🎖️ Commandant</h2>
        <p className="muted">Informations de Commandant indisponibles pour le moment.</p>
      </div>
    );
  }

  const pct = c.xpToNext>0 ? clamp(Math.round(c.xp/c.xpToNext*100), 0, 100) : 0;

  function upgrade(branch){
    const name = (COMMANDER_BRANCHES[branch]||{}).name || branch;
    doAction(()=>call("/api/commander/upgrade","POST",{branch}), "🎖️ Palier débloqué : "+name+" !", null);
  }

  return (
    <div>
      <h2>🎖️ Commandant</h2>
      <p className="muted small">Votre Commandant est propre à votre <b>compte</b> (pas à un village précis) : il gagne de l'expérience à chaque combat — pertes infligées à l'adversaire, aussi bien en attaque qu'en défense — et monte de niveau, ce qui octroie 1 point de compétence à répartir librement entre 3 branches indépendantes. Chaque branche a 4 paliers ; les 3 premiers accordent un bonus progressif, le 4ᵉ un bonus spécial plus marqué.</p>
      <div className="box" style={{marginBottom:14}}>
        <div className="flex-between">
          <h3 style={{margin:0}}>Niveau {c.level}</h3>
          <span className="small muted">{c.skillPoints} point(s) de compétence disponible(s)</span>
        </div>
        <div className="bar-bg"><div className="bar-fill" style={{width: pct+"%"}} /></div>
        <div className="small muted" style={{marginTop:4}}>{c.xp} / {c.xpToNext} XP jusqu'au niveau {c.level+1}</div>
      </div>
      <div className="cmd-branches">
        {Object.keys(COMMANDER_BRANCHES).map(bk => (
          <CommanderBranch key={bk} bk={bk} c={c} onUpgrade={upgrade} />
        ))}
      </div>
    </div>
  );
}

function CommanderBranch({ bk, c, onUpgrade }){
  const branch = COMMANDER_BRANCHES[bk];
  const cur = c.skills[bk]||0;
  return (
    <div className="cmd-branch">
      <h3>{branch.icon} {branch.name} <span className="small muted">(palier {cur}/{COMMANDER_MAX_TIER})</span></h3>
      {branch.tiers.map((tier, i) => {
        const tierNum = i+1;
        const unlocked = cur>=tierNum;
        const canUnlock = !unlocked && cur===tierNum-1 && c.skillPoints>0;
        const isFinal = tierNum===COMMANDER_MAX_TIER;
        return (
          <div className={"cmd-tier"+(unlocked?" unlocked":"")+(isFinal?" cmd-tier-final":"")} key={tierNum}>
            <div className="cmd-tier-head">
              <span className="cmd-tier-num">{tierNum}</span>
              <span className="cmd-tier-desc">{tier.desc}</span>
            </div>
            {unlocked ? (
              <span className="cmd-tier-status cmd-status-done">✅ Acquis</span>
            ) : canUnlock ? (
              <button onClick={()=>onUpgrade(bk)}>🔓 Débloquer (1 pt)</button>
            ) : (
              <span className="cmd-tier-status muted small">🔒 Verrouillé</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
