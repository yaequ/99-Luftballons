import { CONFIG } from './config.js';

function grantRoundGold(state) {
  const round = state.currentRound;
  const amount = CONFIG.ROUND_GOLD_BONUSES[round] || 0;
  if (!amount) return false;
  let granted = false;
  for (const side of [state.player, state.enemy]) {
    if ((side.lastGoldBonusRound || 0) >= round) continue;
    side.gold += amount;
    side.lastGoldBonusRound = round;
    granted = true;
  }
  return granted;
}

export { grantRoundGold };
