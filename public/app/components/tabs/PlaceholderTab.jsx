// Onglet pas encore porté en React dans cette première passe de migration (voir le suivi de tâches
// de la conversation) : le reste de l'ancienne interface (Caserne, Commandant, Carte, Guilde,
// Marché, Classement, Rapports, Empire, Informations/Admin) sera converti tab par tab dans les
// prochaines étapes. Rien n'est cassé — juste pas encore réécrit ici.
export default function PlaceholderTab({
  label
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "\uD83D\uDEA7 ", label), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Cet onglet n'a pas encore \xE9t\xE9 port\xE9 vers la nouvelle interface React \u2014 la migration se fait progressivement, onglet par onglet. Il reviendra ici prochainement."));
}