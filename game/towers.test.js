import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './modules/config.js';
import { canBuildAt } from './modules/building.js';
import { createTower, towerDamage, canMergeTowers, towerAtPoint, towerDropResult, towerPlacementResult, purchaseTower, dropTower, removeTower } from './modules/towers.js';

function sideWith(...towers) {
  return { gold: 0, towers, projectiles: [], map: {
    hudCrop: 0, image: { naturalWidth: 320, naturalHeight: 240 },
    buildZones: [{ x: 20, y: 20, w: 240, h: 160 }]
  } };
}

for (const type of Object.keys(CONFIG.TOWERS)) {
  test(`${type}: buying onto a matching tower upgrades once and only charges on commit`, () => {
    const target = createTower(type, 36, 36);
    target.cooldown = 0.27;
    target.frameIndex = 6;
    const side = sideWith(target);
    const cost = CONFIG.TOWERS[type].cost;
    side.gold = cost * 2;
    const before = structuredClone(side);
    for (let i = 0; i < 10; i++) {
      const preview = towerPlacementResult(side, type, 44, 52, 44, 48); // On the level badge, not on the snapped cell.
      assert.equal(preview.result, 'merge');
      assert.equal(preview.target, target);
      assert.deepEqual(side, before);
    }
    const outcome = purchaseTower(side, type, 44, 52, 44, 48);
    assert.equal(outcome.result, 'merge');
    assert.deepEqual(side.towers, [outcome.tower]);
    assert.deepEqual([outcome.tower.x, outcome.tower.y, outcome.tower.level], [36, 36, 2]);
    assert.equal(outcome.tower.damage, CONFIG.TOWERS[type].damage * 1.5);
    for (const key of ['range', 'fireRate', 'cooldown', 'frameIndex', 'color']) assert.equal(outcome.tower[key], target[key]);
    assert.equal(side.gold, cost);
    const after = structuredClone(side);
    assert.equal(purchaseTower(side, type, 36, 36).result, 'incompatible');
    assert.deepEqual(side, after);
  });
}

test('leaving a purchase-merge preview allows an ordinary level-1 purchase on free terrain', () => {
  const side = sideWith(createTower('cactus', 36, 36));
  side.gold = 100;
  assert.equal(towerPlacementResult(side, 'cactus', 36, 36).result, 'merge');
  assert.equal(towerPlacementResult(side, 'cactus', 84, 36).result, 'build');
  const outcome = purchaseTower(side, 'cactus', 84, 36);
  assert.equal(outcome.result, 'build');
  assert.equal(side.towers.length, 2);
  assert.ok(side.towers.every(t => t.level === 1));
  assert.equal(side.gold, 75);
});

test('a purchase rechecks money, target level and type; invalid actions consume nothing', () => {
  for (const [type, level, gold, expected] of [
    ['cactus', 1, 24, 'gold'], ['fan', 1, 100, 'incompatible'],
    ['cactus', 2, 100, 'incompatible'], ['cactus', 3, 100, 'incompatible']
  ]) {
    const target = { ...createTower(type, 36, 36), level };
    const side = sideWith(target);
    side.gold = gold;
    const before = structuredClone(side);
    assert.equal(towerPlacementResult(side, 'cactus', 36, 36).result, expected);
    assert.equal(purchaseTower(side, 'cactus', 36, 36).result, expected);
    assert.deepEqual(side, before);
  }
  const side = sideWith(createTower('cactus', 36, 36));
  side.gold = 25;
  assert.equal(towerPlacementResult(side, 'cactus', 36, 36).result, 'merge');
  side.gold = 0;
  const before = structuredClone(side);
  assert.equal(purchaseTower(side, 'cactus', 36, 36).result, 'gold');
  assert.deepEqual(side, before);
  side.gold = 25;
  side.towers[0].level = 2;
  assert.equal(purchaseTower(side, 'cactus', 36, 36).result, 'incompatible');
  assert.equal(side.gold, 25);
  assert.equal(purchaseTower(side, 'cactus', 4, 4).result, 'zone');
  assert.equal(side.gold, 25);
});

test('two purchased upgrades can be dragged together through the same merge transaction', () => {
  const side = sideWith(createTower('lens', 36, 36), createTower('lens', 84, 36));
  side.gold = 140;
  const first = purchaseTower(side, 'lens', 36, 36).tower;
  const second = purchaseTower(side, 'lens', 84, 36).tower;
  first.cooldown = 0.7;
  second.cooldown = 0.4;
  const outcome = dropTower(side, first, 84, 36, second);
  assert.equal(outcome.result, 'merge');
  assert.equal(outcome.tower.level, 3);
  assert.equal(outcome.tower.damage, 7.5);
  assert.equal(outcome.tower.cooldown, 0.7);
  assert.deepEqual(side.towers, [outcome.tower]);
  assert.equal(side.gold, 0);
});

for (const type of Object.keys(CONFIG.TOWERS)) {
  test(`${type}: levels use original damage and preserve attack behavior`, () => {
    const base = CONFIG.TOWERS[type];
    const towers = [36, 60, 84, 108].map((x) => createTower(type, x, 36));
    const side = sideWith(...towers);
    assert.ok(towers.every((tower) => tower.level === 1 && tower.damage === base.damage));
    towers[0].cooldown = 0.21;
    towers[1].cooldown = 0.13;
    towers[1].frameIndex = 7;
    const second = dropTower(side, towers[0], 60, 36, towers[1]).tower;
    assert.equal(second.level, 2);
    assert.equal(second.damage, base.damage * 1.5);
    assert.equal(second.cooldown, 0.21);
    assert.equal(second.frameIndex, 7);
    assert.equal(side.towers.length, 3);
    assert.ok(!side.towers.includes(towers[0]) && !side.towers.includes(towers[1]));
    const otherSecond = dropTower(side, towers[2], 108, 36, towers[3]).tower;
    const third = dropTower(side, second, 108, 36, otherSecond).tower;
    assert.equal(third.level, 3);
    assert.equal(third.damage, base.damage * 2.5);
    assert.deepEqual(side.towers, [third]);
    assert.deepEqual([third.x, third.y], [108, 36]);
    assert.equal(third.cooldown, 0.21);
    for (const key of ['range', 'fireRate', 'color']) assert.equal(third[key], base[key]);
    assert.equal(side.gold, 0);
    assert.equal(towerDamage(type, 3), base.damage * 2.5);
  });
}

test('different types, levels, max level, self and foreign towers cannot merge', () => {
  for (const [type, sourceLevel, targetLevel] of [
    ['fan', 1, 1], ['cactus', 1, 2], ['cactus', 2, 1], ['cactus', 3, 3]
  ]) {
    const source = { ...createTower('cactus', 36, 36), level: sourceLevel };
    const target = { ...createTower(type, 60, 36), level: targetLevel };
    const side = sideWith(source, target);
    const before = structuredClone(side);
    assert.equal(canMergeTowers(source, target), false);
    assert.equal(dropTower(side, source, 60, 36, target).result, 'incompatible');
    assert.deepEqual(side, before);
  }
  const source = createTower('cactus', 36, 36);
  const foreign = createTower('cactus', 60, 36);
  const side = sideWith(source);
  assert.equal(dropTower(side, source, 60, 36, foreign).result, 'incompatible');
  assert.equal(dropTower(side, foreign, 36, 36, source).result, 'missing');
  assert.equal(canMergeTowers(source, source), false);
});

test('moving is free and preserves identity, level, cooldown and other live state', () => {
  const source = { ...createTower('lens', 36, 36), level: 3, damage: 7.5, cooldown: 0.73, frameIndex: 9 };
  const side = sideWith(source);
  const before = { ...source };
  assert.equal(dropTower(side, source, 44, 36).result, 'move');
  assert.equal(side.towers[0], source);
  assert.deepEqual(source, { ...before, x: 44 });
  assert.equal(dropTower(side, source, 44, 36).result, 'move');
  assert.equal(side.gold, 0);
});

test('invalid terrain and occupied destinations leave every tower unchanged', () => {
  const source = createTower('fan', 36, 36);
  const obstacle = createTower('lens', 84, 36);
  const side = sideWith(source, obstacle);
  const before = structuredClone(side);
  for (const [x, y, expected] of [[4, 4, 'zone'], [-4, 36, 'zone'], [324, 36, 'zone'], [76, 36, 'occupied']]) {
    assert.equal(towerDropResult(side, source, x, y), expected);
    assert.equal(dropTower(side, source, x, y).result, expected);
    assert.deepEqual(side, before);
  }
});

test('hit testing finds own sprite and prefers the nearest tower', () => {
  const first = createTower('cactus', 36, 36);
  const second = createTower('fan', 52, 36);
  const side = sideWith(first, second);
  assert.equal(towerAtPoint(side, 36, 22), first);
  assert.equal(towerAtPoint(side, 47, 36), second);
  assert.equal(towerAtPoint(side, 36, 36, first), null);
  assert.equal(towerAtPoint(side, 2, 2), null);
});

test('removal frees the place once, gives no refund, and leaves fired shots alone', () => {
  const tower = createTower('cactus', 36, 36);
  const side = sideWith(tower);
  side.projectiles.push({ damage: tower.damage, life: 0.04 });
  const projectile = side.projectiles[0];
  assert.equal(removeTower(side, createTower('fan', 84, 36)), false);
  assert.equal(removeTower(side, tower), true);
  assert.equal(removeTower(side, tower), false);
  assert.equal(side.towers.length, 0);
  assert.equal(side.gold, 0);
  assert.equal(canBuildAt(side, 'cactus', 36, 36, true), true);
  assert.equal(side.projectiles[0], projectile);
});
