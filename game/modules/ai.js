import { CONFIG } from './config.js';
import { BUILD_ZONES } from './maps.js';
import { buildZonesForMap } from './building.js';
function desiredAIFieldCount(round) {
  if (round <= 0) return 0;
  return Math.min(BUILD_ZONES.length, 1 + Math.floor(((round - 1) * (BUILD_ZONES.length - 1)) / 19));
}

function firstGridCenter(value) {
  return Math.ceil((value - CONFIG.GRID_SIZE / 2) / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
}

function getAIBuildFields(side) {
  return buildZonesForMap(side.map).map((zone, fieldIndex) => {
    const isLarge = zone.w * zone.h >= 1800;
    const targetCount = isLarge ? 5 + (fieldIndex % 4) : 3 + (fieldIndex % 4);
    const spots = [];
    for (let y = firstGridCenter(zone.y); y <= zone.y + zone.h; y += CONFIG.GRID_SIZE * 2) {
      for (let x = firstGridCenter(zone.x); x <= zone.x + zone.w; x += CONFIG.GRID_SIZE * 2) spots.push({ x, y });
    }
    return { fieldIndex, isLarge, targetCount, spots: spots.slice(0, targetCount) };
  });
}

function buyAITower(gameState, tryBuildTower) {
  const targetFieldCount = desiredAIFieldCount(gameState.currentRound);
  const priorities = gameState.currentRound >= 20 ? ['lens', 'fan', 'cactus'] : gameState.currentRound >= 10 ? ['fan', 'cactus'] : ['cactus'];
  const fields = getAIBuildFields(gameState.enemy);

  for (const field of fields.slice(0, targetFieldCount)) {
    const existing = gameState.enemy.towers.filter((tower) => tower.fieldIndex === field.fieldIndex).length;
    const missing = field.targetCount - existing;
    if (missing <= 0) continue;
    if (gameState.enemy.gold < missing * CONFIG.TOWERS.cactus.cost) break;

    for (const spot of field.spots.slice(existing)) {
      const type = priorities.find((candidate) => gameState.enemy.gold >= CONFIG.TOWERS[candidate].cost);
      if (!type || tryBuildTower(gameState.enemy, type, spot.x, spot.y) !== true) break;
      gameState.enemy.towers[gameState.enemy.towers.length - 1].fieldIndex = field.fieldIndex;
    }
  }
}

export { buyAITower, desiredAIFieldCount, getAIBuildFields };
