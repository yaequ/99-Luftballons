// Level-2 source bounds exclude transparent margins. Directions: N, NE, E, SE, S, SW, W, NW.
// Missing views reuse the closest supplied view; no generated or mirrored sprites.
const LEVEL2_SKINS = {
  "cactus": {
    "folder": "assets/LVL2_Charactere/Kaktus",
    "frames": {
      "kaktus_lvl2_hinten_variante_01": [
        141,
        127,
        764,
        1148
      ],
      "kaktus_lvl2_hinten_variante_02": [
        132,
        166,
        768,
        1094
      ],
      "kaktus_lvl2_rechts_profil_variante_01": [
        284,
        162,
        775,
        1121
      ],
      "kaktus_lvl2_rechts_profil_variante_02": [
        302,
        269,
        726,
        1022
      ],
      "kaktus_lvl2_vorne": [
        253,
        99,
        699,
        1178
      ],
      "kaktus_lvl2_vorne_links": [
        120,
        167,
        768,
        1088
      ],
      "kaktus_lvl2_vorne_rechts_variante_01": [
        270,
        166,
        731,
        1133
      ],
      "kaktus_lvl2_vorne_rechts_variante_02": [
        285,
        154,
        737,
        1137
      ]
    },
    "directions": [
      "kaktus_lvl2_hinten_variante_01",
      "kaktus_lvl2_hinten_variante_02",
      "kaktus_lvl2_rechts_profil_variante_01",
      "kaktus_lvl2_vorne_rechts_variante_01",
      "kaktus_lvl2_vorne",
      "kaktus_lvl2_vorne_links",
      "kaktus_lvl2_vorne_links",
      "kaktus_lvl2_hinten_variante_01"
    ]
  },
  "fan": {
    "folder": "assets/LVL2_Charactere/Geblease",
    "frames": {
      "geblaese_lvl2_hinten": [
        77,
        235,
        822,
        1096
      ],
      "geblaese_lvl2_hinten_links": [
        125,
        134,
        787,
        1243
      ],
      "geblaese_lvl2_hinten_rechts": [
        171,
        228,
        840,
        1149
      ],
      "geblaese_lvl2_rechts_profil": [
        338,
        270,
        363,
        1059
      ],
      "geblaese_lvl2_vorne_links": [
        87,
        263,
        852,
        1069
      ],
      "geblaese_lvl2_vorne_rechts": [
        236,
        221,
        767,
        1094
      ],
      "geblaese_lvl2_vorne_variante_01": [
        229,
        245,
        766,
        1060
      ],
      "geblaese_lvl2_vorne_variante_02": [
        170,
        245,
        823,
        1062
      ]
    },
    "directions": [
      "geblaese_lvl2_hinten",
      "geblaese_lvl2_hinten_rechts",
      "geblaese_lvl2_rechts_profil",
      "geblaese_lvl2_vorne_rechts",
      "geblaese_lvl2_vorne_variante_01",
      "geblaese_lvl2_vorne_links",
      "geblaese_lvl2_vorne_links",
      "geblaese_lvl2_hinten_links"
    ]
  },
  "lens": {
    "folder": "assets/LVL2_Charactere/Lupe",
    "frames": {
      "lupe_lvl2_hinten": [
        20,
        141,
        965,
        1361
      ],
      "lupe_lvl2_hinten_links": [
        39,
        15,
        1017,
        1304
      ],
      "lupe_lvl2_links_profil": [
        27,
        107,
        955,
        1410
      ],
      "lupe_lvl2_rechts_profil": [
        59,
        33,
        935,
        1514
      ],
      "lupe_lvl2_vorne": [
        102,
        104,
        880,
        1372
      ],
      "lupe_lvl2_vorne_draufsicht": [
        85,
        94,
        1069,
        1240
      ],
      "lupe_lvl2_vorne_links": [
        234,
        27,
        825,
        1299
      ],
      "lupe_lvl2_vorne_rechts": [
        191,
        16,
        945,
        1308
      ]
    },
    "directions": [
      "lupe_lvl2_hinten",
      "lupe_lvl2_hinten",
      "lupe_lvl2_rechts_profil",
      "lupe_lvl2_vorne_rechts",
      "lupe_lvl2_vorne",
      "lupe_lvl2_vorne_links",
      "lupe_lvl2_links_profil",
      "lupe_lvl2_hinten_links"
    ]
  }
};

// Ignore nearly invisible generation fringe when measuring the visible level-3 sprite.
const LEVEL3_SKINS = {
  "cactus": {
    "folder": "assets/LVL3_Charactere/Kaktus",
    "frames": {
      "kaktus_lvl3_hinten_variante_01": [
        135,
        127,
        771,
        1160
      ],
      "kaktus_lvl3_hinten_variante_02": [
        127,
        162,
        776,
        1104
      ],
      "kaktus_lvl3_rechts_profil_variante_01": [
        275,
        160,
        800,
        1121
      ],
      "kaktus_lvl3_rechts_profil_variante_02": [
        292,
        168,
        770,
        1087
      ],
      "kaktus_lvl3_vorne": [
        256,
        102,
        716,
        1178
      ],
      "kaktus_lvl3_vorne_links": [
        114,
        161,
        803,
        1108
      ],
      "kaktus_lvl3_vorne_rechts_variante_01": [
        268,
        162,
        742,
        1132
      ],
      "kaktus_lvl3_vorne_rechts_variante_02": [
        274,
        117,
        765,
        1167
      ]
    },
    "directions": [
      "kaktus_lvl3_hinten_variante_01",
      "kaktus_lvl3_hinten_variante_02",
      "kaktus_lvl3_rechts_profil_variante_01",
      "kaktus_lvl3_vorne_rechts_variante_01",
      "kaktus_lvl3_vorne",
      "kaktus_lvl3_vorne_links",
      "kaktus_lvl3_vorne_links",
      "kaktus_lvl3_hinten_variante_01"
    ]
  },
  "fan": {
    "folder": "assets/LVL3_Charactere/Geblease",
    "frames": {
      "geblaese_lvl3_hinten": [
        55,
        198,
        941,
        1140
      ],
      "geblaese_lvl3_hinten_links": [
        119,
        123,
        800,
        1258
      ],
      "geblaese_lvl3_hinten_rechts": [
        166,
        204,
        871,
        1163
      ],
      "geblaese_lvl3_rechts_profil": [
        316,
        199,
        394,
        1089
      ],
      "geblaese_lvl3_vorne_links": [
        10,
        136,
        1017,
        1225
      ],
      "geblaese_lvl3_vorne_rechts": [
        225,
        199,
        824,
        1124
      ],
      "geblaese_lvl3_vorne_variante_01": [
        202,
        203,
        849,
        1117
      ],
      "geblaese_lvl3_vorne_variante_02": [
        140,
        198,
        895,
        1124
      ]
    },
    "directions": [
      "geblaese_lvl3_hinten",
      "geblaese_lvl3_hinten_rechts",
      "geblaese_lvl3_rechts_profil",
      "geblaese_lvl3_vorne_rechts",
      "geblaese_lvl3_vorne_variante_01",
      "geblaese_lvl3_vorne_links",
      "geblaese_lvl3_vorne_links",
      "geblaese_lvl3_hinten_links"
    ]
  },
  "lens": {
    "folder": "assets/LVL3_Charactere/Lupe",
    "frames": {
      "lupe_lvl3_hinten": [
        17,
        137,
        976,
        1363
      ],
      "lupe_lvl3_hinten_links": [
        32,
        13,
        1032,
        1310
      ],
      "lupe_lvl3_links_profil": [
        23,
        100,
        961,
        1403
      ],
      "lupe_lvl3_rechts_profil": [
        52,
        33,
        940,
        1506
      ],
      "lupe_lvl3_vorne": [
        96,
        99,
        895,
        1383
      ],
      "lupe_lvl3_vorne_draufsicht": [
        88,
        70,
        1068,
        1229
      ],
      "lupe_lvl3_vorne_links": [
        234,
        24,
        846,
        1307
      ],
      "lupe_lvl3_vorne_rechts": [
        190,
        14,
        960,
        1315
      ]
    },
    "directions": [
      "lupe_lvl3_hinten",
      "lupe_lvl3_hinten",
      "lupe_lvl3_rechts_profil",
      "lupe_lvl3_vorne_rechts",
      "lupe_lvl3_vorne",
      "lupe_lvl3_vorne_links",
      "lupe_lvl3_links_profil",
      "lupe_lvl3_hinten_links"
    ]
  }
};

export { LEVEL2_SKINS, LEVEL3_SKINS };
