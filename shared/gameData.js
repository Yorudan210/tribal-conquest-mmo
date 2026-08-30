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

  // Temps de base (baseTime, en secondes, au niveau 1 avec un Hôtel de ville niv. 0 — voir buildTime()
  // ci-dessous) recalés sur le rythme du jeu officiel "Die Stämme / Tribal Wars" : quelques minutes
  // pour les premiers niveaux des bâtiments courants, nettement plus pour la Muraille/l'Académie qui
  // restent des investissements lourds. Comme pour trainTime()/TROOPS, ce sont uniquement des valeurs
  // numériques d'équilibrage (non protégées par le droit d'auteur), appliquées via la formule maison
  // buildTime() de ce moteur, sans reprendre aucun code ni contenu du jeu original.
  const BUILDINGS = {
    hq:        {name:"Hôtel de ville", desc:"Accélère toutes les constructions du village.", baseCost:{wood:90,clay:80,iron:70}, factor:{wood:1.26,clay:1.275,iron:1.26}, baseTime:400, max:30},
    wood:      {name:"Camp de bûcherons", desc:"Produit du bois chaque heure.", baseCost:{wood:50,clay:60,iron:40}, factor:{wood:1.25,clay:1.275,iron:1.245}, baseTime:300, max:30},
    clay:      {name:"Carrière d'argile", desc:"Produit de l'argile chaque heure.", baseCost:{wood:65,clay:50,iron:40}, factor:{wood:1.27,clay:1.265,iron:1.24}, baseTime:300, max:30},
    iron:      {name:"Fonderie de fer", desc:"Produit du fer chaque heure.", baseCost:{wood:75,clay:65,iron:70}, factor:{wood:1.252,clay:1.275,iron:1.24}, baseTime:360, max:30},
    warehouse: {name:"Entrepôt", desc:"Augmente la capacité de stockage des ressources.", baseCost:{wood:60,clay:50,iron:40}, factor:{wood:1.265,clay:1.27,iron:1.245}, baseTime:350, max:30},
    farm:      {name:"Ferme", desc:"Augmente la population maximale (troupes).", baseCost:{wood:45,clay:40,iron:30}, factor:{wood:1.3,clay:1.32,iron:1.29}, baseTime:280, max:30},
    barracks:  {name:"Caserne", desc:"Permet d'entraîner des troupes.", baseCost:{wood:200,clay:170,iron:90}, factor:{wood:1.26,clay:1.28,iron:1.26}, baseTime:600, max:25, requires:{hq:1}},
    wall:      {name:"Muraille", desc:"Renforce la défense du village (+5%/niveau).", baseCost:{wood:50,clay:100,iron:20}, factor:{wood:1.26,clay:1.275,iron:1.26}, baseTime:500, max:20},
    hide:      {name:"Cachette", desc:"Protège une partie des ressources en cas de pillage (5%/niveau).", baseCost:{wood:50,clay:60,iron:50}, factor:{wood:1.25,clay:1.25,iron:1.25}, baseTime:400, max:10},
    academy:   {name:"Académie", desc:"Permet de former des Nobles pour conquérir des villages.", baseCost:{wood:15000,clay:25000,iron:10000}, factor:{wood:2,clay:2,iron:2}, baseTime:21600, max:1, requires:{hq:20}},
    guildHall: {name:"Hall de guilde", desc:"Permet de faire don de ressources à la guilde pour obtenir un bonus de production pour tous ses membres. Plus son niveau est élevé, plus vous pouvez donner en une fois.", baseCost:{wood:2000,clay:2000,iron:2000}, factor:{wood:1.5,clay:1.5,iron:1.5}, baseTime:900, max:5, requires:{hq:5}}
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

  /* Factions PNJ permanentes (en plus des villages barbares classiques et de l'évènement temporaire
     de l'Armée Noire) : des cibles PvE au profil différent, présentes en permanence sur la carte dès
     la génération du monde (voir spawnPermanentFactions, server/store.js), pour varier les cibles
     disponibles sur la durée. Un village de ces factions reste un village barbare ordinaire
     (owner:"barbarian") avec juste faction+multiplicateurs en plus, exactement comme l'Armée Noire —
     tout le moteur de combat/conquête existant s'applique sans changement.
     - "bandits" (Repaires de brigands) : plus faibles qu'un barbare classique de même distance, et
       concentrés près du centre. Leur population est maintenue dans le temps par un top-up
       périodique (topUpBandits, server/store.js) : contrairement aux barbares classiques, il y en a
       toujours de disponibles près des zones peuplées, même après plusieurs semaines de jeu.
     - "raiders" (Camps de maraudeurs) : plus forts qu'un barbare classique, plutôt en périphérie.
       Chaque victoire contre l'un d'eux octroie en plus au village attaquant un boost temporaire
       (voir "boostOnVictory", même forme qu'une entrée de GUILD_BOOSTS ci-dessus mais appliquée au
       niveau du village plutôt que de la guilde — voir villageBoostMultiplier, server/gameLogic.js). */
  const PERMANENT_FACTIONS = {
    bandits: {
      key:"bandits", name:"Repaire de brigands", icon:"🗡️", pinClass:"bandits",
      distancePreference:"near", troopMult:0.65, resMult:0.85, wallGuarantee:false,
      desc:"Un campement de brigands, plus faible qu'un village barbare classique de même distance. De nouveaux repaires réapparaissent régulièrement près des zones peuplées."
    },
    raiders: {
      key:"raiders", name:"Camp de maraudeurs", icon:"🐎", pinClass:"raiders",
      distancePreference:"far", troopMult:1.35, resMult:1.2, wallGuarantee:true,
      desc:"Un camp de maraudeurs aguerris, plus fort qu'un village barbare classique. Chaque victoire rapporte, en plus du pillage habituel, une Ration de guerre.",
      boostOnVictory:{ key:"raiderRation", name:"Ration de guerre", icon:"🍖", type:"production", multiplier:1.15, durationSec:10800 }
    }
  };

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
      desc:"Conquérez des villages barbares (dont l'Armée Noire).", tiers:[5,50,500,1000] },
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
    { key:"blackHunter", name:"Chasseur de l'Armée Noire", icon:"💀", stat:"blackArmyDefeated",
      desc:"Remportez des combats contre les campements de l'Armée Noire (évènement de lancement).", tiers:[3,10,25,60] }
  ];

  // Temps de base (baseTime, en secondes, au niveau 0 de Caserne — voir trainTime() ci-dessous) calés
  // sur le rythme d'entraînement du jeu officiel "Die Stämme / Tribal Wars" à niveau de Caserne
  // équivalent (de l'ordre de 15-25 min pour l'infanterie de base, 30 min pour la cavalerie légère,
  // plus d'une heure pour les unités de siège, plusieurs heures pour le Noble) : ce ne sont que des
  // valeurs numériques d'équilibrage (non protégées par le droit d'auteur), appliquées ici via la
  // formule originale trainTime() de ce moteur, sans reprendre aucun code ni contenu du jeu original.
  const TROOPS = {
    spear: {name:"Lancier", cost:{wood:50,clay:30,iron:10}, pop:1, atk:10, defInf:15, defCav:45, defArch:20, speed:18, carry:25, baseTime:1000, requires:{barracks:1}},
    sword: {name:"Épéiste", cost:{wood:30,clay:30,iron:70}, pop:1, atk:25, defInf:50, defCav:15, defArch:40, speed:22, carry:15, baseTime:1500, requires:{barracks:1}},
    archer:{name:"Archer", cost:{wood:100,clay:30,iron:60}, pop:1, atk:15, defInf:50, defCav:40, defArch:5,  speed:18, carry:10, baseTime:1500, requires:{barracks:2}},
    scout: {name:"Éclaireur", cost:{wood:50,clay:50,iron:20}, pop:2, atk:0,  defInf:2,  defCav:1,  defArch:2, speed:9,  carry:0,  baseTime:900, requires:{barracks:1}},
    light: {name:"Cavalerie légère", cost:{wood:125,clay:100,iron:250}, pop:4, atk:130, defInf:30, defCav:40, defArch:30, speed:10, carry:80, baseTime:1800, requires:{barracks:3}},
    ram:   {name:"Bélier", cost:{wood:300,clay:200,iron:200}, pop:5, atk:2, defInf:20, defCav:50, defArch:20, speed:30, carry:0, baseTime:4200, requires:{barracks:6}},
    catapult:{name:"Catapulte", cost:{wood:320,clay:400,iron:100}, pop:8, atk:100, defInf:100, defCav:50, defArch:100, speed:30, carry:0, baseTime:4500, requires:{barracks:10}},
    noble: {name:"Noble", cost:{wood:16000,clay:16000,iron:20000}, pop:30, atk:30, defInf:100, defCav:50, defArch:100, speed:35, carry:0, baseTime:10800, requires:{barracks:8, academy:1}}
  };
  const TROOP_ORDER = ["spear","sword","archer","scout","light","ram","catapult","noble"];
  const INFANTRY = ["spear","sword","ram","catapult","noble"];
  const CAVALRY = ["light"];
  const ARCHERS = ["archer"];

  /* Commandant : officier propre à chaque compte (pas au village), qui monte en niveau en gagnant de
     l'XP au combat (pertes infligées à l'adversaire) et distribue des points de compétence dans 3
     branches indépendantes (Attaque / Défense / Économie), chacune sur 4 paliers cumulables. Système
     original (aucun équivalent dans le jeu officiel "Die Stämme / Tribal Wars"), inspiré des arbres de
     compétences de commandants que l'on retrouve dans les jeux de stratégie mobile modernes (Rise of
     Kingdoms, Whiteout Survival) mais avec des bonus et une progression propres à ce moteur. */
  const COMMANDER_MAX_TIER = 4;
  const COMMANDER_BRANCHES = {
    atk: { name:"Attaque", icon:"⚔️", tiers:[
      {desc:"+5% de puissance d'attaque."},
      {desc:"+5% de puissance d'attaque (10% cumulé)."},
      {desc:"+5% de puissance d'attaque (15% cumulé)."},
      {desc:"Maîtrise du pillage : +20% de capacité de transport des troupes."}
    ]},
    def: { name:"Défense", icon:"🛡️", tiers:[
      {desc:"+5% de puissance défensive."},
      {desc:"+5% de puissance défensive (10% cumulé)."},
      {desc:"+5% de puissance défensive (15% cumulé)."},
      {desc:"Ténacité : -15% de pertes subies en défense."}
    ]},
    eco: { name:"Économie", icon:"🏗️", tiers:[
      {desc:"+5% de production de ressources."},
      {desc:"+5% de production de ressources (10% cumulé)."},
      {desc:"+5% de production de ressources (15% cumulé)."},
      {desc:"Génie logistique : +15% de vitesse de construction et d'entraînement."}
    ]}
  };
  function commanderXpToNext(level){ return 60 + level*30; }

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

  // Marqueurs personnels que le joueur peut poser sur n'importe quel village de la carte (le sien,
  // ceux d'un autre joueur, ou un village barbare) : une simple note visuelle privée ("cible
  // prioritaire", "à surveiller"...), jamais vue par personne d'autre et SANS AUCUN effet sur le
  // jeu (contrairement à tout ce qui touche réellement au village visé). Stockés au niveau du
  // compte (voir villageTagsOf, gameLogic.js), pas du village, pour survivre à un changement de
  // village actif comme à la perte/conquête d'un village. La couleur ci-dessous ne sert qu'à
  // teinter le badge côté client (voir villageTagBadgeSvg, public/index.html) ; la clé "key" est la
  // seule valeur réellement stockée et validée côté serveur (voir VILLAGE_TAG_KEYS).
  const VILLAGE_TAGS = [
    { key:"star",      label:"Cible prioritaire",    color:"#e6c14a" },
    { key:"swords",    label:"Cible d'attaque",      color:"#b23a3a" },
    { key:"shield",    label:"À défendre",           color:"#4a7fb0" },
    { key:"exclaim",   label:"À surveiller",         color:"#d98a2b" },
    { key:"check",     label:"Traité",               color:"#5a9a52" },
    { key:"cross",     label:"À éviter",             color:"#7a7268" },
    { key:"hourglass", label:"Timing en préparation", color:"#8a5fb0" },
    { key:"coin",      label:"Ferme à piller",       color:"#c9a227" },
    { key:"skull",     label:"Danger",               color:"#8a3226" },
    { key:"peace",     label:"Paix / pacte",         color:"#3d9e7a" },
    { key:"question",  label:"À explorer",           color:"#5b93b0" },
    { key:"crown",     label:"À conquérir (noble)",  color:"#c1793e" }
  ];
  const VILLAGE_TAG_KEYS = VILLAGE_TAGS.map(t=>t.key);

  return {
    BUILDINGS, BUILD_ORDER, TROOPS, TROOP_ORDER, INFANTRY, CAVALRY, ARCHERS, GUILD_BOOSTS, SERVER_EVENTS,
    PERMANENT_FACTIONS,
    ACHIEVEMENTS, ACHIEVEMENT_TIER_LABELS, COMMANDER_BRANCHES, COMMANDER_MAX_TIER, commanderXpToNext,
    clamp, buildCost, buildTime, prodPerHour, storageCap, farmCap, trainTime, BUILD_TIME_FACTOR, TRAIN_TIME_FACTOR,
    VILLAGE_TAGS, VILLAGE_TAG_KEYS
  };
});
