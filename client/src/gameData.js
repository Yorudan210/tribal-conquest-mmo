// Ré-export du module de données/formules partagé avec le serveur (shared/gameData.js, format UMD :
// utilisable via require() côté Node ET via <script> classique côté navigateur). shared/gameData.js
// n'a AUCUNE syntaxe d'import/export ES (il doit rester chargeable tel quel par server/gameLogic.js
// via require(), qu'on ne touche surtout pas ici) : on l'importe donc pour son EFFET DE BORD habituel
// (la branche navigateur de son wrapper UMD pose `self.GameData = ...`), exactement comme le faisait
// l'ancien <script src="/shared/gameData.js"> classique, puis on relit ce global une fois exécuté —
// un seul fichier de formules, jamais deux copies qui pourraient un jour diverger silencieusement.
import "/shared/gameData.js";
const GameData = globalThis.GameData;

export const {
  BUILDINGS, BUILD_ORDER, TROOPS, TROOP_ORDER, INFANTRY, CAVALRY, ARCHERS, GUILD_BOOSTS, SERVER_EVENTS,
  ACHIEVEMENTS, ACHIEVEMENT_TIER_LABELS, COMMANDER_BRANCHES, COMMANDER_MAX_TIER, commanderXpToNext,
  clamp, buildCost, buildTime, prodPerHour, storageCap, farmCap, trainTime, BUILD_TIME_FACTOR, TRAIN_TIME_FACTOR,
  VILLAGE_TAGS, VILLAGE_TAG_KEYS, PERMANENT_FACTIONS, EVENT_FACTIONS
} = GameData;

export default GameData;
