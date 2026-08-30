// Onglet pas encore porté en React dans cette première passe de migration (voir le suivi de tâches
// de la conversation) : le reste de l'ancienne interface (Caserne, Commandant, Carte, Guilde,
// Marché, Classement, Rapports, Empire, Informations/Admin) sera converti tab par tab dans les
// prochaines étapes. Rien n'est cassé — juste pas encore réécrit ici.
export default function PlaceholderTab({ label }){
  return (
    <div>
      <h2>🚧 {label}</h2>
      <p className="muted small">
        Cet onglet n'a pas encore été porté vers la nouvelle interface React — la migration se fait
        progressivement, onglet par onglet. Il reviendra ici prochainement.
      </p>
    </div>
  );
}
