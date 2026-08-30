import { useEffect, useState } from "react";
import { useGame } from "../GameContext.jsx";

// Porte showBanner() : bannière flottante affichée ~2.6s (voir applySnapshot dans GameContext,
// qui pose banner={id,text,type} sur une riposte de raid détectée dans le nouvel instantané).
// La transition d'apparition/disparition est entièrement gérée par la classe CSS "show" (voir
// #battleBanner dans styles.css), exactement comme dans l'ancien index.html.
export default function BattleBanner() {
  const {
    banner
  } = useGame();
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const [type, setType] = useState("");
  useEffect(() => {
    if (!banner) return;
    setText(banner.text);
    setType(banner.type);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(t);
  }, [banner]);
  return /*#__PURE__*/React.createElement("div", {
    id: "battleBanner",
    className: (visible ? "show " : "") + type
  }, text);
}