import { MAP_DATA } from './maps.js';
import { CONFIG } from './ai-config.js';
function createSide(map) {
  return {
    map,
    hp: 99,
    gold: 100,
    income: 5,
    sendIncomeTotal: 0,
    sendIncomeRound: 0,
    sendIncomeThisRound: 0,
    lastGoldBonusRound: 0,
    towers: [],
    balloons: [],
    sendQueue: [],
    sendClock: 0,
    projectiles: [],
    pops: []
  };
}

function createInitialState() {
  const maps = Object.values(MAP_DATA);
  const playerMap = maps[Math.floor(Math.random() * maps.length)];
  const enemyMaps = maps.filter((map) => map !== playerMap);

  return {
    active: false,
    preparing: false,
    paused: false,
    resultSubmitted: false,
    secondsElapsed: 0,
    economyClock: 0,
    selectedTowerType: null,
    buildCursor: { x: 100, y: 40, active: false },
    currentRound: 0,
    roundStatus: 'ready',
    spawnGroups: [],
    spawnGroupIndex: 0,
    spawnRemainingInGroup: 0,
    spawnClock: 0,
    remainingEnemies: 0,
    intermissionRemaining: 0,
    autoStart: true,
    player: { ...createSide(playerMap), freeBuildsRemaining: CONFIG.STARTER_TOWERS },
    enemy: createSide(enemyMaps[Math.floor(Math.random() * enemyMaps.length)] || playerMap)
  };
}

export { createSide, createInitialState };
