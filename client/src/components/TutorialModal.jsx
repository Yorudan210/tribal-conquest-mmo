import { useState } from "react";
import { useGame } from "../GameContext.jsx";

// Porte TUTORIAL_STEPS/renderTutorial()/showTutorial()/closeTutorial() (index.html ~1436-1489) :
// petit diaporama de bienvenue, affiché automatiquement une fois par compte (voir GameContext ->
// enterGame) et rejouable depuis l'onglet Aide via replayTutorial(). L'étape courante (tutorialStep)
// reste un simple état local -- elle est réinitialisée à chaque ouverture (voir replayTutorial), pas
// besoin de la faire survivre à un démontage.
const TUTORIAL_STEPS = [
  {icon:"🏰", title:"Bienvenue dans Conquête Tribale !",
   body:"Gérez votre village médiéval, développez son économie et affrontez d'autres villages pour devenir le seigneur le plus puissant de la région."},
  {icon:"🌾", title:"Vos ressources",
   body:"En haut de l'écran : bois, argile et fer sont produits automatiquement chaque heure par vos bâtiments, limités par la capacité de votre Entrepôt. Surveillez aussi votre population (👥), utilisée par vos troupes."},
  {icon:"🏗️", title:"Bâtiments",
   body:"Dans l'onglet Bâtiments, cliquez sur une construction pour l'améliorer. Depuis l'Hôtel de ville, vous pouvez aussi lancer n'importe quelle construction sans avoir à cliquer dessus sur la carte."},
  {icon:"⚔️", title:"Caserne et troupes",
   body:"Construisez une Caserne pour entraîner des troupes dans l'onglet du même nom : lanciers, cavalerie, béliers... chacune a un rôle différent à l'attaque comme à la défense."},
  {icon:"🗺️", title:"La carte",
   body:"Explorez la carte pour repérer des villages barbares : envoyez une reconnaissance pour les espionner, ou une attaque pour piller leurs ressources. Attention : un village attaqué peut riposter !"},
  {icon:"🎖️", title:"Succès et classement",
   body:"Le sous-onglet Succès (dans Informations) suit votre progression par paliers (Bois/Bronze/Argent/Or), comme sur le jeu officiel, et l'onglet Classement affiche les meilleurs joueurs du monde. Bonne conquête !"}
];

export default function TutorialModal(){
  const { tutorialOpen, closeTutorial } = useGame();
  const [tutorialStep, setTutorialStep] = useState(0);

  if(!tutorialOpen) return null;

  const step = TUTORIAL_STEPS[tutorialStep];
  const isLast = tutorialStep===TUTORIAL_STEPS.length-1;

  function next(){
    if(isLast){ closeTutorial(); setTutorialStep(0); }
    else setTutorialStep(s=>s+1);
  }
  function prev(){ setTutorialStep(s=>Math.max(0, s-1)); }
  function skip(){ closeTutorial(); setTutorialStep(0); }

  return (
    <div className="tutorial-backdrop">
      <div className="tutorial-card">
        <div className="tstep-icon">{step.icon}</div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tutorial-dots">
          {TUTORIAL_STEPS.map((_,i) => <span key={i} className={i===tutorialStep?"active":""} />)}
        </div>
        <div className="tutorial-actions">
          <button className="tutorial-skip" onClick={skip}>Passer</button>
          <div style={{display:"flex", gap:8}}>
            {tutorialStep>0 && <button onClick={prev}>◀ Précédent</button>}
            <button className="primary" onClick={next}>{isLast ? "Terminer" : "Suivant ▶"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
