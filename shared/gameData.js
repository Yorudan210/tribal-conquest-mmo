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
      desc:"+20% de production de ressources pour toute la guilde pendant 1h.",
      cost:{wood:3000,clay:3000,iron:3000}, durationSec:3600, type:"production", multiplier:1.20 },
    { key:"prod50", name:"Âge d'or", icon:"✨",
      desc:"+50% de production de ressources pour toute la guilde pendant 30 min.",
      cost:{wood:8000,clay:8000,iron:8000}, durationSec:1800, type:"production", multiplier:1.50 },
    { key:"speed20", name:"Effort de guerre", icon:"⚙️",
      desc:"+20% de vitesse de construction et d'entraînement pour toute la guilde pendant 1h.",
      cost:{wood:3000,clay:3000,iron:3000}, durationSec:3600, type:"speed", multiplier:1.20 },
    { key:"speed50", name:"Mobilisation générale", icon:"🚀",
      desc:"+50% de vitesse de construction et d'entraînement pour toute la guilde pendant 30 min.",
      cost:{wood:8000,clay:8000,iron:8000}, durationSec:1800, type:"speed", multiplier:1.50 }
  ];

  const TROOPS = {
    spear: {name:"Lancier", cost:{wood:50,clay:30,iron:10}, pop:1, atk:10, defInf:15, defCav:45, defArch:20, speed:18, carry:25, baseTime:14, requires:{barracks:1}},
    sword: {name:"Épéiste", cost:{wood:30,clay:30,iron:70}, pop:1, atk:25, defInf:50, defCav:15, defArch:40, speed:22, carry:15, baseTime:20, requires:{barracks:1}},
    archer:{name:"Archer", cost:{wood:100,clay:30,iron:60}, pop:1, atk:15, defInf:50, defCav:40, defArch:5,  speed:18, carry:10, baseTime:18, requires:{barracks:2}},
    scout: {name:"Éclaireur", cost:{wood:50,clay:50,iron:20}, pop:2, atk:0,  defInf:2,  defCav:1,  defArch:2, speed:9,  carry:0,  baseTime:16, requires:{barracks:1}},
    light: {name:"Cavalerie légère", cost:{wood:125,clay:100,iron:250}, pop:4, atk:130, defInf:30, defCav:40, defArch:30, speed:10, carry:80, baseTime:45, requires:{barracks:3}},
    ram:   {name:"Bélier", cost:{wood:300,clay:200,iron:200}, pop:5, atk:2, defInf:20, defCav:50, defArch:20, speed:30, carry:0, baseTime:50, requires:{barracks:6}},
    catapult:{name:"Catapulte", cost:{wood:350,clay:300,iron:350}, pop:8, atk:100, defInf:100, defCav:50, defArch:100, speed:30, carry:0, baseTime:70, requires:{barracks:10}},
    noble: {name:"Noble", cost:{wood:5500,clay:5500,iron:6500}, pop:10, atk:30, defInf:100, defCav:50, defArch:100, speed:35, carry:0, baseTime:180, requires:{barracks:8, academy:1}}
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
  function trainTime(key, barracksLevel){
    const t=TROOPS[key].baseTime;
    return Math.max(3, Math.round(t/(1+(barracksLevel||0)*0.05)));
  }

  return {
    BUILDINGS, BUILD_ORDER, TROOPS, TROOP_ORDER, INFANTRY, CAVALRY, ARCHERS, GUILD_BOOSTS,
    clamp, buildCost, buildTime, prodPerHour, storageCap, farmCap, trainTime, BUILD_TIME_FACTOR
  };
});
