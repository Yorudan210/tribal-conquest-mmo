import { useRef } from "react";
import { useGame } from "../../GameContext.jsx";
import { fmt, RES_ICON, RES_NAME } from "../../formulas.js";

// Porte renderMarket()/attachMarketHandlers() : offres d'échange publiques entre joueurs (dépôt
// immédiat de la ressource proposée -- voir doMarketCreateOffer côté serveur).
export default function MarketTab(){
  const { snapshot, username, doAction, call, openPlayerProfile } = useGame();
  const v = snapshot.village;
  const offers = snapshot.market||[];
  const mine = offers.filter(o=>o.seller===username);
  const others = offers.filter(o=>o.seller!==username);

  const giveResRef = useRef(null), giveAmountRef = useRef(null);
  const wantResRef = useRef(null), wantAmountRef = useRef(null);

  function submit(e){
    e.preventDefault();
    const giveRes = giveResRef.current.value, wantRes = wantResRef.current.value;
    const giveAmount = Number(giveAmountRef.current.value), wantAmount = Number(wantAmountRef.current.value);
    if(giveRes===wantRes) return;
    if(!giveAmount || giveAmount<=0 || !wantAmount || wantAmount<=0) return;
    doAction(()=>call("/api/market/offer","POST",{giveRes, giveAmount, wantRes, wantAmount}), "📣 Offre publiée sur le marché.", null);
  }

  function cancelOffer(id){
    doAction(()=>call("/api/market/cancel","POST",{offerId:id}), "🗑️ Offre annulée, ressources récupérées.", null);
  }
  function acceptOffer(id){
    doAction(()=>call("/api/market/accept","POST",{offerId:id}), "🤝 Échange effectué !", null);
  }

  function OfferRow({ o, isMine }){
    return (
      <div className="flex-between" style={{background:"rgba(0,0,0,0.15)", padding:"8px 12px", borderRadius:8, marginBottom:6}}>
        <span>
          {isMine ? null : <><span className="player-link" onClick={()=>openPlayerProfile(o.seller)}>{o.seller}</span> — </>}
          donne {RES_ICON[o.giveRes]} <b>{fmt(o.giveAmount)}</b> {RES_NAME[o.giveRes].toLowerCase()}
          {" "}contre {RES_ICON[o.wantRes]} <b>{fmt(o.wantAmount)}</b> {RES_NAME[o.wantRes].toLowerCase()}
        </span>
        {isMine
          ? <button onClick={()=>cancelOffer(o.id)}>🗑️ Annuler</button>
          : <button className="primary" onClick={()=>acceptOffer(o.id)}>🤝 Échanger</button>}
      </div>
    );
  }

  return (
    <div>
      <h2>🏪 Marché</h2>
      <p className="muted small">Échangez vos surplus de ressources contre ce qui vous manque. Publiez une offre ou acceptez celle d'un autre joueur.</p>

      <div className="box">
        <h3>➕ Publier une offre</h3>
        <p className="small muted">La ressource proposée est mise en dépôt immédiatement (retirée de votre village) ; elle vous est rendue si vous annulez l'offre avant qu'un autre joueur ne l'accepte. Échange instantané, sans marchand ni délai de trajet.</p>
        <p className="small muted">Votre stock actuel : {["wood","clay","iron"].map(r=>`${RES_ICON[r]} ${fmt(v.resources[r])}`).join(" · ")}</p>
        <form onSubmit={submit} style={{display:"flex", gap:14, flexWrap:"wrap", alignItems:"flex-end"}}>
          <div>
            <label className="small muted">Je donne</label><br/>
            <select ref={giveResRef} defaultValue="wood">
              {["wood","clay","iron"].map(r => <option key={r} value={r}>{RES_ICON[r]} {RES_NAME[r]}</option>)}
            </select>
            <input type="number" ref={giveAmountRef} min="1" max="1000000" defaultValue="500" style={{width:110}} />
          </div>
          <div>
            <label className="small muted">Je veux en échange</label><br/>
            <select ref={wantResRef} defaultValue="clay">
              {["wood","clay","iron"].map(r => <option key={r} value={r}>{RES_ICON[r]} {RES_NAME[r]}</option>)}
            </select>
            <input type="number" ref={wantAmountRef} min="1" max="1000000" defaultValue="500" style={{width:110}} />
          </div>
          <button type="submit" className="primary">📣 Publier l'offre</button>
        </form>
      </div>

      <div className="box">
        <h3>🌍 Offres des autres joueurs ({others.length})</h3>
        {others.length ? others.map(o => <OfferRow key={o.id} o={o} isMine={false} />) : <p className="small muted">Aucune offre disponible pour l'instant.</p>}
      </div>

      <div className="box">
        <h3>📋 Mes offres ({mine.length})</h3>
        {mine.length ? mine.map(o => <OfferRow key={o.id} o={o} isMine={true} />) : <p className="small muted">Vous n'avez publié aucune offre.</p>}
      </div>
    </div>
  );
}
