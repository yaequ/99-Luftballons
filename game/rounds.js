(function attachRoundConfig(root) {
  'use strict';

  const BASE_ROUNDS = Array.from({ length: 30 }, (_, index) => {
    const round = index + 1;
    if (round >= 29) return [['boss', round === 29 ? 1 : 2]];
    if (round < 20) return [['red', 40], ['blue', 30], ['green', 20], ['yellow', 10]];
    const progress = (round - 20) / 8;
    return [
      ['red', 10 - 5 * progress],
      ['blue', 40 - 5 * progress],
      ['green', 30 + 2 * progress],
      ['yellow', 20 + 8 * progress]
    ];
  });

  function targetCount(round) {
    if (round >= 29) return round === 29 ? 1 : 2;
    return round <= 20 ? round * 10 : 1000 + (round - 20) * 20;
  }

  function scaleGroups(baseGroups, total) {
    const baseTotal = baseGroups.reduce((sum, group) => sum + group[1], 0);
    let assigned = 0;
    const scaled = baseGroups.map(([type, count], index) => {
      const exact = (count / baseTotal) * total;
      const floor = Math.floor(exact);
      assigned += floor;
      return { type, count: floor, fraction: exact - floor, index };
    });

    scaled
      .slice()
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
      .slice(0, total - assigned)
      .forEach((group) => { group.count += 1; });

    return scaled.map(({ type, count }) => ({ type, count }));
  }

  const ROUND_DEFINITIONS = Object.freeze(BASE_ROUNDS.map((groups, index) => {
    const round = index + 1;
    return Object.freeze({
      round,
      groups: Object.freeze(scaleGroups(groups, targetCount(round)).map(Object.freeze))
    });
  }));

  function expandRound(roundDefinition) {
    return roundDefinition.groups.flatMap((group) => Array(group.count).fill(group.type));
  }

  function shuffledSpawnGroups(roundDefinition, random = Math.random) {
    const balloons = expandRound(roundDefinition);
    for (let index = balloons.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [balloons[index], balloons[other]] = [balloons[other], balloons[index]];
    }
    const groups = [];
    for (const type of balloons) {
      const last = groups[groups.length - 1];
      if (last && last.type === type) last.count += 1;
      else groups.push({ type, count: 1 });
    }
    return groups;
  }

  const api = Object.freeze({ BASE_ROUNDS, ROUND_DEFINITIONS, targetCount, scaleGroups, expandRound, shuffledSpawnGroups });
  root.RoundConfig = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
