import { useGame } from "./GameContext.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import GameScreen from "./components/GameScreen.jsx";

export default function App(){
  const { authToken, snapshot, resuming } = useGame();

  if(resuming){
    // Reprise de session en cours (jeton sauvegardé en localStorage, en cours de vérification
    // auprès du serveur) : évite un flash de l'écran de connexion avant de savoir si on est déjà
    // authentifié — l'ancien index.html avait le même souci (tryResumeSession asynchrone) mais
    // laissait #authScreen vide entre-temps ; ici un état explicite le rend intentionnel.
    return <div style={{minHeight:"100vh"}} />;
  }

  if(!authToken || !snapshot) return <AuthScreen />;
  return <GameScreen />;
}
