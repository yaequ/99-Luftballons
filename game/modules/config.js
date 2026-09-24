
const CONFIG = {
  CANVAS_WIDTH: 320,
  CANVAS_HEIGHT: 240,
  RENDER_SCALE: 3,
  GRID_SIZE: 8,
  FIXED_STEP: 1 / 60,
  MAX_FRAME_DELTA: 0.1,
  WAVES: 30,
  NORMAL_SPAWN_INTERVAL: 0.12,
  SEND_BATCH_SIZE: 10,
  SEND_SPAWN_INTERVAL: 0.12,
  BOSS_SPAWN_INTERVAL: 1.2,
  INTERMISSION_SECONDS: 5,
  CHARACTER_RENDER: { MAX_WIDTH: 25, HEIGHT: 29 },
  TOWER_LEVEL_MULTIPLIERS: [1, 1.5, 2.5],
  TOWERS: {
    cactus: { name: 'Kaktus', cost: 25, range: 45, damage: 0.3, fireRate: 0.58, color: '#43d17d', directionFrames: [5, 6, 2, 1, 0, 8, 9, 3] },
    fan: { name: 'Gebläse', cost: 45, range: 55, damage: 1, fireRate: 0.34, color: '#70a1ff', directionFrames: [4, 3, 2, 1, 0, 8, 7, 6] },
    lens: { name: 'Lupe', cost: 70, range: 65, damage: 3, fireRate: 1, color: '#f1b94d', directionFrames: [2, 6, 1, 5, 0, 8, 3, 7] }
  },
  BALLOONS: {
    red: { name: 'Rot', cost: 10, income: 1, hp: 1, speed: 60, lifeDamage: 1, renderSize: 18 },
    blue: { name: 'Blau', cost: 25, income: 2, hp: 2, speed: 84, lifeDamage: 1, renderSize: 18 },
    green: { name: 'Grün', cost: 45, income: 4, hp: 4, speed: 68, lifeDamage: 1, renderSize: 18 },
    yellow: { name: 'Gelb', cost: 70, income: 7, hp: 7, speed: 48, lifeDamage: 1, renderSize: 18 },
    boss: { name: 'Boss', hp: 150, speed: 24, lifeDamage: 25, renderSize: 36 }
  }
};

export { CONFIG };
