import { useGame } from "../../GameContext.jsx";
import { rankCell } from "../../legacy/art.js";

// Porte renderLeaderboard().
export default function LeaderboardTab(){
  const { snapshot, username, openPlayerProfile } = useGame();
  const rows = snapshot.leaderboard;

  return (
    <div>
      <h2>🏆 Classement</h2>
      <p className="muted small">Les meilleurs joueurs du monde, classés par points (somme des niveaux de TOUTES les constructions sur TOUS les villages possédés ×10 + conquêtes réalisées ×50).</p>
      <div className="box">
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead><tr><th>#</th><th>Joueur</th><th>Villages</th><th>Guilde</th><th>Points</th></tr></thead>
          <tbody>
            {rows.length ? rows.map((p,i) => (
              <tr key={p.username} style={p.username===username ? {background:"rgba(193,121,62,0.14)"} : undefined}>
                <td dangerouslySetInnerHTML={{__html: rankCell(i+1)}} />
                <td className="player-link" onClick={()=>openPlayerProfile(p.username)}>{p.username}{p.username===username?" (vous)":""}</td>
                <td>{p.villageCount}</td>
                <td>{p.guild ? `[${p.guild.tag}] ${p.guild.name}` : <span className="muted">—</span>}</td>
                <td>{p.points}</td>
              </tr>
            )) : (
              <tr><td colSpan="5" className="muted">Aucun joueur pour l'instant.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
