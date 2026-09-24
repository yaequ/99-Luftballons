import { CONFIG } from './config.js';
import { towerAtPoint, towerDropResult, towerPlacementResult, dropTower, removeTower } from './towers.js';

const DRAG_THRESHOLD = 6; // CSS pixels, independent of canvas resolution.

function createTowerControls({ canvas, panel, label, feedback, removeButton, dialog, cancelButton,
  confirmButton, getState, clearBuildSelection, placeTower, onChange, onMessage }) {
  const view = { selected: null, hovered: null, drag: null, buildPoint: null, placement: null };
  let pendingRemoval = null;
  const editable = () => getState().active && !getState().paused && !dialog.open;
  const snap = (value) => Math.floor(value / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * CONFIG.CANVAS_WIDTH / rect.width,
      y: (event.clientY - rect.top) * CONFIG.CANVAS_HEIGHT / rect.height,
      inside: event.clientX >= rect.left && event.clientX < rect.right
        && event.clientY >= rect.top && event.clientY < rect.bottom
    };
  }

  function refresh() {
    if (!getState().player.towers.includes(view.selected)) view.selected = null;
    if (!getState().player.towers.includes(view.hovered)) view.hovered = null;
    panel.hidden = !view.selected;
    if (view.selected) label.textContent = `${CONFIG.TOWERS[view.selected.type].name} · Stufe ${view.selected.level}`;
    canvas.classList.toggle('is-dragging-tower', Boolean(view.drag?.active));
    canvas.classList.toggle('has-hovered-tower', Boolean(view.hovered && editable() && !getState().selectedTowerType));
    updateFeedback();
    onChange();
  }

  function updateFeedback() {
    const drag = view.drag?.active ? view.drag : null;
    const tower = view.hovered || view.selected;
    const type = getState().selectedTowerType;
    view.placement = type && view.buildPoint && editable()
      ? towerPlacementResult(getState().player, type, view.buildPoint.x, view.buildPoint.y, view.buildPoint.hitX, view.buildPoint.hitY) : null;
    let text = 'Spiel starten. Danach Türme bauen oder einen neuen Turm auf einen passenden Turm setzen.';
    let state = 'idle';
    if (getState().paused) {
      text = 'Spiel pausiert. Zum Verschieben und Verschmelzen bitte fortsetzen.';
    } else if (view.placement) {
      const placement = view.placement;
      if (placement.result === 'merge') {
        text = `Zu Stufe ${placement.target.level + 1} verschmelzen · ${CONFIG.TOWERS[type].name} · ${CONFIG.TOWERS[type].cost} Gold. Zum Bestätigen klicken.`;
        state = 'merge';
      } else if (placement.result === 'build') {
        text = `${CONFIG.TOWERS[type].name} · Stufe 1 für ${CONFIG.TOWERS[type].cost} Gold hier bauen. Zum Bestätigen klicken.`;
        state = 'build';
      } else {
        text = placement.result === 'gold' ? `Nicht genug Gold. Benötigt: ${CONFIG.TOWERS[type].cost} Gold.`
          : placement.result === 'incompatible' ? 'Kein Verschmelzen: gleicher Turmtyp und gleiche Stufe nötig. Neue Türme sind Stufe 1.'
          : 'Hier kann kein Turm gebaut werden. Eine freie Baufläche wählen.';
        state = 'invalid';
      }
    } else if (drag) {
      if (drag.result === 'merge') {
        text = `Loslassen zum Verschmelzen: ${CONFIG.TOWERS[drag.source.type].name} · Stufe ${drag.source.level} + ${drag.target.level} → Stufe ${drag.source.level + 1}.`;
        state = 'merge';
      } else if (drag.result === 'move') {
        text = 'Loslassen zum Verschieben. Stufe und Abklingzeit bleiben erhalten.';
        state = 'move';
      } else {
        text = drag.result === 'incompatible'
          ? 'Kein Verschmelzen: gleicher Turmtyp und gleiche Stufe nötig. Stufe 3 ist maximal.'
          : 'Ungültiger Platz. Beim Loslassen bleibt der Turm an seiner bisherigen Position.';
        state = 'invalid';
      }
    } else if (tower && getState().active) {
      text = `${CONFIG.TOWERS[tower.type].name} · Stufe ${tower.level} · Schaden ${tower.damage.toLocaleString('de-DE', { maximumFractionDigits: 3 })}. Gedrückt halten und ziehen.`;
      state = 'hover';
    } else if (getState().active) {
      text = 'Turm mit gedrückter Maustaste auf einen gleichen Turm derselben Stufe ziehen. Dann loslassen.';
    }
    if (feedback.textContent !== text) feedback.textContent = text;
    feedback.dataset.state = state;
  }

  function cancelDrag() {
    const drag = view.drag;
    view.drag = null;
    view.hovered = null;
    if (drag && canvas.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId);
    refresh();
  }

  function clear() {
    pendingRemoval = null;
    if (dialog.open) dialog.close();
    view.selected = null;
    view.buildPoint = null;
    view.placement = null;
    cancelDrag();
  }

  function previewPlacement(x, y, hitX = x, hitY = y) {
    view.buildPoint = { x, y, hitX, hitY };
    view.hovered = null;
    refresh();
  }

  function finishPlacement(tower = null) {
    view.selected = tower;
    view.hovered = null;
    view.buildPoint = null;
    refresh();
  }

  function updateDrag(event) {
    const drag = view.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.active ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= DRAG_THRESHOLD;
    if (!drag.active) return;
    const pos = point(event);
    drag.x = snap(pos.x - drag.offsetX);
    drag.y = snap(pos.y - drag.offsetY);
    // The grab offset and grid snapping can leave the pointer just outside a
    // sprite even though the dragged tower is on top of it.
    drag.target = pos.inside ? (towerAtPoint(getState().player, pos.x, pos.y, drag.source)
      || towerAtPoint(getState().player, drag.x, drag.y, drag.source)) : null;
    drag.result = pos.inside
      ? towerDropResult(getState().player, drag.source, drag.x, drag.y, drag.target) : 'outside';
    refresh();
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!editable() || view.drag || event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    const pos = point(event);
    // A build selection takes precedence over selecting/dragging an existing tower.
    // Pass the actual click coordinates, never a cached hover target.
    if (getState().selectedTowerType) {
      view.selected = null;
      view.buildPoint = { x: snap(pos.x), y: snap(pos.y), hitX: pos.x, hitY: pos.y };
      placeTower(snap(pos.x), snap(pos.y), pos.x, pos.y);
      refresh();
      return;
    }
    const tower = towerAtPoint(getState().player, pos.x, pos.y);
    if (!tower) {
      view.selected = null;
      placeTower(snap(pos.x), snap(pos.y));
      refresh();
      return;
    }
    clearBuildSelection();
    view.hovered = null;
    view.selected = tower;
    view.drag = {
      source: tower, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      offsetX: pos.x - tower.x, offsetY: pos.y - tower.y,
      x: tower.x, y: tower.y, target: null, active: false, result: 'move'
    };
    canvas.setPointerCapture(event.pointerId);
    refresh();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (view.drag) {
      updateDrag(event);
      return;
    }
    const pos = point(event);
    if (getState().selectedTowerType) {
      getState().buildCursor.active = false;
      previewPlacement(snap(pos.x), snap(pos.y), pos.x, pos.y);
      return;
    }
    const hovered = editable() && pos.inside ? towerAtPoint(getState().player, pos.x, pos.y) : null;
    if (hovered !== view.hovered) {
      view.hovered = hovered;
      refresh();
    }
  });
  canvas.addEventListener('pointerleave', () => {
    view.hovered = null;
    view.buildPoint = null;
    refresh();
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!view.drag || view.drag.pointerId !== event.pointerId) return;
    updateDrag(event);
    const drag = view.drag;
    if (drag.active && editable()) {
      if (drag.result === 'move' || drag.result === 'merge') {
        const dropped = dropTower(getState().player, drag.source, drag.x, drag.y, drag.target);
        view.selected = dropped.tower;
        if (dropped.result === 'merge') onMessage(`Verschmolzen: ${CONFIG.TOWERS[dropped.tower.type].name}, Stufe ${dropped.tower.level}.`);
      } else {
        onMessage(drag.result === 'incompatible'
          ? 'Nur gleiche Türme derselben Stufe lassen sich bis Stufe 3 verschmelzen.'
          : 'Ungültiger Platz. Der Turm bleibt an seiner bisherigen Position.');
      }
    }
    cancelDrag();
  });
  for (const name of ['pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, (event) => {
      if (view.drag?.pointerId === event.pointerId) cancelDrag();
    });
  }
  window.addEventListener('blur', cancelDrag);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelDrag();
  });
  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && (view.drag || view.selected)) {
      event.preventDefault();
      clear();
    }
  });

  removeButton.addEventListener('click', () => {
    if (!editable() || !getState().player.towers.includes(view.selected)) return;
    cancelDrag();
    pendingRemoval = view.selected;
    dialog.showModal();
    cancelButton.focus();
  });
  cancelButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', () => { pendingRemoval = null; });
  dialog.addEventListener('close', () => {
    pendingRemoval = null;
    if (getState().active && view.selected) removeButton.focus({ preventScroll: true });
  });
  confirmButton.addEventListener('click', () => {
    if (dialog.open && getState().active && !getState().paused && pendingRemoval) {
      removeTower(getState().player, pendingRemoval);
      view.selected = null;
    }
    pendingRemoval = null;
    dialog.close();
    refresh();
    canvas.focus({ preventScroll: true });
  });

  return { view, clear, cancelDrag, updateFeedback, previewPlacement, finishPlacement };
}

export { createTowerControls };
