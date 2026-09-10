// Bilder, Spielwerte, Bauzonen und Kartenwege.
/* 99 LUFTBALLONS – Vanilla HTML5 Canvas Tower Defense */

function imageAsset(src) {
  const image = new Image();
  image.dataset.src = src;
  return image;
}

function numberedImageAssets(folder, prefix) {
  return Array.from({ length: 10 }, (_, index) => imageAsset(`${folder}/${prefix} ${index + 1}.png`));
}

const ASSETS = {
  maps: {
    frost: imageAsset('assets/Maps/image2.webp'),
    woodland: imageAsset('assets/Maps/Grafik.webp'),
    desert: imageAsset('assets/Maps/image.webp'),
    mountain: imageAsset('assets/Maps/Grafik_2.webp')
  },
  characters: {
    cactus: numberedImageAssets('assets/Charaktere/Kaktus/Kaktus', 'Segment'),
    fan: numberedImageAssets('assets/Charaktere/Geblaese/Ballon Hunter', 'Ballon Hunter'),
    lens: numberedImageAssets('assets/Charaktere/Lupe/Fliegerstaffel', 'Fliegerstaffel')
  },
  balloons: Object.fromEntries(['red', 'blue', 'green', 'yellow'].map((type) => [type,
    Array.from({ length: type === 'yellow' ? 6 : 7 }, (_, index) =>
      imageAsset(`assets/Balloons/transparent/${type}/balloon_${type}_frame_${String(index + 1).padStart(2, '0')}.png`))
  ])),
  boss: imageAsset('assets/Balloons/boss-balloon.png')
};

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

const BUILD_ZONES = [
  { x: 94, y: 31, w: 70, h: 21 },
  { x: 61, y: 76, w: 75, h: 22 },
  { x: 212, y: 76, w: 47, h: 22 },
  { x: 18, y: 108, w: 24, h: 52 },
  { x: 162, y: 120, w: 84, h: 22 },
  { x: 282, y: 81, w: 25, h: 65 },
  { x: 64, y: 165, w: 89, h: 24 },
  { x: 184, y: 162, w: 50, h: 46 }
];

const MAP_PATHS = {
  frost: {
    route: [
      { x: 165, y: 200 }, { x: 165, y: 270 }, { x: 195, y: 305 }, { x: 650, y: 305 },
      { x: 695, y: 335 }, { x: 710, y: 445 }, { x: 730, y: 490 }, { x: 835, y: 455 },
      { x: 890, y: 350 }, { x: 930, y: 285 }, { x: 1160, y: 285 }, { x: 1200, y: 325 },
      { x: 1200, y: 665 }, { x: 1160, y: 705 }, { x: 800, y: 710 }, { x: 750, y: 750 },
      { x: 710, y: 875 }, { x: 670, y: 920 }, { x: 620, y: 935 }, { x: 575, y: 900 },
      { x: 555, y: 760 }, { x: 515, y: 710 }, { x: 470, y: 680 }, { x: 465, y: 550 },
      { x: 425, y: 515 }, { x: 260, y: 505 }, { x: 220, y: 545 }, { x: 220, y: 845 },
      { x: 255, y: 890 }, { x: 555, y: 900 }, { x: 620, y: 935 }, { x: 850, y: 1015 }
    ]
  },
  woodland: {
    left: [
      { x: 105, y: 130 }, { x: 105, y: 190 }, { x: 135, y: 215 }, { x: 475, y: 215 },
      { x: 520, y: 240 }, { x: 545, y: 315 }, { x: 525, y: 340 }, { x: 205, y: 340 },
      { x: 170, y: 375 }, { x: 170, y: 565 }, { x: 205, y: 600 }, { x: 475, y: 600 },
      { x: 520, y: 575 }, { x: 550, y: 500 }, { x: 585, y: 475 }, { x: 720, y: 475 },
      { x: 750, y: 510 }, { x: 750, y: 650 }
    ],
    right: [
      { x: 105, y: 130 }, { x: 105, y: 190 }, { x: 135, y: 215 }, { x: 475, y: 215 },
      { x: 520, y: 240 }, { x: 545, y: 315 }, { x: 575, y: 350 }, { x: 615, y: 335 },
      { x: 640, y: 240 }, { x: 675, y: 210 }, { x: 825, y: 210 }, { x: 860, y: 240 },
      { x: 875, y: 430 }, { x: 845, y: 470 }, { x: 780, y: 475 }, { x: 750, y: 510 },
      { x: 750, y: 650 }
    ]
  },
  desert: {
    route: [
      { x: 165, y: 200 }, { x: 165, y: 270 }, { x: 205, y: 305 }, { x: 650, y: 305 },
      { x: 700, y: 335 }, { x: 715, y: 430 }, { x: 750, y: 470 }, { x: 835, y: 465 },
      { x: 875, y: 425 }, { x: 880, y: 320 }, { x: 920, y: 275 }, { x: 1175, y: 275 },
      { x: 1210, y: 320 }, { x: 1210, y: 655 }, { x: 1170, y: 700 }, { x: 805, y: 700 },
      { x: 760, y: 740 }, { x: 760, y: 875 }, { x: 720, y: 925 }, { x: 620, y: 925 },
      { x: 580, y: 885 }, { x: 580, y: 760 }, { x: 540, y: 720 }, { x: 500, y: 720 },
      { x: 450, y: 680 }, { x: 450, y: 530 }, { x: 410, y: 490 }, { x: 260, y: 490 },
      { x: 220, y: 530 }, { x: 220, y: 840 }, { x: 260, y: 890 }, { x: 500, y: 900 },
      { x: 550, y: 950 }, { x: 850, y: 1040 }
    ]
  },
  mountain: {
    route: [
      { x: 170, y: 205 }, { x: 170, y: 275 }, { x: 205, y: 315 }, { x: 680, y: 315 },
      { x: 730, y: 345 }, { x: 750, y: 455 }, { x: 725, y: 500 }, { x: 535, y: 520 },
      { x: 495, y: 560 }, { x: 495, y: 640 }, { x: 455, y: 680 }, { x: 250, y: 700 },
      { x: 205, y: 740 }, { x: 205, y: 835 }, { x: 250, y: 875 }, { x: 600, y: 885 },
      { x: 660, y: 920 }, { x: 680, y: 850 }, { x: 700, y: 780 }, { x: 760, y: 700 },
      { x: 820, y: 620 }, { x: 875, y: 520 }, { x: 900, y: 430 }, { x: 930, y: 350 },
      { x: 930, y: 310 },
      { x: 1160, y: 310 }, { x: 1200, y: 350 }, { x: 1200, y: 665 }, { x: 1160, y: 710 },
      { x: 1050, y: 710 }, { x: 1000, y: 755 }, { x: 1000, y: 885 }
    ]
  }
};

const MAP_DATA = {
  frost: { id: 'frost', name: 'Frostpfad', image: ASSETS.maps.frost, hudCrop: 53, logicalCrop: 12, paths: [MAP_PATHS.frost.route] },
  woodland: { id: 'woodland', name: 'Waldweg', image: ASSETS.maps.woodland, hudCrop: 38, logicalCrop: 12, paths: [MAP_PATHS.woodland.left, MAP_PATHS.woodland.right] },
  desert: { id: 'desert', name: 'Wüstendünen', image: ASSETS.maps.desert, hudCrop: 53, logicalCrop: 12, paths: [MAP_PATHS.desert.route] },
  mountain: { id: 'mountain', name: 'Bergpass', image: ASSETS.maps.mountain, hudCrop: 50, logicalCrop: 12, paths: [MAP_PATHS.mountain.route] }
};

