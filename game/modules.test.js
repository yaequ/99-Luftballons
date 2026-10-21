import test from 'node:test';
import assert from 'node:assert/strict';

// These tests exercise logic only; no image decoding or browser is needed.
globalThis.Image = class { dataset = {}; };
const { createInitialState, createSide } = await import('./modules/ai-state.js');
const { canBuildAt, mapPathPoint, buildZonesForMap } = await import('./modules/ai-building.js');
const { desiredAIFieldCount, getAIBuildFields, buyAITower } = await import('./modules/ai.js');
const { CONFIG } = await import('./modules/ai-config.js');
const { createTower, purchaseTower, dropTower, towerDamage } = await import('./modules/towers.js');
const { sendBatchSize, isSendUnlocked, queuePlayerSend } = await import('./modules/sending.js');
const { grantRoundGold } = await import('./modules/economy.js');

const map = {
  logicalCrop: 12,
  hudCrop: 40,
  image: { naturalWidth: 960, naturalHeight: 760 },
  buildZones: Array.from({ length: 8 }, (_, index) => ({
    x: 40 + (index % 2) * 460, y: 80 + Math.floor(index / 2) * 160, w: 410, h: 160
  })),
  paths: [[{ x: 0, y: 120 }, { x: 960, y: 120 }]]
};

test('new matches and sides do not share mutable state', () => {
  const first = createInitialState();
  const second = createInitialState();
  assert.notEqual(first.player.map, first.enemy.map);
  assert.equal(first.active, false);
  assert.equal(first.currentRound, 0);
  assert.equal(first.player.freeBuildsRemaining, CONFIG.STARTER_TOWERS);
  first.player.towers.push({ x: 100, y: 40 });
  first.enemy.sendQueue.push({ type: 'red', remaining: 10 });
  assert.equal(first.enemy.towers.length, 0);
  assert.equal(second.player.towers.length, 0);
  assert.equal(second.enemy.sendQueue.length, 0);
});

test('building requires money, a build zone and sufficient tower distance', () => {
  const side = createSide(map);
  assert.equal(canBuildAt(side, 'cactus', 100, 40), true);
  side.gold = CONFIG.TOWERS.cactus.cost - 1;
  assert.equal(canBuildAt(side, 'cactus', 100, 40), 'gold');
  assert.equal(canBuildAt(side, 'cactus', 100, 40, true), true);
  side.gold = 100;
  assert.equal(canBuildAt(side, 'cactus', 0, 0), 'zone');
  side.towers.push({ x: 100, y: 40 });
  assert.equal(canBuildAt(side, 'cactus', 108, 40), 'occupied');
  assert.equal(canBuildAt(side, 'cactus', 116, 40), true);
});

test('map coordinates account for the cropped header and image size', () => {
  assert.deepEqual(mapPathPoint(map, { x: 0, y: 40 }), { x: 0, y: 0 });
  assert.deepEqual(mapPathPoint(map, { x: 960, y: 760 }), { x: 320, y: 240 });
  assert.equal(buildZonesForMap(map).length, 8);
});

test('AI expands to all eight fields by round 20 with valid build spots', () => {
  assert.equal(desiredAIFieldCount(0), 0);
  assert.equal(desiredAIFieldCount(1), 1);
  assert.equal(desiredAIFieldCount(20), 8);
  assert.equal(desiredAIFieldCount(30), 8);
  const side = createSide(map);
  for (const field of getAIBuildFields(side)) {
    assert.equal(field.spots.length, field.targetCount);
    for (const { x, y } of field.spots) assert.equal(canBuildAt(side, 'cactus', x, y), true);
  }
  side.gold = 0;
  buyAITower({ currentRound: 20, enemy: side }, () => assert.fail('Cannot buy without gold'));
});

test('AI places a useful tower and upgrades defenses against a large attack', () => {
  const side = createSide(map);
  const build = (target, type, x, y) => {
    if (canBuildAt(target, type, x, y) !== true) return false;
    target.gold -= CONFIG.TOWERS[type].cost;
    target.towers.push(createTower(type, x, y));
    return true;
  };
  assert.equal(buyAITower({ currentRound: 1, secondsElapsed: 0, enemy: side }, build, () => 0.5), true);
  assert.equal(side.towers.length, 1);
  side.towers.push(createTower('cactus', 150, 40), createTower('cactus', 200, 40), createTower('cactus', 250, 40));
  side.balloons = Array.from({ length: 40 }, () => ({ hp: 4 }));
  side.gold = 1000;
  assert.equal(buyAITower({ currentRound: 9, secondsElapsed: 10, enemy: side }, build, () => 0.5), true);
  assert.ok(side.towers.some((tower) => tower.level === 2));
});

test('three starter towers are free, later towers and purchased merges cost gold', () => {
  const side = createSide(map);
  side.freeBuildsRemaining = CONFIG.STARTER_TOWERS;
  for (const x of [100, 124, 148]) assert.equal(purchaseTower(side, 'cactus', x, 40).result, 'build');
  assert.equal(side.freeBuildsRemaining, 0);
  assert.equal(side.gold, 100);
  assert.equal(purchaseTower(side, 'cactus', 100, 64).result, 'build');
  assert.equal(side.gold, 100 - CONFIG.TOWERS.cactus.cost);
  assert.equal(purchaseTower(side, 'cactus', 100, 40).result, 'merge');
  assert.equal(side.towers[0].level, 2);
  assert.equal(side.towers[0].damage, towerDamage('cactus', 2));
  assert.equal(side.gold, 0);
});

test('equal placed towers merge without spending gold and preserve game state', () => {
  const side = createSide(map);
  const first = createTower('fan', 100, 40);
  const second = createTower('fan', 124, 40);
  first.cooldown = 0.4;
  second.cooldown = 0.2;
  side.towers.push(first, second);
  const result = dropTower(side, first, 124, 40, second);
  assert.equal(result.result, 'merge');
  assert.equal(side.towers.length, 1);
  assert.equal(result.tower.level, 2);
  assert.equal(result.tower.cooldown, 0.4);
  assert.equal(side.gold, 100);
});

test('balloon sends unlock by round, grow in batches and cap bonus income', () => {
  const state = createInitialState();
  state.active = true;
  state.currentRound = 1;
  assert.equal(isSendUnlocked('blue', state.currentRound), false);
  assert.equal(queuePlayerSend(state, 'blue'), false);
  assert.equal(sendBatchSize(1, 'red'), 3);
  assert.equal(sendBatchSize(30, 'yellow'), 5);
  assert.equal(queuePlayerSend(state, 'red'), true);
  assert.equal(state.enemy.sendQueue[0].remaining, 3);
  assert.equal(state.player.income, 5.1);
  for (let index = 0; index < 10; index += 1) queuePlayerSend(state, 'red');
  assert.ok(state.player.sendIncomeThisRound <= CONFIG.SEND_INCOME.perRound);
  state.currentRound = 15;
  state.player.gold = 1000;
  assert.equal(queuePlayerSend(state, 'yellow'), true);
  assert.equal(state.enemy.sendQueue.at(-1).remaining, 5);
});

test('round gold bonus is granted once to each side in the configured round', () => {
  const state = createInitialState();
  state.currentRound = 20;
  assert.equal(grantRoundGold(state), true);
  assert.equal(state.player.gold, 100 + CONFIG.ROUND_GOLD_BONUSES[20]);
  assert.equal(state.enemy.gold, 100 + CONFIG.ROUND_GOLD_BONUSES[20]);
  assert.equal(grantRoundGold(state), false);
});
