import { CONFIG } from '../game/modules/ai-config.js';
import { createSide } from '../game/modules/ai-state.js';
import { mapPathPoint, canBuildAt } from '../game/modules/ai-building.js';
import { createTower, mergeTowers, canMergeTowers, towerDamage, dropTower, removeTower } from '../game/modules/towers.js';
import { sendBatchSize, isSendUnlocked } from '../game/modules/sending.js';
import { grantRoundGold } from '../game/modules/economy.js';
import { updateMergeEffect } from '../game/modules/merge-effects.js';
import { ROUND_DEFINITIONS, shuffledSpawnGroups } from '../game/rounds.js';

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function createWave() {
  return { groups: [], groupIndex: 0, remainingInGroup: 0, spawnClock: 0, remaining: 0, doneSpawning: true };
}

function createMultiplayerEngine(playerMap, opponentMap, callbacks = {}) {
  const ownSide = callbacks.ownSide === 2 ? 2 : 1;
  const state = {
    active: false, paused: false, result: null, secondsElapsed: 0, economyClock: 0,
    selectedTowerType: null, buildCursor: { x: 100, y: 40, active: false },
    currentRound: 0, roundStatus: 'ready', remainingEnemies: 0, enemyRemainingEnemies: 0,
    autoStart: false, player: { ...createSide(playerMap), freeBuildsRemaining: CONFIG.STARTER_TOWERS },
    enemy: { ...createSide(opponentMap), freeBuildsRemaining: CONFIG.STARTER_TOWERS },
    waves: { player: createWave(), enemy: createWave() }
  };
  const notify = () => callbacks.onChange?.(state);
  const sideFor = (owner) => owner === 'enemy' ? state.enemy : state.player;

  function buildTowerFor(owner, type, x, y, force = false) {
    if (state.result) return 'finished';
    const side = sideFor(owner);
    const tower = CONFIG.TOWERS[type];
    if (!tower) return 'unknown';
    const free = side.freeBuildsRemaining > 0 && state.currentRound === 0;
    const result = canBuildAt(side, type, x, y, free || force);
    if (result !== true) return result;
    if (free) side.freeBuildsRemaining -= 1;
    else side.gold -= tower.cost;
    side.towers.push(createTower(type, x, y));
    notify();
    return true;
  }

  function buildTower(type, x, y) { return buildTowerFor('player', type, x, y); }

  function mergeTowerFor(owner, sourceIndex, targetIndex, purchased = false) {
    if (state.result) return 'finished';
    const side = sideFor(owner);
    const target = side.towers[targetIndex];
    const source = purchased && target ? createTower(target.type, target.x, target.y) : side.towers[sourceIndex];
    if (!target || !source || !canMergeTowers(source, target)) return 'incompatible';
    const outcome = mergeTowers(side, source, target, purchased);
    if (outcome.result === 'merge') notify();
    return outcome.result === 'merge' ? true : outcome.result;
  }

  function mergeTower(sourceIndex, targetIndex, purchased = false) {
    return mergeTowerFor('player', sourceIndex, targetIndex, purchased);
  }

  function moveTowerFor(owner, sourceIndex, x, y) {
    if (state.result) return 'finished';
    const side = sideFor(owner);
    const source = side.towers[sourceIndex];
    if (!source || !Number.isFinite(x) || !Number.isFinite(y)) return 'missing';
    const outcome = dropTower(side, source, x, y);
    if (outcome.result === 'move') notify();
    return outcome.result === 'move' ? true : outcome.result;
  }

  function moveTower(sourceIndex, x, y) { return moveTowerFor('player', sourceIndex, x, y); }

  function removeTowerFor(owner, sourceIndex) {
    if (state.result) return 'finished';
    const side = sideFor(owner);
    if (!removeTower(side, side.towers[sourceIndex])) return 'missing';
    notify();
    return true;
  }

  function removeOwnTower(sourceIndex) { return removeTowerFor('player', sourceIndex); }

  function spawnBalloon(targetSide, type, fromRound = false, random = Math.random) {
    const balloon = CONFIG.BALLOONS[type];
    const pathRouteIndex = Math.floor(random() * targetSide.map.paths.length);
    const sourcePath = targetSide.map.paths[pathRouteIndex];
    const path = sourcePath.map((point) => mapPathPoint(targetSide.map, point));
    targetSide.balloons.push({ type, x: path[0].x, y: path[0].y, path, pathRouteIndex, pathIndex: 0, hp: balloon.hp, maxHp: balloon.hp, speed: balloon.speed, lifeDamage: balloon.lifeDamage, renderSize: balloon.renderSize, fromRound });
  }

  function sendBalloonFor(owner, type, force = false) {
    if ((!state.active || state.paused) && !force) return 'inactive';
    if (state.result) return 'finished';
    const sender = sideFor(owner);
    const target = owner === 'enemy' ? state.player : state.enemy;
    const balloon = CONFIG.BALLOONS[type];
    if (!balloon || !Number.isFinite(balloon.cost)) return 'unknown';
    if (!isSendUnlocked(type, state.currentRound)) return 'locked';
    if (!force && sender.gold < balloon.cost) return 'gold';
    if (sender.sendIncomeRound !== state.currentRound) {
      sender.sendIncomeRound = state.currentRound;
      sender.sendIncomeThisRound = 0;
    }
    const bonus = Math.round(Math.max(0, Math.min(balloon.income,
      CONFIG.SEND_INCOME.perRound - sender.sendIncomeThisRound,
      CONFIG.SEND_INCOME.total - sender.sendIncomeTotal)) * 100) / 100;
    sender.gold -= balloon.cost;
    sender.income = Math.round((sender.income + bonus) * 100) / 100;
    sender.sendIncomeThisRound = Math.round((sender.sendIncomeThisRound + bonus) * 100) / 100;
    sender.sendIncomeTotal = Math.round((sender.sendIncomeTotal + bonus) * 100) / 100;
    target.sendQueue.push({ type, remaining: sendBatchSize(state.currentRound, type) });
    updateSentBalloons(target, 0); notify(); return true;
  }

  function sendBalloon(type) { return sendBalloonFor('player', type); }

  function prepareWave(owner, definition, random) {
    const wave = state.waves[owner];
    wave.groups = shuffledSpawnGroups(definition, random); wave.groupIndex = 0;
    wave.remainingInGroup = wave.groups[0]?.count || 0; wave.spawnClock = 0;
    wave.remaining = wave.groups.reduce((sum, group) => sum + group.count, 0);
    wave.doneSpawning = wave.groups.length === 0;
  }

  function startRound(seed = Date.now()) {
    if (state.paused || state.result || ['spawning', 'clearing'].includes(state.roundStatus) || state.currentRound >= CONFIG.WAVES) return false;
    state.active = true; state.currentRound += 1;
    state.player.freeBuildsRemaining = 0;
    state.enemy.freeBuildsRemaining = 0;
    grantRoundGold(state);
    const definition = ROUND_DEFINITIONS[state.currentRound - 1];
    prepareWave('player', definition, seededRandom((Number(seed) || 1) + ownSide));
    prepareWave('enemy', definition, seededRandom((Number(seed) || 1) + (ownSide === 1 ? 2 : 1)));
    state.remainingEnemies = state.waves.player.remaining;
    state.enemyRemainingEnemies = state.waves.enemy.remaining;
    state.roundStatus = 'spawning'; notify(); return true;
  }

  function finish(result) {
    if (state.result) return;
    state.result = result; state.active = false; state.roundStatus = 'completed';
    callbacks.onGameOver?.(result, state); notify();
  }

  function finishRound() {
    if (state.currentRound === CONFIG.WAVES) { finish('survived'); return; }
    state.roundStatus = 'ready'; callbacks.onRoundComplete?.(state.currentRound, state); notify();
  }

  function updateWave(owner, deltaTime) {
    const wave = state.waves[owner]; const target = sideFor(owner); wave.spawnClock -= deltaTime;
    while (!wave.doneSpawning && wave.spawnClock <= 0) {
      const group = wave.groups[wave.groupIndex];
      if (!group) { wave.doneSpawning = true; break; }
      if (wave.remainingInGroup <= 0) {
        wave.groupIndex += 1; const next = wave.groups[wave.groupIndex];
        if (!next) { wave.doneSpawning = true; break; }
        wave.remainingInGroup = next.count; continue;
      }
      spawnBalloon(target, group.type, true, seededRandom(state.currentRound * 100000 + wave.remaining));
      wave.remainingInGroup -= 1;
      wave.spawnClock += group.type === 'boss' ? CONFIG.BOSS_SPAWN_INTERVAL : CONFIG.NORMAL_SPAWN_INTERVAL;
    }
  }

  function updateRound(deltaTime) {
    if (!['spawning', 'clearing'].includes(state.roundStatus)) return;
    updateWave('player', deltaTime); updateWave('enemy', deltaTime);
    state.roundStatus = state.waves.player.doneSpawning && state.waves.enemy.doneSpawning ? 'clearing' : 'spawning';
    if (state.roundStatus === 'clearing' && state.waves.player.remaining === 0 && state.waves.enemy.remaining === 0) finishRound();
  }

  function updateSentBalloons(side, deltaTime) {
    if (side.sendQueue.length === 0) { side.sendClock = Math.max(0, side.sendClock - deltaTime); return; }
    side.sendClock -= deltaTime;
    while (side.sendClock <= 0 && side.sendQueue.length > 0) {
      const batch = side.sendQueue[0]; spawnBalloon(side, batch.type); batch.remaining -= 1;
      if (batch.remaining === 0) side.sendQueue.shift();
      side.sendClock += CONFIG.SEND_SPAWN_INTERVAL;
    }
  }

  function updateTowerDirection(tower, target) {
    const degrees = (Math.atan2(target.y - tower.y, target.x - tower.x) * (180 / Math.PI) + 90 + 360) % 360;
    tower.frameIndex = CONFIG.TOWERS[tower.type].directionFrames[Math.round(degrees / 45) % 8];
  }

  function removeRoundBalloon(owner) {
    state.waves[owner].remaining = Math.max(0, state.waves[owner].remaining - 1);
    state.remainingEnemies = state.waves.player.remaining;
    state.enemyRemainingEnemies = state.waves.enemy.remaining;
  }

  function updateSide(side, owner, deltaTime) {
    for (let index = side.balloons.length - 1; index >= 0; index -= 1) {
      const balloon = side.balloons[index]; const target = balloon.path[balloon.pathIndex + 1];
      if (!target) {
        side.hp = Math.max(0, side.hp - balloon.lifeDamage);
        if (balloon.fromRound) removeRoundBalloon(owner);
        side.balloons.splice(index, 1); notify();
        if (state.player.hp <= 0) finish('loss'); else if (state.enemy.hp <= 0) finish('win');
        continue;
      }
      const dx = target.x - balloon.x; const dy = target.y - balloon.y; const distance = Math.hypot(dx, dy); const travel = balloon.speed * deltaTime;
      if (distance <= travel) { balloon.x = target.x; balloon.y = target.y; balloon.pathIndex += 1; }
      else { balloon.x += (dx / distance) * travel; balloon.y += (dy / distance) * travel; }
    }
    side.towers.forEach((tower) => {
      updateMergeEffect(tower, deltaTime);
      tower.cooldown = Math.max(0, tower.cooldown - deltaTime);
      const target = side.balloons.find((balloon) => Math.hypot(balloon.x - tower.x, balloon.y - tower.y) <= tower.range);
      if (!target) return; updateTowerDirection(tower, target); if (tower.cooldown > 0) return;
      side.projectiles.push({ x: tower.x, y: tower.y - 4, targetX: target.x, targetY: target.y, targetRef: target, damage: tower.damage, color: tower.color, life: 0.08 }); tower.cooldown = tower.fireRate;
    });
    for (let index = side.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = side.projectiles[index]; projectile.life -= deltaTime; if (projectile.life > 0) continue;
      if (side.balloons.includes(projectile.targetRef)) {
        projectile.targetRef.hp -= projectile.damage;
        if (projectile.targetRef.hp <= 0) {
          const balloonIndex = side.balloons.indexOf(projectile.targetRef);
          if (balloonIndex > -1) {
            side.pops.push({ x: projectile.targetRef.x, y: projectile.targetRef.y, type: projectile.targetRef.type === 'boss' ? 'red' : projectile.targetRef.type, size: projectile.targetRef.renderSize, age: 0, duration: 0.42 });
            const wasRound = projectile.targetRef.fromRound; side.balloons.splice(balloonIndex, 1); side.gold += 2;
            if (wasRound) removeRoundBalloon(owner); notify();
          }
        }
      }
      side.projectiles.splice(index, 1);
    }
    for (let index = side.pops.length - 1; index >= 0; index -= 1) { side.pops[index].age += deltaTime; if (side.pops[index].age >= side.pops[index].duration) side.pops.splice(index, 1); }
  }

  function update(deltaTime) {
    if (!state.active || state.paused || state.result) return;
    updateRound(deltaTime); updateSentBalloons(state.player, deltaTime); updateSentBalloons(state.enemy, deltaTime);
    state.economyClock += deltaTime;
    while (state.economyClock >= 1) { state.economyClock -= 1; state.secondsElapsed += 1; state.player.gold += state.player.income; state.enemy.gold += state.enemy.income; notify(); }
    updateSide(state.player, 'player', deltaTime); updateSide(state.enemy, 'enemy', deltaTime);
  }

  function setPaused(paused) { if (!state.active || state.result) return false; state.paused = Boolean(paused); notify(); return true; }

  function finite(value, fallback = 0) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }

  function serializeSide(side) {
    return {
      hp: side.hp, gold: side.gold, income: side.income, sendClock: side.sendClock,
      freeBuildsRemaining: side.freeBuildsRemaining, sendIncomeTotal: side.sendIncomeTotal,
      sendIncomeRound: side.sendIncomeRound, sendIncomeThisRound: side.sendIncomeThisRound,
      lastGoldBonusRound: side.lastGoldBonusRound,
      towers: side.towers.map(({ x, y, type, level, cooldown, frameIndex }) => ({ x, y, type, level, cooldown, frameIndex })),
      balloons: side.balloons.map(({ type, x, y, pathRouteIndex, pathIndex, hp, fromRound }) => ({ type, x, y, pathRouteIndex: pathRouteIndex || 0, pathIndex, hp, fromRound })),
      sendQueue: side.sendQueue.map(({ type, remaining }) => ({ type, remaining }))
    };
  }

  function serializeWave(wave) {
    return { groups: wave.groups, groupIndex: wave.groupIndex, remainingInGroup: wave.remainingInGroup, spawnClock: wave.spawnClock, remaining: wave.remaining, doneSpawning: wave.doneSpawning };
  }

  function exportSnapshot(eventId = 0) {
    const absolute = ownSide === 1
      ? { 1: state.player, 2: state.enemy, wave1: state.waves.player, wave2: state.waves.enemy }
      : { 1: state.enemy, 2: state.player, wave1: state.waves.enemy, wave2: state.waves.player };
    return {
      version: 1, eventId, ownSide, active: state.active, paused: state.paused,
      secondsElapsed: state.secondsElapsed, economyClock: state.economyClock,
      currentRound: state.currentRound, roundStatus: state.roundStatus,
      sides: { 1: serializeSide(absolute[1]), 2: serializeSide(absolute[2]) },
      waves: { 1: serializeWave(absolute.wave1), 2: serializeWave(absolute.wave2) }
    };
  }

  function restoreSide(target, saved) {
    if (!saved || typeof saved !== 'object') return;
    target.hp = Math.max(0, Math.min(99, finite(saved.hp, 99)));
    target.gold = Math.max(-1000, finite(saved.gold, 100));
    target.income = Math.max(0, finite(saved.income, 5));
    target.freeBuildsRemaining = Math.max(0, Math.min(CONFIG.STARTER_TOWERS, Math.floor(finite(saved.freeBuildsRemaining, 0))));
    target.sendIncomeTotal = Math.max(0, Math.min(CONFIG.SEND_INCOME.total, finite(saved.sendIncomeTotal)));
    target.sendIncomeRound = Math.max(0, Math.floor(finite(saved.sendIncomeRound)));
    target.sendIncomeThisRound = Math.max(0, Math.min(CONFIG.SEND_INCOME.perRound, finite(saved.sendIncomeThisRound)));
    target.lastGoldBonusRound = Math.max(0, Math.floor(finite(saved.lastGoldBonusRound)));
    target.sendClock = Math.max(0, finite(saved.sendClock));
    target.towers = (Array.isArray(saved.towers) ? saved.towers : []).flatMap((item) => {
      const tower = CONFIG.TOWERS[item?.type];
      if (!tower) return [];
      const level = Math.max(1, Math.min(CONFIG.TOWER_LEVEL_MULTIPLIERS.length, Math.floor(finite(item.level, 1))));
      return [{ x: finite(item.x), y: finite(item.y), type: item.type, level, range: tower.range,
        damage: towerDamage(item.type, level), fireRate: tower.fireRate,
        cooldown: Math.max(0, finite(item.cooldown)), color: tower.color,
        frameIndex: Math.max(0, Math.floor(finite(item.frameIndex))) }];
    });
    target.balloons = (Array.isArray(saved.balloons) ? saved.balloons : []).flatMap((item) => {
      const balloon = CONFIG.BALLOONS[item?.type];
      if (!balloon) return [];
      const routeIndex = Math.max(0, Math.min(target.map.paths.length - 1, Math.floor(finite(item.pathRouteIndex))));
      const path = target.map.paths[routeIndex].map((point) => mapPathPoint(target.map, point));
      return [{ type: item.type, x: finite(item.x, path[0].x), y: finite(item.y, path[0].y), path, pathRouteIndex: routeIndex, pathIndex: Math.max(0, Math.min(path.length - 1, Math.floor(finite(item.pathIndex)))), hp: Math.max(0.01, finite(item.hp, balloon.hp)), maxHp: balloon.hp, speed: balloon.speed, lifeDamage: balloon.lifeDamage, renderSize: balloon.renderSize, fromRound: Boolean(item.fromRound) }];
    });
    target.sendQueue = (Array.isArray(saved.sendQueue) ? saved.sendQueue : []).flatMap((item) => CONFIG.BALLOONS[item?.type] ? [{ type: item.type, remaining: Math.max(0, Math.min(CONFIG.SEND_BATCH.maximum, Math.floor(finite(item.remaining)))) }] : []);
    target.projectiles = []; target.pops = [];
  }

  function restoreWave(target, saved) {
    if (!saved || typeof saved !== 'object') return;
    target.groups = (Array.isArray(saved.groups) ? saved.groups : []).flatMap((group) => CONFIG.BALLOONS[group?.type] ? [{ type: group.type, count: Math.max(0, Math.floor(finite(group.count))) }] : []);
    target.groupIndex = Math.max(0, Math.floor(finite(saved.groupIndex)));
    target.remainingInGroup = Math.max(0, Math.floor(finite(saved.remainingInGroup)));
    target.spawnClock = finite(saved.spawnClock);
    target.remaining = Math.max(0, Math.floor(finite(saved.remaining)));
    target.doneSpawning = Boolean(saved.doneSpawning);
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.version !== 1 || !snapshot.sides || !snapshot.waves) return false;
    const playerKey = String(ownSide); const enemyKey = String(ownSide === 1 ? 2 : 1);
    restoreSide(state.player, snapshot.sides[playerKey]); restoreSide(state.enemy, snapshot.sides[enemyKey]);
    restoreWave(state.waves.player, snapshot.waves[playerKey]); restoreWave(state.waves.enemy, snapshot.waves[enemyKey]);
    state.active = Boolean(snapshot.active); state.paused = Boolean(snapshot.paused); state.result = null;
    state.secondsElapsed = Math.max(0, Math.floor(finite(snapshot.secondsElapsed)));
    state.economyClock = Math.max(0, Math.min(1, finite(snapshot.economyClock)));
    state.currentRound = Math.max(0, Math.min(CONFIG.WAVES, Math.floor(finite(snapshot.currentRound))));
    state.roundStatus = ['ready', 'spawning', 'clearing', 'completed'].includes(snapshot.roundStatus) ? snapshot.roundStatus : 'ready';
    state.remainingEnemies = state.waves.player.remaining; state.enemyRemainingEnemies = state.waves.enemy.remaining;
    notify(); return true;
  }

  return { state, buildTower, buildTowerFor, mergeTower, mergeTowerFor, moveTower, moveTowerFor, removeOwnTower, removeTowerFor,
    sendBalloon, sendBalloonFor, startRound, update, setPaused, exportSnapshot, restoreSnapshot };
}

export { createMultiplayerEngine };
