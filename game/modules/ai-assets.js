import { CONFIG } from './ai-config.js';
import { LEVEL2_SKINS, LEVEL3_SKINS } from './character-skins.js';
function imageAsset(src) {
  const image = new Image();
  image.dataset.src = src;
  return image;
}

function numberedImageAssets(folder, prefix) {
  return Array.from({ length: 10 }, (_, index) => imageAsset(`${folder}/${prefix} ${index + 1}.png`));
}

function skinAssets(skins) {
  return Object.fromEntries(Object.entries(skins).map(([type, skin]) => [type,
    Object.fromEntries(Object.entries(skin.frames).map(([name, bounds]) => {
      const image = imageAsset(`${skin.folder}/${name}.png`);
      image.spriteBounds = bounds;
      return [name, image];
    }))
  ]));
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
  characterUpgrades: skinAssets(LEVEL2_SKINS),
  characterLevel3: skinAssets(LEVEL3_SKINS),
  balloons: Object.fromEntries(['red', 'blue', 'green', 'yellow'].map((type) => [type,
    Array.from({ length: type === 'yellow' ? 6 : 7 }, (_, index) =>
      imageAsset(`assets/Balloons/transparent/${type}/balloon_${type}_frame_${String(index + 1).padStart(2, '0')}.png`))
  ])),
  boss: imageAsset('assets/Balloons/boss-balloon.png')
};

function towerImage(tower) {
  if (tower.level >= 2) {
    const direction = CONFIG.TOWERS[tower.type].directionFrames.indexOf(tower.frameIndex);
    const skin = (tower.level >= 3 ? LEVEL3_SKINS : LEVEL2_SKINS)[tower.type];
    const images = tower.level >= 3 ? ASSETS.characterLevel3 : ASSETS.characterUpgrades;
    return images[tower.type][skin.directions[direction < 0 ? 4 : direction]];
  }
  const frames = ASSETS.characters[tower.type];
  return frames[tower.frameIndex] || frames[0];
}

function whenImageReady(image) {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const source = image.dataset.src;
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', () => reject(new Error(source)), { once: true });
    if (image.complete && image.getAttribute('src')) image.removeAttribute('src');
    if (!image.getAttribute('src')) image.src = source;
  });
}

export { ASSETS, whenImageReady, towerImage };
