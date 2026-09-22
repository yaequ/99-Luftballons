import { CONFIG } from '../game/modules/config.js';
import { createSide } from '../game/modules/state.js';
import { mapPathPoint, canBuildAt } from '../game/modules/building.js';
import { ROUND_DEFINITIONS, shuffledSpawnGroups } from '../game/rounds.js';

function createMultiplayerEngine(playerMap, opponentMap, callbacks = {}) {
  const state = {
    active: false,
    paused: false,
    result: null,
    secondsElapsed: 0,
    economyClock: 0,
    selectedTowerType: null,
    buildCursor: { x: 100, y: 40, active: false },
    currentRound: 0,
    roundStatus: 'ready',
    spawnGroups: [],
    spawnGroupIndex: 0,
    spawnRemainingInGroup: 0,
    spawnClock: 0,
    remainingEnemies: 0,
    intermissionRemaining: 0,
    autoStart: true,
    player: createSide(playerMap),
    enemy: createSide(opponentMap)
  };

  const notify = () => callbacks.onChange?.(state);

  function buildTower(type, x, y) {
    if (state.result) return 'finished';
    const result = canBuildAt(state.player, type, x, y);
    if (result !== true) return result;
    const tower = CONFIG.TOWERS[type];
    state.player.gold -= tower.cost;
    state.player.towers.push({
      x, y, type,
      range: tower.range,
      damage: tower.damage,
      fireRate: tower.fireRate,
      cooldown: 0,
      color: tower.color,
      frameIndex: 0
    });
    notify();
    return true;
  }

  function spawnBalloon(targetSide, type, fromRound = false) {
    const balloon = CONFIG.BALLOONS[type];
    const sourcePath = targetSide.map.paths[Math.floor(Math.random() * targetSide.map.paths.length)];
    const path = sourcePath.map((point) => mapPathPoint(targetSide.map, point));
    targetSide.balloons.push({
      type,
      x: path[0].x,
      y: path[0].y,
      path,
      pathIndex: 0,
      hp: balloon.hp,
      maxHp: balloon.hp,
      speed: balloon.speed,
      lifeDamage: balloon.lifeDamage,
      renderSize: balloon.renderSize,
      fromRound
    });
  }

  function sendBalloon(type) {
    if (!state.active || state.paused || state.result) return 'inactive';
    const balloon = CONFIG.BALLOONS[type];
    if (!balloon || !Number.isFinite(balloon.cost)) return 'unknown';
    if (state.player.gold < balloon.cost) return 'gold';
    state.player.gold -= balloon.cost;
    state.player.income += balloon.income;
    state.enemy.sendQueue.push({ type, remaining: CONFIG.SEND_BATCH_SIZE });
    updateSentBalloons(state.enemy, 0);
    notify();
    return true;
  }

  function startRound() {
    if (state.paused || state.result || ['spawning', 'clearing', 'completed'].includes(state.roundStatus) || state.currentRound >= CONFIG.WAVES) return false;
    state.active = true;
    state.currentRound += 1;
    const definition = ROUND_DEFINITIONS[state.currentRound - 1];
    state.spawnGroups = shuffledSpawnGroups(definition);
    state.spawnGroupIndex = 0;
    state.spawnRemainingInGroup = state.spawnGroups[0].count;
    state.spawnClock = 0;
    state.remainingEnemies = state.spawnGroups.reduce((sum, group) => sum + group.count, 0);
    state.intermissionRemaining = 0;
    state.roundStatus = 'spawning';
    notify();
    return true;
  }

  function finish(result) {
    if (state.result) return;
    state.result = result;
    state.active = false;
    state.roundStatus = 'completed';
    callbacks.onGameOver?.(result, state);
    notify();
  }

  function finishRound() {
    if (state.currentRound === CONFIG.WAVES) {
      finish('survived');
      return;
    }
    state.roundStatus = 'intermission';
    state.intermissionRemaining = CONFIG.INTERMISSION_SECONDS;
    callbacks.onRoundComplete?.(state.currentRound, state);
    notify();
  }

  function updateRound(deltaTime) {
    if (state.roundStatus === 'spawning') {
      state.spawnClock -= deltaTime;
      while (state.spawnClock <= 0 && state.spawnGroupIndex < state.spawnGroups.length) {
        const group = state.spawnGroups[state.spawnGroupIndex];
        if (state.spawnRemainingInGroup <= 0) {
          state.spawnGroupIndex += 1;
          if (state.spawnGroupIndex >= state.spawnGroups.length) break;
          state.spawnRemainingInGroup = state.spawnGroups[state.spawnGroupIndex].count;
          continue;
        }
        spawnBalloon(state.player, group.type, true);
        state.spawnRemainingInGroup -= 1;
        state.spawnClock += group.type === 'boss' ? CONFIG.BOSS_SPAWN_INTERVAL : CONFIG.NORMAL_SPAWN_INTERVAL;
      }
      if (state.spawnGroupIndex >= state.spawnGroups.length) state.roundStatus = 'clearing';
    } else if (state.roundStatus === 'clearing' && state.remainingEnemies === 0) {
      finishRound();
    } else if (state.roundStatus === 'intermission') {
      state.intermissionRemaining = Math.max(0, state.intermissionRemaining - deltaTime);
      if (state.intermissionRemaining === 0) {
        if (state.autoStart) startRound();
        else {
          state.roundStatus = 'ready';
          notify();
        }
      }
    }
  }

  function updateSentBalloons(side, deltaTime) {
    if (side.sendQueue.length === 0) {
      side.sendClock = Math.max(0, side.sendClock - deltaTime);
      return;
    }
    side.sendClock -= deltaTime;
    while (side.sendClock <= 0 && side.sendQueue.length > 0) {
      const batch = side.sendQueue[0];
      spawnBalloon(side, batch.type);
      batch.remaining -= 1;
      if (batch.remaining === 0) side.sendQueue.shift();
      side.sendClock += CONFIG.SEND_SPAWN_INTERVAL;
    }
  }

  function updateTowerDirection(tower, target) {
    const angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    const degrees = (angle * (180 / Math.PI) + 90 + 360) % 360;
    const direction = Math.round(degrees / 45) % 8;
    tower.frameIndex = CONFIG.TOWERS[tower.type].directionFrames[direction];
  }

  function updateSide(side, deltaTime) {
    for (let index = side.balloons.length - 1; index >= 0; index -= 1) {
      const balloon = side.balloons[index];
      const target = balloon.path[balloon.pathIndex + 1];
      if (!target) {
        side.hp = Math.max(0, side.hp - balloon.lifeDamage);
        if (balloon.fromRound) state.remainingEnemies = Math.max(0, state.remainingEnemies - 1);
        side.balloons.splice(index, 1);
        notify();
        if (state.player.hp <= 0) finish('loss');
        else if (state.enemy.hp <= 0) finish('win');
        continue;
      }
      const dx = target.x - balloon.x;
      const dy = target.y - balloon.y;
      const distance = Math.hypot(dx, dy);
      const travel = balloon.speed * deltaTime;
      if (distance <= travel) {
        balloon.x = target.x;
        balloon.y = target.y;
        balloon.pathIndex += 1;
      } else {
        balloon.x += (dx / distance) * travel;
        balloon.y += (dy / distance) * travel;
      }
    }

    side.towers.forEach((tower) => {
      tower.cooldown = Math.max(0, tower.cooldown - deltaTime);
      const target = side.balloons.find((balloon) => Math.hypot(balloon.x - tower.x, balloon.y - tower.y) <= tower.range);
      if (!target) return;
      updateTowerDirection(tower, target);
      if (tower.cooldown > 0) return;
      side.projectiles.push({
        x: tower.x,
        y: tower.y - 4,
        targetX: target.x,
        targetY: target.y,
        targetRef: target,
        damage: tower.damage,
        color: tower.color,
        life: 0.08
      });
      tower.cooldown = tower.fireRate;
    });

    for (let index = side.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = side.projectiles[index];
      projectile.life -= deltaTime;
      if (projectile.life > 0) continue;
      if (side.balloons.includes(projectile.targetRef)) {
        projectile.targetRef.hp -= projectile.damage;
        if (projectile.targetRef.hp <= 0) {
          const balloonIndex = side.balloons.indexOf(projectile.targetRef);
          if (balloonIndex > -1) {
            side.pops.push({
              x: projectile.targetRef.x,
              y: projectile.targetRef.y,
              type: projectile.targetRef.type === 'boss' ? 'red' : projectile.targetRef.type,
              size: projectile.targetRef.renderSize,
              age: 0,
              duration: 0.42
            });
            side.balloons.splice(balloonIndex, 1);
            side.gold += 2;
            if (projectile.targetRef.fromRound) state.remainingEnemies = Math.max(0, state.remainingEnemies - 1);
            notify();
          }
        }
      }
      side.projectiles.splice(index, 1);
    }

    for (let index = side.pops.length - 1; index >= 0; index -= 1) {
      side.pops[index].age += deltaTime;
      if (side.pops[index].age >= side.pops[index].duration) side.pops.splice(index, 1);
    }
  }

  function update(deltaTime) {
    if (!state.active || state.paused || state.result) return;
    updateRound(deltaTime);
    updateSentBalloons(state.enemy, deltaTime);
    state.economyClock += deltaTime;
    while (state.economyClock >= 1) {
      state.economyClock -= 1;
      state.secondsElapsed += 1;
      state.player.gold += state.player.income;
      state.enemy.gold += state.enemy.income;
      notify();
    }
    updateSide(state.player, deltaTime);
    updateSide(state.enemy, deltaTime);
  }

  function setPaused(paused) {
    if (!state.active || state.result) return false;
    state.paused = Boolean(paused);
    notify();
    return true;
  }

  return { state, buildTower, sendBalloon, startRound, update, setPaused };
}

export { createMultiplayerEngine };
