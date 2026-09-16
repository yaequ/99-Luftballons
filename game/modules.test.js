import test from 'node:test';
import assert from 'node:assert/strict';

// These tests exercise logic only; no image decoding or browser is needed.
globalThis.Image = class { dataset = {}; };
const { createInitialState, createSide } = await import('./modules/state.js');
const { canBuildAt, mapPathPoint, buildZonesForMap } = await import('./modules/building.js');
const { desiredAIFieldCount, getAIBuildFields, buyAITower } = await import('./modules/ai.js');

const map = { logicalCrop: 12, hudCrop: 40, image: { naturalWidth: 960, naturalHeight: 760 } };

test('new matches and sides do not share mutable state', () => {
  const first = createInitialState();
  const second = createInitialState();
  assert.notEqual(first.player.map, first.enemy.map);
  assert.equal(first.active, false);
  assert.equal(first.currentRound, 0);
  first.player.towers.push({ x: 100, y: 40 });
  first.enemy.sendQueue.push({ type: 'red', remaining: 10 });
  assert.equal(first.enemy.towers.length, 0);
  assert.equal(second.player.towers.length, 0);
  assert.equal(second.enemy.sendQueue.length, 0);
});

test('building requires money, a build zone and sufficient tower distance', () => {
  const side = createSide(map);
  assert.equal(canBuildAt(side, 'cactus', 100, 40), true);
  side.gold = 24;
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
