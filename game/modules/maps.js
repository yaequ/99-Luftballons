import { ASSETS } from './assets.js';
// Black tile interiors in original image pixels, excluding their decorative frames.
const MAP_BUILD_ZONES = {
  frost: [
    { x: 472, y: 166, w: 258, h: 54 },
    { x: 322, y: 377, w: 273, h: 53 },
    { x: 971, y: 354, w: 154, h: 53 },
    { x: 104, y: 518, w: 48, h: 176 },
    { x: 772, y: 585, w: 258, h: 49 },
    { x: 1291, y: 382, w: 48, h: 223 },
    { x: 846, y: 780, w: 147, h: 139 }
  ],
  woodland: [
    { x: 302, y: 136, w: 204, h: 38 },
    { x: 267, y: 253, w: 195, h: 32 },
    { x: 725, y: 255, w: 85, h: 33 },
    { x: 61, y: 387, w: 56, h: 103 },
    { x: 521, y: 409, w: 186, h: 33 },
    { x: 923, y: 289, w: 38, h: 166 },
    { x: 206, y: 656, w: 269, h: 27 },
    { x: 598, y: 534, w: 117, h: 97 }
  ],
  desert: [
    { x: 460, y: 178, w: 267, h: 49 },
    { x: 321, y: 375, w: 280, h: 49 },
    { x: 974, y: 352, w: 151, h: 49 },
    { x: 103, y: 512, w: 47, h: 175 },
    { x: 770, y: 580, w: 263, h: 45 },
    { x: 1300, y: 378, w: 48, h: 224 },
    { x: 308, y: 787, w: 278, h: 49 },
    { x: 840, y: 772, w: 148, h: 140 }
  ],
  mountain: [
    { x: 464, y: 200, w: 267, h: 48 },
    { x: 294, y: 385, w: 278, h: 47 },
    { x: 973, y: 390, w: 182, h: 49 },
    { x: 108, y: 523, w: 55, h: 173 },
    { x: 889, y: 613, w: 268, h: 47 },
    { x: 1295, y: 407, w: 51, h: 226 },
    { x: 292, y: 760, w: 302, h: 48 },
    { x: 765, y: 761, w: 173, h: 138 }
  ],
};

// Maximum field count retained for the AI progression; frost has only seven fields.
const BUILD_ZONES = MAP_BUILD_ZONES.desert;

const MAP_PATHS = {
  frost: {
    // Source-image coordinates along the road center, including the exit at the bottom edge.
    route: [
      { x: 165, y: 200 }, { x: 165, y: 255 }, { x: 175, y: 285 }, { x: 195, y: 305 },
      { x: 225, y: 310 }, { x: 650, y: 310 }, { x: 685, y: 320 }, { x: 710, y: 345 },
      { x: 720, y: 380 }, { x: 720, y: 440 }, { x: 730, y: 475 }, { x: 755, y: 495 },
      { x: 790, y: 502 }, { x: 840, y: 500 }, { x: 870, y: 480 }, { x: 890, y: 450 },
      { x: 895, y: 340 }, { x: 910, y: 300 }, { x: 940, y: 280 }, { x: 975, y: 275 },
      { x: 1150, y: 275 }, { x: 1180, y: 290 }, { x: 1200, y: 320 }, { x: 1200, y: 650 },
      { x: 1190, y: 680 }, { x: 1165, y: 700 }, { x: 1130, y: 710 }, { x: 825, y: 710 },
      { x: 795, y: 720 }, { x: 775, y: 745 }, { x: 770, y: 780 }, { x: 770, y: 875 },
      { x: 755, y: 905 }, { x: 725, y: 920 }, { x: 700, y: 920 }, { x: 680, y: 900 },
      { x: 670, y: 870 }, { x: 667, y: 760 }, { x: 655, y: 725 }, { x: 625, y: 705 },
      { x: 590, y: 700 }, { x: 540, y: 700 }, { x: 505, y: 685 }, { x: 480, y: 660 },
      { x: 470, y: 625 }, { x: 470, y: 550 }, { x: 460, y: 520 }, { x: 435, y: 500 },
      { x: 405, y: 495 }, { x: 295, y: 495 }, { x: 265, y: 505 }, { x: 240, y: 530 },
      { x: 230, y: 565 }, { x: 230, y: 845 }, { x: 240, y: 875 }, { x: 265, y: 900 },
      { x: 300, y: 905 }, { x: 490, y: 905 }, { x: 525, y: 915 }, { x: 550, y: 940 },
      { x: 565, y: 975 }, { x: 580, y: 1010 }, { x: 605, y: 1035 }, { x: 640, y: 1045 },
      { x: 785, y: 1045 }, { x: 815, y: 1060 }, { x: 835, y: 1084 }
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
    // Source-image coordinates along the road center, including the exit at the bottom edge.
    route: [
      { x: 170, y: 200 }, { x: 170, y: 255 }, { x: 180, y: 285 }, { x: 200, y: 305 },
      { x: 230, y: 310 }, { x: 650, y: 310 }, { x: 685, y: 320 }, { x: 710, y: 345 },
      { x: 722, y: 380 }, { x: 722, y: 435 }, { x: 735, y: 465 }, { x: 760, y: 485 },
      { x: 795, y: 490 }, { x: 840, y: 490 }, { x: 870, y: 475 }, { x: 890, y: 450 },
      { x: 900, y: 415 }, { x: 900, y: 335 }, { x: 915, y: 305 }, { x: 940, y: 280 },
      { x: 975, y: 275 }, { x: 1140, y: 275 }, { x: 1175, y: 290 }, { x: 1195, y: 320 },
      { x: 1200, y: 355 }, { x: 1200, y: 645 }, { x: 1185, y: 680 }, { x: 1160, y: 700 },
      { x: 1125, y: 705 }, { x: 820, y: 705 }, { x: 790, y: 715 }, { x: 770, y: 740 },
      { x: 765, y: 775 }, { x: 765, y: 860 }, { x: 755, y: 885 }, { x: 735, y: 900 },
      { x: 700, y: 905 }, { x: 680, y: 895 }, { x: 660, y: 870 }, { x: 655, y: 835 },
      { x: 655, y: 765 }, { x: 645, y: 735 }, { x: 625, y: 715 }, { x: 595, y: 700 },
      { x: 540, y: 695 }, { x: 505, y: 685 }, { x: 480, y: 660 }, { x: 465, y: 630 },
      { x: 465, y: 550 }, { x: 455, y: 520 }, { x: 430, y: 495 }, { x: 400, y: 490 },
      { x: 295, y: 490 }, { x: 265, y: 505 }, { x: 240, y: 530 }, { x: 230, y: 565 },
      { x: 230, y: 845 }, { x: 240, y: 875 }, { x: 265, y: 900 }, { x: 300, y: 910 },
      { x: 490, y: 910 }, { x: 525, y: 920 }, { x: 550, y: 940 }, { x: 565, y: 975 },
      { x: 580, y: 1000 }, { x: 605, y: 1015 }, { x: 640, y: 1015 }, { x: 820, y: 1015 },
      { x: 855, y: 1030 }, { x: 875, y: 1055 }, { x: 885, y: 1083 }
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
  frost: { id: 'frost', buildZones: MAP_BUILD_ZONES.frost, name: 'Frostpfad', image: ASSETS.maps.frost, hudCrop: 53, logicalCrop: 12, paths: [MAP_PATHS.frost.route] },
  woodland: { id: 'woodland', buildZones: MAP_BUILD_ZONES.woodland, name: 'Waldweg', image: ASSETS.maps.woodland, hudCrop: 38, logicalCrop: 12, paths: [MAP_PATHS.woodland.left, MAP_PATHS.woodland.right] },
  desert: { id: 'desert', buildZones: MAP_BUILD_ZONES.desert, name: 'Wüstendünen', image: ASSETS.maps.desert, hudCrop: 53, logicalCrop: 12, paths: [MAP_PATHS.desert.route] },
  mountain: { id: 'mountain', buildZones: MAP_BUILD_ZONES.mountain, name: 'Bergpass', image: ASSETS.maps.mountain, hudCrop: 50, logicalCrop: 12, paths: [MAP_PATHS.mountain.route] }
};

export { BUILD_ZONES, MAP_DATA };
