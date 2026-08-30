import { useRef } from "react";
import { useGame } from "../../GameContext.jsx";
import { fmt, RES_ICON, RES_NAME } from "../../formulas.js";

// Porte renderMarket()/attachMarketHandlers() : offres d'échange publiques entre joueurs (dépôt
// immédiat de la ressource proposée -- voir doMarketCreateOffer côté serveur).
export default function MarketTab() {
  const {
    snapshot,
    username,
    doAction,
    call,
    openPlayerProfile
  } = useGame();
  const v = snapshot.village;
  const offers = snapshot.market || [];
  const mine = offers.filter(o => o.seller === username);
  const others = offers.filter(o => o.seller !== username);
  const giveResRef = useRef(null),
    giveAmountRef = useRef(null);
  const wantResRef = useRef(null),
    wantAmountRef = useRef(null);
  function submit(e) {
    e.preventDefault();
    const giveRes = giveResRef.current.value,
      wantRes = wantResRef.current.value;
    const giveAmount = Number(giveAmountRef.current.value),
      wantAmount = Number(wantAmountRef.current.value);
    if (giveRes === wantRes) return;
    if (!giveAmount || giveAmount <= 0 || !wantAmount || wantAmount <= 0) return;
    doAction(() => call("/api/market/offer", "POST", {
      giveRes,
      giveAmount,
      wantRes,
      wantAmount
    }), "📣 Offre publiée sur le marché.", null);
  }
  function cancelOffer(id) {
    doAction(() => call("/api/market/cancel", "POST", {
      offerId: id
    }), "🗑️ Offre annulée, ressources récupérées.", null);
  }
  function acceptOffer(id) {
    doAction(() => call("/api/market/accept", "POST", {
      offerId: id
    }), "🤝 Échange effectué !", null);
  }
  function OfferRow({
    o,
    isMine
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "flex-between",
      style: {
        background: "rgba(0,0,0,0.15)",
        padding: "8px 12px",
        borderRadius: 8,
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("span", null, isMine ? null : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "player-link",
      onClick: () => openPlayerProfile(o.seller)
    }, o.seller), " \u2014 "), "donne ", RES_ICON[o.giveRes], " ", /*#__PURE__*/React.createElement("b", null, fmt(o.giveAmount)), " ", RES_NAME[o.giveRes].toLowerCase(), " ", "contre ", RES_ICON[o.wantRes], " ", /*#__PURE__*/React.createElement("b", null, fmt(o.wantAmount)), " ", RES_NAME[o.wantRes].toLowerCase()), isMine ? /*#__PURE__*/React.createElement("button", {
      onClick: () => cancelOffer(o.id)
    }, "\uD83D\uDDD1\uFE0F Annuler") : /*#__PURE__*/React.createElement("button", {
      className: "primary",
      onClick: () => acceptOffer(o.id)
    }, "\uD83E\uDD1D \xC9changer"));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "\uD83C\uDFEA March\xE9"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "\xC9changez vos surplus de ressources contre ce qui vous manque. Publiez une offre ou acceptez celle d'un autre joueur."), /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\u2795 Publier une offre"), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "La ressource propos\xE9e est mise en d\xE9p\xF4t imm\xE9diatement (retir\xE9e de votre village) ; elle vous est rendue si vous annulez l'offre avant qu'un autre joueur ne l'accepte. \xC9change instantan\xE9, sans marchand ni d\xE9lai de trajet."), /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Votre stock actuel : ", ["wood", "clay", "iron"].map(r => `${RES_ICON[r]} ${fmt(v.resources[r])}`).join(" · ")), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    style: {
      display: "flex",
      gap: 14,
      flexWrap: "wrap",
      alignItems: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "small muted"
  }, "Je donne"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("select", {
    ref: giveResRef,
    defaultValue: "wood"
  }, ["wood", "clay", "iron"].map(r => /*#__PURE__*/React.createElement("option", {
    key: r,
    value: r
  }, RES_ICON[r], " ", RES_NAME[r]))), /*#__PURE__*/React.createElement("input", {
    type: "number",
    ref: giveAmountRef,
    min: "1",
    max: "1000000",
    defaultValue: "500",
    style: {
      width: 110
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "small muted"
  }, "Je veux en \xE9change"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("select", {
    ref: wantResRef,
    defaultValue: "clay"
  }, ["wood", "clay", "iron"].map(r => /*#__PURE__*/React.createElement("option", {
    key: r,
    value: r
  }, RES_ICON[r], " ", RES_NAME[r]))), /*#__PURE__*/React.createElement("input", {
    type: "number",
    ref: wantAmountRef,
    min: "1",
    max: "1000000",
    defaultValue: "500",
    style: {
      width: 110
    }
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "primary"
  }, "\uD83D\uDCE3 Publier l'offre"))), /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83C\uDF0D Offres des autres joueurs (", others.length, ")"), others.length ? others.map(o => /*#__PURE__*/React.createElement(OfferRow, {
    key: o.id,
    o: o,
    isMine: false
  })) : /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Aucune offre disponible pour l'instant.")), /*#__PURE__*/React.createElement("div", {
    className: "box"
  }, /*#__PURE__*/React.createElement("h3", null, "\uD83D\uDCCB Mes offres (", mine.length, ")"), mine.length ? mine.map(o => /*#__PURE__*/React.createElement(OfferRow, {
    key: o.id,
    o: o,
    isMine: true
  })) : /*#__PURE__*/React.createElement("p", {
    className: "small muted"
  }, "Vous n'avez publi\xE9 aucune offre.")));
}