/* ============================================================================
   Conquête Tribale — données et formules de jeu partagées entre le serveur
   (autorité) et le client (affichage). Format UMD : utilisable via require()
   côté Node ET via <script> classique côté navigateur (attache tout sur
   window.GameData dans ce cas).
   ========================================================================= */
(function(root, factory){
  const mod = factory();
  if(typeof module === "object" && module.exports){ module.exports = mod; }
  else { root.GameData = mod; }
})(typeof self !== "undefined" ? self : this, function(){
  "use strict";

  const BUILDINGS = {
    hq:        {name:"Hôtel de ville", desc:"Accélère toutes les constructions du village.", baseCost:{wood:90,clay:80,iron:70}, factor:{wood:1.26,clay:1.275,iron:1.26}, baseTime:900, max:30},
    wood:      {name:"Camp de bûcherons", desc:"Produit du bois chaque heure.", baseCost:{wood:50,clay:60,iron:40}, factor:{wood:1.25,clay:1.275,iron:1.245}, baseTime:900, max:30},
    clay:      {name:"Carrière d'argile", desc:"Produit de l'argile chaque heure.", baseCost:{wood:65,clay:50,iron:40}, factor:{wood:1.27,clay:1.265,iron:1.24}, baseTime:900, max:30},
    iron:      {name:"Fonderie de fer", desc:"Produit du fer chaque heure.", baseCost:{wood:75,clay:65,iron:70}, factor:{wood:1.252,clay:1.275,iron:1.24}, baseTime:1080, max:30},
    warehouse: {name:"Entrepôt", desc:"Augmente la capacité de stockage des ressources.", baseCost:{wood:60,clay:50,iron:40}, factor:{wood:1.265,clay:1.27,iron:1.245}, baseTime:1020, max:30},
    farm:      {name:"Ferme", desc:"Augmente la population maximale (troupes).", baseCost:{wood:45,clay:40,iron:30}, factor:{wood:1.3,clay:1.32,iron:1.29}, baseTime:1200, max:30},
    barracks:  {name:"Caserne", desc:"Permet d'entraîner des troupes.", baseCost:{wood:200,clay:170,iron:90}, factor:{wood:1.26,clay:1.28,iron:1.26}, baseTime:1800, max:25, requires:{hq:1}},
    wall:      {name:"Muraille", desc:"Renforce la défense du village (+5%/niveau).", baseCost:{wood:50,clay:100,iron:20}, factor:{wood:1.26,clay:1.275,iron:1.26}, baseTime:3600, max:20},
    hide:      {name:"Cachette", desc:"Protège une partie des ressources en cas de pillage (5%/niveau).", baseCost:{wood:50,clay:60,iron:50}, factor:{wood:1.25,clay:1.25,iron:1.25}, baseTime:1800, max:10},
    academy:   {name:"Académie", desc:"Permet de former des Nobles pour conquérir des villages.", baseCost:{wood:15000,clay:25000,iron:10000}, factor:{wood:2,clay:2,iron:2}, baseTime:586800, max:1, requires:{hq:20}},
    guildHall: {name:"Hall de guilde", desc:"Permet de faire don de ressources à la guilde pour obtenir un bonus de production pour tous ses membres. Plus son niveau est élevé, plus vous pouvez donner en une fois.", baseCost:{wood:2000,clay:2000,iron:2000}, factor:{wood:1.5,clay:1.5,iron:1.5}, baseTime:3600, max:5, requires:{hq:5}}
  };
  const BUILD_ORDER = ["hq","wood","clay","iron","warehouse","farm","barracks","wall","hide","academy"];
  // Le Hall de guilde n'est volontairement PAS dans BUILD_ORDER : il n'a pas d'emplacement dans la
  // scène du village (octogone de bâtiments déjà plein) et se construit depuis l'onglet Guilde.

  /* Boutique de guilde : bonus temporaires achetés avec les ressources de la BANQUE de guilde
     (alimentée par les dons), et qui profitent à TOUS les membres pendant leur durée. Partagé entre
     serveur (application des effets) et client (affichage du catalogue et des coûts). */
  const GUILD_BOOSTS = [
    { key:"prod20", name:"Élan économique", icon:"📈",
      desc:"+20% de ressources produites par heure (bois, argile, fer confondus) pour toute la guilde pendant 1h.",
      cost:{wood:3000,clay:3000,iron:3000}, durationSec:3600, type:"production", multiplier:1.20 },
    { key:"prod50", name:"Âge d'or", icon:"✨",
      desc:"+50% de ressources produites par heure (bois, argile, fer confondus) pour toute la guilde pendant 30 min.",
      cost:{wood:8000,clay:8000,iron:8000}, durationSec:1800, type:"production", multiplier:1.50 },
    { key:"speed20", name:"Effort de guerre", icon:"⚙️",
      desc:"+20% de vitesse de construction des bâtiments pour toute la guilde pendant 1h.",
      cost:{wood:3000,clay:3000,iron:3000}, durationSec:3600, type:"speed", multiplier:1.20 },
    { key:"speed50", name:"Mobilisation générale", icon:"🚀",
      desc:"+50% de vitesse de construction des bâtiments pour toute la guilde pendant 30 min.",
      cost:{wood:8000,clay:8000,iron:8000}, durationSec:1800, type:"speed", multiplier:1.50 },
    { key:"train20", name:"Instructeurs d'élite", icon:"🎯",
      desc:"+20% de vitesse d'entraînement des troupes pour toute la guilde pendant 1h.",
      cost:{wood:3000,clay:3000,iron:3000}, durationSec:3600, type:"train", multiplier:1.20 },
    { key:"train50", name:"Conscription forcée", icon:"🥁",
      desc:"+50% de vitesse d'entraînement des troupes pour toute la guilde pendant 30 min.",
      cost:{wood:8000,clay:8000,iron:8000}, durationSec:1800, type:"train", multiplier:1.50 }
  ];

  /* Évènements de serveur : déclenchés depuis le panneau Admin, ils s'appliquent à TOUS les joueurs
     (contrairement aux boosts de guilde ci-dessus, achetés par une seule guilde pour ses membres).
     Deux familles : "instant" (effet immédiat, sans durée ni multiplicateur — ex. un cadeau de
     ressources) et "duration" (un multiplicateur appliqué pendant X minutes, identifié par "affects"
     pour savoir quelle formule serveur il modifie). Un seul évènement actif à la fois par valeur
     d'"affects" : en lancer un nouveau remplace l'ancien plutôt que de cumuler les deux. */
  const SERVER_EVENTS = [
    { key:"resourceGift", name:"Cadeau de ressources", icon:"🎁", kind:"instant",
      desc:"Offre immédiatement du bois, de l'argile et du fer à tous les villages actifs (dans la limite de leur entrepôt)." },
    { key:"prodBoost", name:"Boost de production", icon:"📈", kind:"duration", affects:"production",
      desc:"Multiplie la production de bois/argile/fer de tous les joueurs pendant la durée choisie." },
    { key:"buildBoost", name:"Boost de construction", icon:"🏗️", kind:"duration", affects:"build",
      desc:"Accélère la construction des bâtiments de tous les joueurs pendant la durée choisie." },
    { key:"trainBoost", name:"Boost d'entraînement", icon:"⚔️", kind:"duration", affects:"train",
      desc:"Accélère l'entraînement des troupes de tous les joueurs pendant la durée choisie." },
    { key:"moveBoost", name:"Boost de déplacement", icon:"🐎", kind:"duration", affects:"move",
      desc:"Accélère le déplacement des troupes (attaques, soutiens, retours) pendant la durée choisie." },
    { key:"lootBoost", name:"Boost de pillage", icon:"💰", kind:"duration", affects:"loot",
      desc:"Multiplie le butin rapporté par les attaques victorieuses pendant la durée choisie." },
    { key:"pointsBoost", name:"Points doublés", icon:"🏆", kind:"duration", affects:"points",
      desc:"Multiplie les points affichés au classement pendant la durée choisie." }
  ];

  /* Succès (mêmes catégories, noms et paliers que le jeu officiel "Die Stämme / Tribal Wars",
     dans la limite des mécaniques réellement présentes dans ce clone — voir README pour le détail
     des catégories officielles volontairement omises, faute d'équivalent : pièces d'or/premium,
     score par continent, système d'amis/parrainage, quête des objets de Paladin, succès du jour).
     4 paliers par succès (Bois/Bronze/Argent/Or, comme le jeu officiel), valant respectivement
     1/2/3/4 points de succès ; "stat" désigne la valeur (voir computeAchievements côté serveur)
     comparée aux seuils de "tiers" pour déterminer le palier atteint. */
  const ACHIEVEMENT_TIER_LABELS = ["Bois","Bronze","Argent","Or"];
  const ACHIEVEMENTS = [
    { key:"scoreChampion", name:"Roi des points", icon:"👑", stat:"points",
      desc:"Cumulez un maximum de points de village.", tiers:[100,5000,100000,10000000] },
    { key:"conquest", name:"Conquête", icon:"🏰", stat:"conquered",
      desc:"Conquérez des villages (barbares ou ennemis).", tiers:[5,50,500,1000] },
    { key:"raider", name:"Pilleur", icon:"💰", stat:"totalLoot",
      desc:"Pillez un maximum de ressources au total (bois + argile + fer confondus).", tiers:[500,10000,1000000,100000000] },
    { key:"leader", name:"Chef de guerre", icon:"⚔️", stat:"unitsKilled",
      desc:"Détruisez des troupes ennemies, en attaque comme en défense.", tiers:[10000,100000,1000000,20000000] },
    { key:"plunderer", name:"Pillages réussis", icon:"🏴", stat:"attacksWon",
      desc:"Remportez un maximum d'attaques.", tiers:[10,100,1000,10000] },
    { key:"commander", name:"Bras secourable", icon:"🤝", stat:"supportsSent",
      desc:"Envoyez des renforts à d'autres joueurs.", tiers:[50,100,500,3000] },
    { key:"merchant", name:"Négociant", icon:"🏪", stat:"marketTrades",
      desc:"Concluez des échanges sur le Marché.", tiers:[10,100,500,1000] },
    { key:"demolisher", name:"Fléau des murailles", icon:"🧨", stat:"wallLevelsDestroyed",
      desc:"Détruisez des niveaux de muraille ennemis avec vos béliers.", tiers:[25,250,2500,10000] },
    { key:"warlord", name:"Guerrier tous azimuts", icon:"🎯", stat:"distinctOpponents",
      desc:"Attaquez un maximum de joueurs différents.", tiers:[10,25,100,250] }
  ];

  const TROOPS = {
    spear: {name:"Lancier", cost:{wood:50,clay:30,iron:10}, pop:1, atk:10, defInf:15, defCav:45, defArch:20, speed:18, carry:25, baseTime:14, requires:{barracks:1}},
    sword: {name:"Épéiste", cost:{wood:30,clay:30,iron:70}, pop:1, atk:25, defInf:50, defCav:15, defArch:40, speed:22, carry:15, baseTime:20, requires:{barracks:1}},
    archer:{name:"Archer", cost:{wood:100,clay:30,iron:60}, pop:1, atk:15, defInf:50, defCav:40, defArch:5,  speed:18, carry:10, baseTime:18, requires:{barracks:2}},
    scout: {name:"Éclaireur", cost:{wood:50,clay:50,iron:20}, pop:2, atk:0,  defInf:2,  defCav:1,  defArch:2, speed:9,  carry:0,  baseTime:16, requires:{barracks:1}},
    light: {name:"Cavalerie légère", cost:{wood:125,clay:100,iron:250}, pop:4, atk:130, defInf:30, defCav:40, defArch:30, speed:10, carry:80, baseTime:45, requires:{barracks:3}},
    ram:   {name:"Bélier", cost:{wood:300,clay:200,iron:200}, pop:5, atk:2, defInf:20, defCav:50, defArch:20, speed:30, carry:0, baseTime:50, requires:{barracks:6}},
    catapult:{name:"Catapulte", cost:{wood:320,clay:400,iron:100}, pop:8, atk:100, defInf:100, defCav:50, defArch:100, speed:30, carry:0, baseTime:70, requires:{barracks:10}},
    noble: {name:"Noble", cost:{wood:16000,clay:16000,iron:20000}, pop:30, atk:30, defInf:100, defCav:50, defArch:100, speed:35, carry:0, baseTime:540, requires:{barracks:8, academy:1}}
  };
  const TROOP_ORDER = ["spear","sword","archer","scout","light","ram","catapult","noble"];
  const INFANTRY = ["spear","sword","ram","catapult","noble"];
  const CAVALRY = ["light"];
  const ARCHERS = ["archer"];

  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

  function buildCost(key, level){
    const b=BUILDINGS[key];
    return {
      wood: Math.round(b.baseCost.wood*Math.pow(b.factor.wood, level-1)),
      clay: Math.round(b.baseCost.clay*Math.pow(b.factor.clay, level-1)),
      iron: Math.round(b.baseCost.iron*Math.pow(b.factor.iron, level-1))
    };
  }
  const BUILD_TIME_FACTOR = 1.2;
  function buildTime(key, level, hqLevel){
    const b=BUILDINGS[key];
    const t=b.baseTime*Math.pow(BUILD_TIME_FACTOR, level-1);
    return Math.max(3, Math.round(t/Math.pow(1.05, hqLevel||0)));
  }
  function prodPerHour(key, level){
    if(level<=0) return 0;
    const base={wood:30,clay:30,iron:26}[key];
    return Math.round(base*Math.pow(1.163, level-1));
  }
  function storageCap(level){ return Math.round(1000*Math.pow(1.2, Math.max(level,0)-1)); }
  function farmCap(level){ return Math.round(200*Math.pow(1.172, Math.max(level,0)-1)); }
  // Même mécanisme de réduction que buildTime() (décroissance exponentielle selon le niveau du
  // bâtiment qui accélère l'action — ici la Caserne, comme le Hôtel de ville pour les constructions),
  // pour rester cohérent avec le reste du moteur de jeu.
  const TRAIN_TIME_FACTOR = 1.04;
  function trainTime(key, barracksLevel){
    const t=TROOPS[key].baseTime;
    return Math.max(3, Math.round(t/Math.pow(TRAIN_TIME_FACTOR, barracksLevel||0)));
  }

  return {
    BUILDINGS, BUILD_ORDER, TROOPS, TROOP_ORDER, INFANTRY, CAVALRY, ARCHERS, GUILD_BOOSTS, SERVER_EVENTS,
    ACHIEVEMENTS, ACHIEVEMENT_TIER_LABELS,
    clamp, buildCost, buildTime, prodPerHour, storageCap, farmCap, trainTime, BUILD_TIME_FACTOR, TRAIN_TIME_FACTOR
  };
});
