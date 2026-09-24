import test from 'node:test';
import assert from 'node:assert/strict';
import { createTower, purchaseTower } from './modules/towers.js';
import { createTowerControls } from './modules/tower-controls.js';

class Element {
  handlers = new Map();
  dataset = {};
  classList = { toggle() {} };
  hidden = false;
  open = false;
  captures = new Set();
  addEventListener(type, handler) {
    const handlers = this.handlers.get(type) || [];
    handlers.push(handler);
    this.handlers.set(type, handlers);
  }
  emit(type, values = {}) {
    const event = { button: 0, isPrimary: true, pointerId: 1, preventDefault() {}, ...values };
    for (const handler of this.handlers.get(type) || []) handler(event);
  }
  getBoundingClientRect() { return { left: 0, top: 0, right: 640, bottom: 480, width: 640, height: 480 }; }
  focus() {}
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); this.emit('lostpointercapture', { pointerId: id }); }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
}

function setup({ buyOnPlace = false } = {}) {
  globalThis.window = new Element();
  globalThis.document = new Element();
  const source = createTower('cactus', 36, 36);
  source.cooldown = 0.4;
  const target = createTower('cactus', 84, 36);
  const state = { active: true, paused: false, selectedTowerType: null, buildCursor: { active: false }, player: {
    towers: [source, target], gold: 0,
    map: { hudCrop: 0, image: { naturalWidth: 320, naturalHeight: 240 },
      buildZones: [{ x: 20, y: 20, w: 260, h: 180 }] }
  }, enemy: { towers: [createTower('lens', 36, 36)] } };
  const nodes = Object.fromEntries(['canvas', 'panel', 'label', 'feedback', 'removeButton', 'dialog', 'cancelButton', 'confirmButton'].map((name) => [name, new Element()]));
  const builds = [];
  const controls = createTowerControls({ ...nodes, getState: () => state,
    clearBuildSelection() { state.selectedTowerType = null; },
    placeTower: (...args) => {
      builds.push(args);
      if (!buyOnPlace || !state.selectedTowerType) return;
      const outcome = purchaseTower(state.player, state.selectedTowerType, ...args);
      if (outcome.result === 'merge' || outcome.result === 'build') {
        state.selectedTowerType = null;
        controls.finishPlacement(outcome.result === 'merge' ? outcome.tower : null);
      }
      return outcome;
    }, onChange() {}, onMessage() {} });
  const pointer = (type, x, y, extra = {}) => nodes.canvas.emit(type, { clientX: x * 2, clientY: y * 2, ...extra });
  const select = () => { pointer('pointerdown', 36, 36); pointer('pointerup', 36, 36); };
  return { ...nodes, controls, state, source, target, pointer, select, builds };
}

test('click and small jitter select without moving, buying or resetting cooldown', () => {
  const h = setup();
  h.pointer('pointerdown', 36, 36);
  h.pointer('pointermove', 38, 36);
  h.pointer('pointerup', 38, 36);
  assert.equal(h.controls.view.selected, h.source);
  assert.equal(h.panel.hidden, false);
  assert.equal(h.label.textContent, 'Kaktus · Stufe 1');
  assert.deepEqual([h.source.x, h.source.y, h.source.cooldown], [36, 36, 0.4]);
  assert.equal(h.controls.view.drag, null);
  assert.deepEqual(h.builds, []);
});

test('drag preview does not mutate source; dropping moves once and preserves cooldown', () => {
  const h = setup();
  h.pointer('pointerdown', 36, 32); // Grab above the anchor; preserve that offset.
  h.pointer('pointermove', 60, 32);
  assert.equal(h.controls.view.drag.result, 'move');
  assert.equal(h.source.x, 36);
  h.pointer('pointerup', 60, 32);
  assert.deepEqual([h.source.x, h.source.y, h.source.cooldown], [60, 36, 0.4]);
  h.pointer('pointerup', 60, 32);
  assert.equal(h.state.player.towers.length, 2);
});

test('dragging to a compatible sprite merges exactly once and never touches enemy towers', () => {
  const h = setup();
  const enemy = structuredClone(h.state.enemy);
  h.pointer('pointerdown', 36, 36);
  h.pointer('pointermove', 84, 24);
  assert.equal(h.controls.view.drag.result, 'merge');
  assert.equal(h.controls.view.drag.target, h.target);
  h.pointer('pointerup', 84, 24);
  h.pointer('pointerup', 84, 24);
  assert.equal(h.state.player.towers.length, 1);
  assert.equal(h.controls.view.selected.level, 2);
  assert.deepEqual([h.controls.view.selected.x, h.controls.view.selected.y], [84, 36]);
  assert.equal(h.controls.view.selected.cooldown, 0.4);
  assert.deepEqual(h.state.enemy, enemy);
});

test('outside drops, incompatible targets and interrupted drags leave state intact', () => {
  for (const interruption of ['outside', 'incompatible', 'pointercancel', 'lostpointercapture', 'Escape', 'blur']) {
    const h = setup();
    h.target.type = 'fan';
    const before = structuredClone(h.state);
    h.pointer('pointerdown', 36, 36);
    h.pointer('pointermove', 60, 36);
    if (interruption === 'outside') h.pointer('pointerup', 330, 36);
    else if (interruption === 'incompatible') h.pointer('pointerup', 84, 36);
    else if (interruption === 'Escape') h.canvas.emit('keydown', { key: 'Escape' });
    else if (interruption === 'blur') window.emit('blur');
    else h.pointer(interruption, 60, 36);
    h.pointer('pointerup', 60, 36);
    assert.deepEqual(h.state, before, interruption);
    assert.equal(h.controls.view.drag, null);
  }
});

test('cancel and Escape preserve tower; only open-dialog confirmation removes it without refund', () => {
  const h = setup();
  h.select();
  h.confirmButton.emit('click');
  assert.equal(h.state.player.towers.length, 2);
  h.select();
  h.removeButton.emit('click');
  assert.equal(h.dialog.open, true);
  assert.equal(h.state.player.towers.length, 2);
  h.cancelButton.emit('click');
  assert.equal(h.dialog.open, false);
  assert.equal(h.state.player.towers.length, 2);
  h.removeButton.emit('click');
  h.dialog.emit('cancel');
  h.dialog.close();
  assert.equal(h.state.player.towers.length, 2);
  h.removeButton.emit('click');
  h.confirmButton.emit('click');
  h.confirmButton.emit('click');
  assert.deepEqual(h.state.player.towers, [h.target]);
  assert.equal(h.state.player.gold, 0);
  assert.equal(h.panel.hidden, true);
});

test('inactive, paused, secondary-button and second-pointer events cannot edit', () => {
  const h = setup();
  for (const flags of [{ active: false, paused: false }, { active: true, paused: true }]) {
    Object.assign(h.state, flags);
    h.select();
    assert.equal(h.controls.view.selected, null);
  }
  Object.assign(h.state, { active: true, paused: false });
  h.pointer('pointerdown', 36, 36, { button: 2 });
  h.pointer('pointerdown', 36, 36, { isPrimary: false });
  assert.equal(h.controls.view.selected, null);
  h.pointer('pointerdown', 36, 36);
  h.pointer('pointermove', 84, 36, { pointerId: 2 });
  h.pointer('pointerup', 84, 36, { pointerId: 2 });
  assert.equal(h.controls.view.drag.active, false);
  h.controls.clear();
  assert.equal(h.controls.view.drag, null);
  assert.equal(h.canvas.captures.size, 0);
  assert.equal(h.state.player.towers.length, 2);
});

test('match cleanup closes pending confirmation and releases selection', () => {
  const h = setup();
  h.select();
  h.removeButton.emit('click');
  h.state.active = false;
  h.controls.clear();
  h.confirmButton.emit('click');
  assert.equal(h.dialog.open, false);
  assert.equal(h.controls.view.selected, null);
  assert.equal(h.state.player.towers.length, 2);
});

test('hovering identifies the tower without selecting or modifying it', () => {
  const h = setup();
  const before = structuredClone(h.state);
  h.pointer('pointermove', 36, 36);
  assert.equal(h.controls.view.hovered, h.source);
  assert.equal(h.feedback.dataset.state, 'hover');
  assert.ok(h.feedback.textContent.includes('Kaktus · Stufe 1 · Schaden 0,3'));
  assert.equal(h.controls.view.selected, null);
  assert.deepEqual(h.state, before);
  h.canvas.emit('pointerleave');
  assert.equal(h.controls.view.hovered, null);
});

test('the visible level badge is also a selectable and draggable part of a tower', () => {
  const h = setup();
  h.pointer('pointerdown', 44, 48);
  h.pointer('pointerup', 44, 48);
  assert.equal(h.controls.view.selected, h.source);
  assert.deepEqual(h.builds, []);
});

test('merge preview follows the dragged tower anchor when the pointer misses the sprite edge', () => {
  const h = setup();
  h.pointer('pointerdown', 36, 18);
  h.pointer('pointermove', 84, 17);
  assert.deepEqual([h.controls.view.drag.x, h.controls.view.drag.y], [84, 36]);
  assert.equal(h.controls.view.drag.result, 'merge');
  assert.equal(h.feedback.dataset.state, 'merge');
  assert.ok(h.feedback.textContent.includes('Loslassen zum Verschmelzen'));
  assert.ok(h.feedback.textContent.includes('Stufe 1 + 1 → Stufe 2'));
  h.pointer('pointerup', 84, 17);
  assert.equal(h.state.player.towers.length, 1);
  assert.equal(h.state.player.towers[0].level, 2);
});

test('build selection takes precedence over existing-tower drag and ends after one purchase merge', () => {
  const h = setup({ buyOnPlace: true });
  h.state.selectedTowerType = 'cactus';
  h.state.player.gold = 50;
  const before = structuredClone(h.state.player);
  h.pointer('pointermove', 44, 48);
  assert.ok(h.feedback.textContent.includes('Zu Stufe 2 verschmelzen'));
  assert.equal(h.controls.view.placement.target, h.source);
  assert.deepEqual(h.state.player, before);
  h.pointer('pointerdown', 44, 48);
  h.pointer('pointerup', 44, 48);
  assert.equal(h.state.player.towers.length, 2); // One upgraded source and the untouched target.
  assert.equal(h.state.player.towers[0].level, 2);
  assert.equal(h.state.player.gold, 25);
  assert.equal(h.state.selectedTowerType, null);
  assert.equal(h.controls.view.placement, null);
  assert.equal(h.controls.view.drag, null);
  h.pointer('pointerdown', 44, 48);
  h.pointer('pointerup', 44, 48);
  assert.equal(h.state.player.gold, 25);
  assert.equal(h.state.player.towers.length, 2);
});

test('build preview can leave a merge target and clicking uses the new free position', () => {
  const h = setup({ buyOnPlace: true });
  h.state.selectedTowerType = 'cactus';
  h.state.player.gold = 50;
  h.pointer('pointermove', 36, 36);
  assert.equal(h.controls.view.placement.result, 'merge');
  h.pointer('pointermove', 132, 36);
  assert.equal(h.controls.view.placement.result, 'build');
  h.pointer('pointerdown', 132, 36);
  h.pointer('pointerup', 132, 36);
  assert.equal(h.state.player.towers.length, 3);
  assert.ok(h.state.player.towers.every(t => t.level === 1));
  assert.equal(h.state.player.gold, 25);
  assert.equal(h.state.selectedTowerType, null);
});

test('insufficient gold at click invalidates a formerly valid preview without losing selection', () => {
  const h = setup({ buyOnPlace: true });
  h.state.selectedTowerType = 'cactus';
  h.state.player.gold = 25;
  h.pointer('pointermove', 36, 36);
  assert.equal(h.controls.view.placement.result, 'merge');
  h.state.player.gold = 0;
  const before = structuredClone(h.state.player);
  h.pointer('pointerdown', 36, 36);
  h.pointer('pointerup', 36, 36);
  assert.deepEqual(h.state.player, before);
  assert.equal(h.state.selectedTowerType, 'cactus');
  assert.equal(h.controls.view.placement.result, 'gold');
  assert.ok(h.feedback.textContent.includes('Nicht genug Gold'));
  assert.equal(h.controls.view.drag, null);
});
