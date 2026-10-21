import { CONFIG } from './ai-config.js';
import { canBuildAt } from './ai-building.js';

function canControlTowers(state) {
  return Boolean((state.active || state.preparing) && !state.paused);
}

function hasFreeBuild(side) {
  return side.freeBuildsRemaining > 0;
}

function towerDamage(type, level) {
  return CONFIG.TOWERS[type].damage * CONFIG.TOWER_LEVEL_MULTIPLIERS[level - 1];
}

function createTower(type, x, y) {
  const data = CONFIG.TOWERS[type];
  return {
    x, y, type, level: 1,
    range: data.range, damage: towerDamage(type, 1), fireRate: data.fireRate,
    cooldown: 0, color: data.color, frameIndex: 0
  };
}

function canMergeTowers(source, target) {
  return Boolean(source && target && source !== target && source.type === target.type
    && source.level === target.level && source.level >= 1
    && source.level < CONFIG.TOWER_LEVEL_MULTIPLIERS.length);
}

// Include both the sprite and its visible level badge.
// Prefer the nearest anchor in crowded fields.
function towerAtPoint(side, x, y, ignoredTower = null) {
  let nearest = null;
  let distance = Infinity;
  for (const tower of side.towers) {
    if (tower === ignoredTower) continue;
    const onSprite = Math.abs(x - tower.x) <= CONFIG.CHARACTER_RENDER.MAX_WIDTH / 2
      && Math.abs(y - (tower.y - 4)) <= CONFIG.CHARACTER_RENDER.HEIGHT / 2;
    const onBadge = x >= tower.x + 3 && x <= tower.x + 13
      && y >= tower.y + 3 && y <= tower.y + 13;
    if (!onSprite && !onBadge) continue;
    const candidateDistance = Math.hypot(x - tower.x, y - tower.y);
    if (candidateDistance < distance) {
      nearest = tower;
      distance = candidateDistance;
    }
  }
  return nearest;
}

function towerDropResult(side, source, x, y, target = null) {
  if (!side.towers.includes(source)) return 'missing';
  if (target) return side.towers.includes(target) && canMergeTowers(source, target) ? 'merge' : 'incompatible';
  const result = canBuildAt(side, source.type, x, y, true, source);
  return result === true ? 'move' : result;
}

// One transaction for both a purchased level-1 tower and an existing dragged tower.
// Revalidate here before mutating the array or charging any gold.
function mergeTowers(side, source, target, purchased = false) {
  if (!side.towers.includes(target) || (!purchased && !side.towers.includes(source))) return { result: 'missing' };
  if (!canMergeTowers(source, target) || (purchased && (source.level !== 1 || side.towers.includes(source)))) return { result: 'incompatible' };
  const cost = purchased ? CONFIG.TOWERS[source.type].cost : 0;
  if (side.gold < cost) return { result: 'gold' };
  const level = target.level + 1;
  const merged = { ...target, level, damage: towerDamage(target.type, level),
    cooldown: Math.max(source.cooldown, target.cooldown), mergeEffectAge: 0 };
  side.towers.splice(side.towers.indexOf(target), 1, merged);
  if (!purchased) side.towers.splice(side.towers.indexOf(source), 1);
  side.gold -= cost;
  return { result: 'merge', tower: merged };
}

// Shared by the preview, pointer/keyboard activation and the final purchase.
// hitX/hitY are unrounded canvas coordinates; x/y are the grid-aligned build spot.
function towerPlacementResult(side, type, x, y, hitX = x, hitY = y) {
  const intent = { type, x, y, target: null, result: 'zone' };
  if (!CONFIG.TOWERS[type] || ![x, y, hitX, hitY].every(Number.isFinite)
    || hitX < 0 || hitY < 0 || hitX >= CONFIG.CANVAS_WIDTH || hitY >= CONFIG.CANVAS_HEIGHT) return intent;
  intent.target = towerAtPoint(side, hitX, hitY) || towerAtPoint(side, x, y);
  if (intent.target) {
    if (!canMergeTowers({ type, level: 1 }, intent.target)) intent.result = 'incompatible';
    else if (side.gold < CONFIG.TOWERS[type].cost) intent.result = 'gold';
    else intent.result = 'merge';
  } else {
    const result = canBuildAt(side, type, x, y, hasFreeBuild(side));
    intent.result = result === true ? 'build' : result;
  }
  return intent;
}

function purchaseTower(side, type, x, y, hitX = x, hitY = y) {
  const intent = towerPlacementResult(side, type, x, y, hitX, hitY);
  if (intent.result !== 'build' && intent.result !== 'merge') return { result: intent.result };
  const tower = createTower(type, x, y);
  if (intent.result === 'merge') return mergeTowers(side, tower, intent.target, true);
  if (hasFreeBuild(side)) side.freeBuildsRemaining -= 1;
  else side.gold -= CONFIG.TOWERS[type].cost;
  side.towers.push(tower);
  return { result: 'build', tower };
}

function dropTower(side, source, x, y, target = null) {
  const result = towerDropResult(side, source, x, y, target);
  if (result === 'move') {
    // Preserve identity and every live state value, including remaining cooldown.
    source.x = x;
    source.y = y;
    return { result, tower: source };
  }
  if (result === 'merge') {
    return mergeTowers(side, source, target);
  }
  return { result, tower: source };
}

function removeTower(side, tower) {
  const index = side.towers.indexOf(tower);
  if (index === -1) return false;
  side.towers.splice(index, 1);
  // Already fired projectiles finish normally; attacks only iterate side.towers.
  return true;
}

export { canControlTowers, hasFreeBuild, towerDamage, createTower, canMergeTowers, towerAtPoint, towerDropResult, mergeTowers, towerPlacementResult, purchaseTower, dropTower, removeTower };
