import { createMultiplayerEngine } from '../multiplayer-game/engine.js';

function check(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  print(`OK: ${message}`);
}

const map = {
  image: { naturalWidth: 320, naturalHeight: 240 }, hudCrop: 0,
  buildZones: [{ x: 0, y: 0, w: 320, h: 240 }],
  paths: [[{ x: 0, y: 120 }, { x: 320, y: 120 }]]
};

const engine = createMultiplayerEngine(map, map);
check(engine.buildTower('cactus', 100, 40) === true, 'The first starter tower is free');
check(engine.state.player.gold === 100 && engine.state.player.freeBuildsRemaining === 2, 'Free towers use one of three placements');
check(engine.buildTower('fan', 108, 40) === 'occupied', 'Overlapping towers are rejected');
check(engine.buildTower('cactus', 140, 40) === true && engine.buildTower('cactus', 180, 40) === true, 'All three starter towers can be placed');
check(engine.buildTower('cactus', 220, 40) === true && engine.state.player.gold === 50, 'The fourth tower uses the new price');
check(engine.mergeTower(0, 1) === true && engine.state.player.towers[0].level === 2, 'Two level-1 towers merge into level 2');
check(engine.mergeTower(1, 2) === true && engine.state.player.towers[1].level === 2, 'A second level-2 tower can be made');
check(engine.mergeTower(1, 0) === true && engine.state.player.towers[0].level === 3, 'Two level-2 towers merge into level 3');
check(engine.state.player.towers[0].damage > 1, 'Upgraded tower damage uses the shared multiplier');

const boughtUpgrade = createMultiplayerEngine(map, map);
boughtUpgrade.buildTower('cactus', 100, 40);
check(boughtUpgrade.mergeTower(0, 0, true) === true && boughtUpgrade.state.player.towers[0].level === 2,
  'A purchased level-1 tower can merge with an existing level-1 tower');
check(boughtUpgrade.state.player.gold === 50, 'Buying an upgrade costs gold even during free placement');

const sending = createMultiplayerEngine(map, map);
check(sending.sendBalloon('red') === 'inactive', 'Balloon sending is unavailable before round 1');
check(sending.startRound(12345) === true && sending.state.currentRound === 1, 'A shared round starts');
check(sending.sendBalloon('blue') === 'locked', 'Blue balloons are locked until round 5');
check(sending.sendBalloon('red') === true, 'Red balloons can be sent in round 1');
check(sending.state.player.gold === 75 && sending.state.player.income === 5.1, 'Sending uses the reworked gold and income values');
check(sending.state.enemy.sendQueue[0].remaining === 2 && sending.state.enemy.balloons.length === 1,
  'Round 1 sends three balloons, one of which appears immediately');
for (let index = 0; index < 6; index += 1) sending.sendBalloon('red');
check(sending.state.player.income <= 5.5, 'Send income cannot exceed the per-round cap');

const mirrored = createMultiplayerEngine(map, map);
mirrored.startRound(12345); mirrored.update(0.1);
check(mirrored.state.player.balloons.length === 1 && mirrored.state.enemy.balloons.length === 1,
  'The neutral wave appears on both maps');
check(mirrored.buildTowerFor('enemy', 'fan', 100, 40, true) === true && mirrored.state.enemy.towers.length === 1,
  'A remote starter tower appears on the opponent map');
check(mirrored.sendBalloonFor('enemy', 'red', true) === true && mirrored.state.player.balloons.some((balloon) => !balloon.fromRound),
  'A remote send attacks the local map');

const sideOne = createMultiplayerEngine(map, map, { ownSide: 1 });
const sideTwo = createMultiplayerEngine(map, map, { ownSide: 2 });
sideOne.startRound(9876); sideTwo.startRound(9876);
sideOne.update(0.1); sideTwo.update(0.1);
check(sideOne.state.player.balloons[0].type === sideTwo.state.enemy.balloons[0].type,
  'The first absolute map receives the same seeded wave from both perspectives');
check(sideOne.state.enemy.balloons[0].type === sideTwo.state.player.balloons[0].type,
  'The second map also receives a mirrored wave');

sideOne.buildTowerFor('player', 'fan', 140, 40, true);
sideTwo.buildTowerFor('enemy', 'fan', 140, 40, true);
sideOne.mergeTowerFor('player', 0, 0, true);
sideTwo.mergeTowerFor('enemy', 0, 0, true);
check(sideOne.state.player.towers[0].level === sideTwo.state.enemy.towers[0].level
  && sideOne.state.player.gold === sideTwo.state.enemy.gold,
  'A purchased upgrade replays identically in both browser perspectives');

sideOne.state.player.gold = 200;
sideOne.buildTowerFor('player', 'cactus', 100, 40, true);
sideOne.mergeTowerFor('player', 1, 1, true);
sideOne.sendBalloonFor('player', 'red', true);
sideOne.update(0.5);
const saved = sideOne.exportSnapshot(42);
const restoredOne = createMultiplayerEngine(map, map, { ownSide: 1 });
const restoredTwo = createMultiplayerEngine(map, map, { ownSide: 2 });
check(restoredOne.restoreSnapshot(saved) === true && restoredOne.state.player.towers[1].level === 2,
  'A reconnect preserves tower upgrades');
check(restoredOne.state.player.sendIncomeTotal === sideOne.state.player.sendIncomeTotal,
  'Income-cap state survives a snapshot');
check(restoredOne.state.enemy.balloons.length === sideOne.state.enemy.balloons.length,
  'Travelling balloons survive a snapshot');
check(restoredTwo.restoreSnapshot(saved) === true && restoredTwo.state.enemy.towers[1].level === 2,
  'Upgrades are mapped correctly in the opposite browser perspective');
check(restoredTwo.state.currentRound === sideOne.state.currentRound && restoredTwo.state.player.gold === sideOne.state.enemy.gold,
  'Rounds and resources restore in absolute-side order');

const goldBonus = createMultiplayerEngine(map, map);
goldBonus.state.currentRound = 19;
goldBonus.startRound(1);
check(goldBonus.state.player.gold === 15100 && goldBonus.state.enemy.gold === 15100,
  'Both players receive the round-20 gold bonus');
