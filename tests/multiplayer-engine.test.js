import { createMultiplayerEngine } from '../multiplayer-game/engine.js';

function check(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  print(`OK: ${message}`);
}

const map = {
  image: { naturalWidth: 320, naturalHeight: 240 },
  hudCrop: 0,
  buildZones: [{ x: 0, y: 0, w: 320, h: 240 }],
  paths: [[{ x: 0, y: 120 }, { x: 320, y: 120 }]]
};

const engine = createMultiplayerEngine(map, map);
check(engine.buildTower('cactus', 100, 40) === true, 'Multiplayer uses the shared tower placement rules');
check(engine.state.player.gold === 75, 'A local tower purchase uses the shared tower price');
check(engine.buildTower('fan', 108, 40) === 'occupied', 'Multiplayer rejects overlapping towers');
check(engine.startRound() === true && engine.state.currentRound === 1, 'A local multiplayer round starts with the shared round counter');
check(engine.sendBalloon('red') === true, 'A balloon batch can be sent during an active local round');
check(engine.state.player.income === 6 && engine.state.enemy.balloons.length === 1, 'Sending balloons updates income and immediately creates a visible balloon');

const unguarded = createMultiplayerEngine(map, map);
unguarded.state.active = true;
unguarded.sendBalloon('red');
unguarded.update(10);
unguarded.update(0.1);
check(unguarded.state.enemy.hp === 89, 'All ten balloons in an unguarded batch remove one life each');

const mirrored = createMultiplayerEngine(map, map);
mirrored.startRound(12345);
mirrored.update(0.1);
check(mirrored.state.player.balloons.length === 1 && mirrored.state.enemy.balloons.length === 1, 'A shared round creates the neutral wave on both maps');
check(mirrored.buildTowerFor('enemy', 'fan', 100, 40, true) === true && mirrored.state.enemy.towers.length === 1, 'A remote tower action is rendered on the opponent map');
check(mirrored.sendBalloonFor('enemy', 'blue', true) === true && mirrored.state.player.balloons.some((balloon) => !balloon.fromRound), 'A remote balloon action attacks the local map');

const sideOne = createMultiplayerEngine(map, map, { ownSide: 1 });
const sideTwo = createMultiplayerEngine(map, map, { ownSide: 2 });
sideOne.startRound(9876);
sideTwo.startRound(9876);
sideOne.update(0.1);
sideTwo.update(0.1);
check(sideOne.state.player.balloons[0].type === sideTwo.state.enemy.balloons[0].type, 'The same absolute map receives the same seeded wave in both browser perspectives');
check(sideOne.state.enemy.balloons[0].type === sideTwo.state.player.balloons[0].type, 'Seeded waves remain mirrored for the second player side');
