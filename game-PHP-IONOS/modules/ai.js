import { CONFIG } from './config.js';
import { BUILD_ZONES } from './maps.js';
import { buildZonesForMap, canBuildAt, mapPathPoint } from './building.js';
import { towerDamage } from './towers.js';

function desiredAIFieldCount(round) {
  if (round <= 0) return 0;
  return Math.min(BUILD_ZONES.length, 1 + Math.floor(((round - 1) * (BUILD_ZONES.length - 1)) / 19));
}

function firstGridCenter(value) {
  return Math.ceil((value - CONFIG.GRID_SIZE / 2) / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
}

function getAIBuildFields(side) {
  return buildZonesForMap(side.map).map((zone, fieldIndex) => {
    const spots = [];
    for (let y = firstGridCenter(zone.y); y <= zone.y + zone.h; y += CONFIG.GRID_SIZE) {
      for (let x = firstGridCenter(zone.x); x <= zone.x + zone.w; x += CONFIG.GRID_SIZE) spots.push({ x, y });
    }
    return { fieldIndex, spots, targetCount: spots.length };
  });
}

// Sample equal distances along every route, including alternate Woodland paths.
function pathSamples(map) {
  return (map.paths || []).flatMap(path => {
    const points = path.map(point => mapPathPoint(map, point));
    const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    let walked = 0;
    return lengths.flatMap((length, i) => {
      const samples = [];
      for (let distance = 0; distance < length; distance += 8) {
        const fraction = distance / length;
        samples.push({ x: points[i].x + (points[i + 1].x - points[i].x) * fraction,
          y: points[i].y + (points[i + 1].y - points[i].y) * fraction,
          progress: (walked + distance) / total });
      }
      walked += length;
      return samples;
    });
  });
}

function incomingThreat(side) {
  const balloons = side.balloons || [];
  const queued = side.sendQueue || [];
  const count = balloons.length + queued.reduce((sum, batch) => sum + batch.remaining, 0);
  const tough = balloons.filter(balloon => balloon.hp >= 4).length
    + queued.filter(batch => CONFIG.BALLOONS[batch.type].hp >= 4).reduce((sum, batch) => sum + batch.remaining, 0);
  return { count, tough };
}

function positionScore(side, spot, type, samples, random) {
  const covered = samples.filter(point => Math.hypot(point.x - spot.x, point.y - spot.y) <= CONFIG.TOWERS[type].range);
  if (!covered.length) return -Infinity;
  const fieldCount = side.towers.filter(tower => tower.fieldIndex === spot.fieldIndex).length;
  const coverage = covered.reduce((sum, point) => {
    const defenders = side.towers.filter(tower => Math.hypot(point.x - tower.x, point.y - tower.y) <= tower.range).length;
    // Favour uncovered road sections, with a modest preference for the middle.
    return sum + (1 / (1 + defenders)) * (point.progress > 0.15 && point.progress < 0.85 ? 1.2 : 1);
  }, 0);
  const nearest = side.towers.reduce((distance, tower) => Math.min(distance, Math.hypot(spot.x - tower.x, spot.y - tower.y)), 40);
  return coverage / (1 + fieldCount * 0.35) * (0.8 + random() * 0.4) + nearest * 0.08;
}

function buyAITower(gameState, tryBuildTower, random = Math.random) {
  const side = gameState.enemy;
  const round = gameState.currentRound;
  if (round <= 0) return false;
  const now = gameState.secondsElapsed || 0;
  if (side.aiRound === round && now < (side.aiNextDecision || 0)) return false;
  side.aiRound = round;
  side.aiNextDecision = now + 2;
  const threat = incomingThreat(side);
  const towerLimit = Math.min(28, 2 + Math.floor((round - 1) * 0.9) + Math.min(4, Math.floor(threat.count / 40)));
  const maxLevel = round >= 18 ? 3 : round >= 8 ? 2 : 1;
  const upgradeLimit = Math.floor(side.towers.length * (threat.count >= 40 ? 0.55 : 0.35));
  const thirdLevelLimit = Math.floor(side.towers.length * 0.2);
  const upgraded = side.towers.filter(tower => tower.level > 1).length;
  const thirds = side.towers.filter(tower => tower.level === 3).length;
  const samples = pathSamples(side.map);
  const upgradeCandidates = side.towers.filter(tower => tower.level < maxLevel
    && (tower.level === 1 ? upgraded < upgradeLimit : thirds < thirdLevelLimit)
    && side.gold >= CONFIG.TOWERS[tower.type].cost * 2 ** (tower.level - 1));
  // Upgrades cost the same as the additional towers needed for a player merge.
  if (upgradeCandidates.length && (side.towers.length >= towerLimit || threat.count >= 40 || random() < 0.4)) {
    const ranked = upgradeCandidates.map(tower => ({ tower,
      score: positionScore({ ...side, towers: side.towers.filter(other => other !== tower) }, tower, tower.type, samples, random)
        * (threat.tough > 0 && tower.type === 'lens' ? 1.5 : 1) })).sort((a, b) => b.score - a.score);
    const tower = ranked[0].tower;
    side.gold -= CONFIG.TOWERS[tower.type].cost * 2 ** (tower.level - 1);
    tower.level += 1;
    tower.damage = towerDamage(tower.type, tower.level);
    tower.mergeEffectAge = 0;
    return true;
  }
  if (side.towers.length >= towerLimit) return false;
  const available = ['cactus', ...(round >= 4 ? ['fan'] : []), ...(round >= 10 ? ['lens'] : [])]
    .filter(type => side.gold >= CONFIG.TOWERS[type].cost);
  const types = available.map(type => ({ type, score: random()
    + (type === 'fan' && threat.count >= 20 ? 1 : 0)
    + (type === 'lens' && threat.tough >= 5 ? 1.5 : 0)
    + 0.25 / (1 + side.towers.filter(tower => tower.type === type).length) })).sort((a, b) => b.score - a.score);
  for (const { type } of types) {
    const candidates = getAIBuildFields(side).flatMap(field => field.spots.map(spot => ({ ...spot, fieldIndex: field.fieldIndex })))
      .filter(spot => canBuildAt(side, type, spot.x, spot.y) === true)
      .map(spot => ({ ...spot, score: positionScore(side, spot, type, samples, random) }))
      .filter(spot => Number.isFinite(spot.score)).sort((a, b) => b.score - a.score);
    if (!candidates.length) continue;
    // Choose among similarly useful locations instead of a fixed row order.
    const shortlist = candidates.filter(spot => spot.score >= candidates[0].score * 0.85).slice(0, 12);
    const spot = shortlist[Math.min(shortlist.length - 1, Math.floor(random() * shortlist.length))];
    if (tryBuildTower(side, type, spot.x, spot.y) === true) {
      side.towers[side.towers.length - 1].fieldIndex = spot.fieldIndex;
      return true;
    }
  }
  return false;
}

export { buyAITower, desiredAIFieldCount, getAIBuildFields };
