import { CONFIG } from './config.js';

function sendBatchSize(round, type) {
  const { initial, roundsPerIncrease, maximum } = CONFIG.SEND_BATCH;
  const currentRound = Number.isFinite(round) ? Math.max(1, Math.floor(round)) : 1;
  return Math.min(CONFIG.BALLOONS[type]?.sendMaximum ?? maximum, maximum, initial + Math.floor((currentRound - 1) / roundsPerIncrease));
}

function isSendUnlocked(type, round) {
  const balloon = CONFIG.BALLOONS[type];
  return Boolean(balloon && Number.isFinite(balloon.cost) && round >= balloon.unlockRound);
}

function sendIncomeBonus(state, type) {
  const balloon = CONFIG.BALLOONS[type];
  if (!isSendUnlocked(type, state.currentRound)) return 0;
  const player = state.player;
  const roundBonus = player.sendIncomeRound === state.currentRound ? (player.sendIncomeThisRound || 0) : 0;
  return Math.round(Math.max(0, Math.min(balloon.income,
    CONFIG.SEND_INCOME.perRound - roundBonus,
    CONFIG.SEND_INCOME.total - (player.sendIncomeTotal || 0))) * 100) / 100;
}

function queuePlayerSend(state, type) {
  const balloon = CONFIG.BALLOONS[type];
  if (!state.active || state.paused || !isSendUnlocked(type, state.currentRound)
      || state.player.gold < balloon.cost) return false;
  const bonus = sendIncomeBonus(state, type);
  const player = state.player;
  if (player.sendIncomeRound !== state.currentRound) {
    player.sendIncomeRound = state.currentRound;
    player.sendIncomeThisRound = 0;
  }
  player.gold -= balloon.cost;
  player.income = Math.round((player.income + bonus) * 100) / 100;
  player.sendIncomeThisRound = Math.round(((player.sendIncomeThisRound || 0) + bonus) * 100) / 100;
  player.sendIncomeTotal = Math.round(((player.sendIncomeTotal || 0) + bonus) * 100) / 100;
  state.enemy.sendQueue.push({ type, remaining: sendBatchSize(state.currentRound, type) });
  return true;
}

export { sendBatchSize, isSendUnlocked, sendIncomeBonus, queuePlayerSend };
