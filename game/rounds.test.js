'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUND_DEFINITIONS, targetCount, expandRound, shuffledSpawnGroups } from './rounds.js';

test('defines exactly 30 ordered rounds', () => {
  assert.equal(ROUND_DEFINITIONS.length, 30);
  assert.deepEqual(ROUND_DEFINITIONS.map((round) => round.round), Array.from({ length: 30 }, (_, index) => index + 1));
});

test('preserves existing round sizes and special boss rounds', () => {
  assert.equal(targetCount(1), 10);
  assert.equal(targetCount(20), 200);
  assert.equal(targetCount(21), 1020);
  assert.equal(targetCount(28), 1160);
  assert.equal(targetCount(29), 1);
  assert.equal(targetCount(30), 2);
  ROUND_DEFINITIONS.forEach((round) => assert.equal(expandRound(round).length, targetCount(round.round)));
});

test('mixes all colors with the requested early and late frequencies', () => {
  for (const round of ROUND_DEFINITIONS.slice(0, 28)) {
    const { red, blue, green, yellow } = Object.fromEntries(round.groups.map(({ type, count }) => [type, count]));
    assert.ok(Math.min(red, blue, green, yellow) > 0);
    if (round.round < 20) assert.ok(red > blue && blue > green && green > yellow);
    else assert.ok(blue > green && green > yellow && yellow > red);
  }
  const averageHp = (round) => round.groups.reduce((sum, { type, count }) => sum + count * ({ red: 1, blue: 2, green: 4, yellow: 7 }[type]), 0) / targetCount(round.round);
  for (let index = 19; index < 28; index += 1) {
    assert.ok(averageHp(ROUND_DEFINITIONS[index]) > averageHp(ROUND_DEFINITIONS[index - 1]));
  }
  assert.deepEqual(ROUND_DEFINITIONS[28].groups, [{ type: 'boss', count: 1 }]);
  assert.deepEqual(ROUND_DEFINITIONS[29].groups, [{ type: 'boss', count: 2 }]);
});

test('shuffles actual spawns without losing colors, counts or changing definitions', () => {
  let seed = 12345;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  for (const round of ROUND_DEFINITIONS) {
    const before = JSON.stringify(round);
    const groups = shuffledSpawnGroups(round, random);
    assert.deepEqual(expandRound({ groups }).sort(), expandRound(round).sort());
    assert.equal(JSON.stringify(round), before);
    if (round.round < 29) assert.ok(groups.length > 4);
    else assert.deepEqual(groups, round.groups);
  }
  assert.notDeepEqual(shuffledSpawnGroups(ROUND_DEFINITIONS[19], random), shuffledSpawnGroups(ROUND_DEFINITIONS[19], random));
});
