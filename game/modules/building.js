import { CONFIG } from './config.js';
function mapPathPoint(map, point) {
  return {
    x: (point.x / map.image.naturalWidth) * CONFIG.CANVAS_WIDTH,
    y: ((point.y - map.hudCrop) / (map.image.naturalHeight - map.hudCrop)) * CONFIG.CANVAS_HEIGHT
  };
}

function buildZonesForMap(map) {
  if (!map.image.naturalWidth || !map.image.naturalHeight) return [];
  return map.buildZones.map((zone) => {
    const topLeft = mapPathPoint(map, zone);
    const bottomRight = mapPathPoint(map, { x: zone.x + zone.w, y: zone.y + zone.h });
    return { x: topLeft.x, y: topLeft.y, w: bottomRight.x - topLeft.x, h: bottomRight.y - topLeft.y };
  });
}

function pointInBuildZone(map, x, y) {
  return buildZonesForMap(map).some((zone) => x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h);
}

function canBuildAt(side, type, x, y, isFree = false, ignoredTower = null) {
  const towerData = CONFIG.TOWERS[type];
  if (!isFree && side.gold < towerData.cost) return 'gold';
  if (!pointInBuildZone(side.map, x, y)) return 'zone';
  if (side.towers.some((tower) => tower !== ignoredTower && Math.hypot(tower.x - x, tower.y - y) < CONFIG.GRID_SIZE * 1.5)) return 'occupied';
  return true;
}

export { mapPathPoint, buildZonesForMap, canBuildAt };
