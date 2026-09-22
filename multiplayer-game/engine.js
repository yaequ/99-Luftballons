import { CONFIG } from '../game/modules/config.js';
import { createSide } from '../game/modules/state.js';
import { mapPathPoint, canBuildAt } from '../game/modules/building.js';
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
    autoStart: false, player: createSide(playerMap), enemy: createSide(opponentMap),
    waves: { player: createWave(), enemy: createWave() }
  };
  const notify = () => callbacks.onChange?.(state);
  const sideFor = (owner) => owner === 'enemy' ? state.enemy : state.player;

  function buildTowerFor(owner, type, x, y, force = false) {
    if (state.result) return 'finished';
    const side = sideFor(owner);
    const tower = CONFIG.TOWERS[type];
    if (!tower) return 'unknown';
    const result = canBuildAt(side, type, x, y, force);
    if (result !== true) return result;
    side.gold -= tower.cost;
    side.towers.push({ x, y, type, range: tower.range, damage: tower.damage, fireRate: tower.fireRate, cooldown: 0, color: tower.color, frameIndex: 0 });
    notify();
    return true;
  }

  function buildTower(type, x, y) { return buildTowerFor('player', type, x, y); }

  function spawnBalloon(targetSide, type, fromRound = false, random = Math.random) {
    const balloon = CONFIG.BALLOONS[type];
    const sourcePath = targetSide.map.paths[Math.floor(random() * targetSide.map.paths.length)];
    const path = sourcePath.map((point) => mapPathPoint(targetSide.map, point));
    targetSide.balloons.push({ type, x: path[0].x, y: path[0].y, path, pathIndex: 0, hp: balloon.hp, maxHp: balloon.hp, speed: balloon.speed, lifeDamage: balloon.lifeDamage, renderSize: balloon.renderSize, fromRound });
  }

  function sendBalloonFor(owner, type, force = false) {
    if ((!state.active || state.paused) && !force) return 'inactive';
    if (state.result) return 'finished';
    const sender = sideFor(owner);
    const target = owner === 'enemy' ? state.player : state.enemy;
    const balloon = CONFIG.BALLOONS[type];
    if (!balloon || !Number.isFinite(balloon.cost)) return 'unknown';
    if (!force && sender.gold < balloon.cost) return 'gold';
    sender.gold -= balloon.cost; sender.income += balloon.income;
    target.sendQueue.push({ type, remaining: CONFIG.SEND_BATCH_SIZE });
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
  return { state, buildTower, buildTowerFor, sendBalloon, sendBalloonFor, startRound, update, setPaused };
}

export { createMultiplayerEngine };
