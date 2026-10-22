import { CONFIG } from '../game/modules/ai-config.js';
import { ASSETS, whenImageReady } from '../game/modules/ai-assets.js';
import { MAP_DATA } from '../game/modules/maps.js';
import { createRenderer } from '../game/modules/ai-renderer.js';
import { canBuildAt } from '../game/modules/ai-building.js';
import { towerAtPoint, canMergeTowers, towerDropResult } from '../game/modules/towers.js';
import { sendBatchSize, isSendUnlocked } from '../game/modules/sending.js';
import { createMultiplayerEngine } from './engine.js?v=multiplayer-controls-3';

const shell = document.querySelector('.multiplayer-match-shell[data-local-engine="true"]');
if (!shell) throw new Error('Multiplayer canvas shell not found.');

const playerCanvas = document.getElementById('multiplayer-player-canvas');
const opponentCanvas = document.getElementById('multiplayer-opponent-canvas');
const playerContext = playerCanvas.getContext('2d');
const opponentContext = opponentCanvas.getContext('2d');
const loadingStatus = document.getElementById('multiplayer-canvas-status');
const mapTip = document.getElementById('multiplayer-map-tip');
const towerButtons = [...document.querySelectorAll('.mp-tower-card')];
const balloonButtons = [...document.querySelectorAll('.mp-balloon-card')];
const startRoundButton = document.getElementById('multiplayer-start-round');
const pauseButton = document.getElementById('multiplayer-pause');
const autoStartInput = document.getElementById('multiplayer-auto-start');
const localStatus = document.getElementById('multiplayer-local-status');
const towerFeedback = document.getElementById('multiplayer-tower-feedback');
const towerActions = document.getElementById('multiplayer-tower-actions');
const selectedTowerLabel = document.getElementById('multiplayer-selected-tower-label');
const removeTowerButton = document.getElementById('multiplayer-remove-tower');
const removeDialog = document.getElementById('multiplayer-remove-dialog');
const cancelRemoveButton = document.getElementById('multiplayer-cancel-remove');
const confirmRemoveButton = document.getElementById('multiplayer-confirm-remove');
const resultModal = document.getElementById('multiplayer-result-modal');
const resultTitle = document.getElementById('multiplayer-result-title');
const resultMessage = document.getElementById('multiplayer-result-message');
const resultIcon = document.getElementById('multiplayer-result-icon');
const rematchButton = document.getElementById('multiplayer-rematch');
const resultMenuButton = document.getElementById('multiplayer-result-menu');
const resultHistoryLink = document.getElementById('multiplayer-result-history');
const connectionStatus = document.getElementById('connection-status');
const connectionLabel = document.getElementById('connection-label');
const mousePosition = { x: 0, y: 0, onCanvas: false };
const playerMap = MAP_DATA[shell.dataset.playerMap];
const opponentMap = MAP_DATA[shell.dataset.opponentMap];
const gameApi = shell.dataset.gameApi;
const matchId = Number(shell.dataset.matchId);
const ownSide = Number(shell.dataset.playerSide);
const csrfToken = shell.dataset.csrfToken;
if (!playerMap || !opponentMap || !gameApi || !matchId || !ownSide) throw new Error('Multiplayer configuration is invalid.');

let readyState = { you: false, opponent: false };
let lastEventId = 0;
let requestRunning = false;
let online = true;
let assetsReady = false;
let animationFrame = 0;
let autoReadyTimer = 0;
let snapshotTimer = 0;
let snapshotRestored = false;
let resultReported = false;
let resultDisplayed = false;
let selectedTower = null;
let hoveredTower = null;
let towerDrag = null;
let pendingRemoval = null;
let firstRoundPending = false;
let firstRoundGateChecked = false;

const firstRoundTour = window.FirstRoundTour?.create({
  apiUrl: document.body.dataset.firstRoundApi,
  csrfToken: document.body.dataset.firstRoundCsrf
});
const firstRoundSteps = [
  { target: '.mp-map-card:not(.mp-map-card--opponent)', title: 'Verteidige deine Basis', text: 'Auf deiner Karte verteidigst du den Weg. Erreichen Ballons das Ziel, verlierst du Lebenspunkte. Bei 0 ist das Duell verloren.' },
  { target: '.mp-tower-grid', title: 'Wähle deine Türme', text: 'Kaktus, Gebläse und Lupe haben unterschiedliche Stärken. Vor Runde 1 sind drei Platzierungen kostenlos.' },
  { target: '#multiplayer-player-canvas', getSpotlightRect: () => window.FirstRoundTour.buildZoneRect(playerCanvas, playerMap), title: 'Bauen und verbessern', text: 'Wähle einen Turm und klicke auf eine dunkle Baufläche. Gleiche Türme derselben Stufe lassen sich aufeinanderziehen und verbessern.' },
  { target: '#multiplayer-start-round', title: 'Runde gemeinsam starten', text: 'Du und dein Gegenspieler müssen beide bereit sein. Erst dann startet die Ballonwelle auf beiden Karten.' },
  { target: '.mp-map-card--opponent', title: 'Sieh den Gegner', text: 'Rechts siehst du die gegnerische Karte. Fällt seine Basis auf 0 Lebenspunkte, gewinnst du.' },
  { target: '.mp-player-card:not(.mp-player-card--opponent) .mp-resources', title: 'Gold und Einkommen', text: 'Gold brauchst du für Türme und Ballonpakete. Dein Einkommen bringt jede Sekunde neues Gold.' },
  { target: '.mp-balloon-grid', title: 'Sende Ballons', text: 'Vor Runde 1 sind Ballons noch gesperrt. Sobald die Runde läuft, kannst du Ballonpakete kaufen, den Gegner angreifen und dein Einkommen erhöhen. Weitere Farben kommen später dazu.' },
  { target: '.mp-local-round-controls label', title: 'Behalte die Kontrolle', text: 'Hier schaltest du Auto-Start für spätere Runden ein oder aus. Über „Pausieren“ kannst du das laufende Duell anhalten. Danach gibst du die erste Runde frei.' }
];

const engine = createMultiplayerEngine(playerMap, opponentMap, {
  ownSide,
  onChange: updateInterface,
  onRoundComplete: (round) => {
    showStatus(`Runde ${round} geschafft. Beide Spieler können die nächste Runde freigeben.`);
    if (autoStartInput.checked) autoReadyTimer = window.setTimeout(requestRoundReady, 1800);
  },
  onGameOver: (result) => {
    shell.dataset.matchFinished = 'true';
    showStatus(result === 'win' ? 'Sieg! Die gegnerische Basis ist gefallen.' : result === 'loss' ? 'Niederlage: Deine Basis ist gefallen.' : 'Alle 30 Runden geschafft.');
    finalizeResult(result);
  }
});
const state = engine.state;
const { renderSide, renderTowerPortraits, renderBalloonPortraits } = createRenderer(() => state, mousePosition, () => {
  if (selectedTower && !state.player.towers.includes(selectedTower)) selectedTower = null;
  if (hoveredTower && !state.player.towers.includes(hoveredTower)) hoveredTower = null;
  const type = state.selectedTowerType;
  const point = mousePosition.onCanvas ? mousePosition : state.buildCursor.active ? state.buildCursor : null;
  const interaction = { selected: selectedTower, hovered: hoveredTower || selectedTower, drag: towerDrag };
  if (!type || !point) return interaction;
  const target = towerAtPoint(state.player, point.x, point.y);
  const result = target
    ? (canMergeTowers({ type, level: 1 }, target) && state.player.gold >= CONFIG.TOWERS[type].cost ? 'merge' : 'incompatible')
    : (canBuildAt(state.player, type, point.x, point.y,
      state.player.freeBuildsRemaining > 0 && state.currentRound === 0) === true ? 'build' : 'zone');
  return { ...interaction, placement: { type, x: point.x, y: point.y, target, result } };
});
let lastFrameTime = performance.now();
let accumulator = 0;

function actionId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function prefixAsset(image) {
  const source = image.dataset.src;
  if (source && !source.startsWith('../game/') && !source.startsWith('game/')) image.dataset.src = `game/${source}`;
}

function requiredAssets() {
  const images = [state.player.map.image, state.enemy.map.image, ...Object.values(ASSETS.characters).flat(),
    ...Object.values(ASSETS.characterUpgrades).flatMap((frames) => Object.values(frames)),
    ...Object.values(ASSETS.characterLevel3).flatMap((frames) => Object.values(frames)),
    ...Object.values(ASSETS.balloons).flat(), ASSETS.boss];
  [...new Set(images)].forEach(prefixAsset);
  return [...new Set(images)];
}

function updateHealth(prefix, value) {
  const health = Math.max(0, Math.min(99, Math.round(value)));
  document.getElementById(`${prefix}-hp`).textContent = `${health} / 99`;
  const meter = document.getElementById(`${prefix}-health`);
  meter.setAttribute('aria-valuenow', String(health)); meter.querySelector('i').style.width = `${health / 99 * 100}%`;
}

function roundButtonLabel() {
  if (state.result) return 'Match beendet';
  if (['spawning', 'clearing'].includes(state.roundStatus)) return `Runde ${state.currentRound} läuft`;
  if (readyState.you && readyState.opponent) return 'Runde wird gestartet …';
  if (readyState.you) return 'Warte auf Gegner …';
  if (readyState.opponent) return `Runde ${state.currentRound + 1} bestätigen`;
  return state.currentRound === 0 ? 'Bereit für Runde 1' : `Bereit für Runde ${state.currentRound + 1}`;
}

function updateTowerSelection() {
  if (selectedTower && !state.player.towers.includes(selectedTower)) selectedTower = null;
  if (hoveredTower && !state.player.towers.includes(hoveredTower)) hoveredTower = null;
  towerActions.hidden = !selectedTower;
  if (selectedTower) selectedTowerLabel.textContent = `${CONFIG.TOWERS[selectedTower.type].name} · Stufe ${selectedTower.level}`;
  removeTowerButton.disabled = !online || !assetsReady || state.paused || Boolean(state.result) || removeDialog.open;
  const drag = towerDrag?.active ? towerDrag : null;
  const tower = hoveredTower || selectedTower;
  let message = state.currentRound === 0 && state.player.freeBuildsRemaining > 0
    ? `Vorbereitung: noch ${state.player.freeBuildsRemaining} kostenlose Platzierungen. Danach Spiel starten. Kauf-Upgrades kosten regulär Gold.`
    : 'Turm wählen oder platzierte Türme gleicher Stufe aufeinanderziehen.';
  let feedbackState = 'idle';
  if (state.paused) message = 'Spiel pausiert. Zum Verschieben und Verschmelzen bitte fortsetzen.';
  else if (drag) {
    message = drag.result === 'move' ? 'Loslassen zum Verschieben. Stufe und Abklingzeit bleiben erhalten.'
      : drag.result === 'merge' ? `Loslassen zum Verschmelzen: ${CONFIG.TOWERS[drag.source.type].name} · Stufe ${drag.source.level + 1}.`
        : 'Ungültiger Platz. Der Turm bleibt an seiner bisherigen Position.';
    feedbackState = ['move', 'merge'].includes(drag.result) ? drag.result : 'invalid';
  } else if (tower && online && assetsReady && !state.result) {
    message = `${CONFIG.TOWERS[tower.type].name} · Stufe ${tower.level} · Schaden ${tower.damage.toLocaleString('de-DE', { maximumFractionDigits: 3 })}. Gedrückt halten und ziehen.`;
    feedbackState = 'hover';
  }
  towerFeedback.textContent = message;
  towerFeedback.dataset.state = feedbackState;
}

function updateInterface() {
  updateTowerSelection();
  document.getElementById('your-gold').textContent = String(Math.floor(state.player.gold));
  document.getElementById('your-income').textContent = `+${state.player.income.toLocaleString('de-DE', { maximumFractionDigits: 2 })} Gold/s`;
  document.getElementById('opponent-gold').textContent = String(Math.floor(state.enemy.gold));
  document.getElementById('opponent-income').textContent = `+${state.enemy.income.toLocaleString('de-DE', { maximumFractionDigits: 2 })} Gold/s`;
  document.getElementById('match-round').textContent = `${state.currentRound}/${CONFIG.WAVES}`;
  document.getElementById('multiplayer-round-state').textContent = !online ? 'Verbindung wird wiederhergestellt …'
    : state.paused ? 'Online-Match pausiert'
      : ['spawning', 'clearing'].includes(state.roundStatus) ? `${state.remainingEnemies} Ballons auf deiner Karte`
        : readyState.you ? 'Warte auf die Freigabe des Gegners' : 'Beide Spieler müssen bereit sein';
  updateHealth('your', state.player.hp); updateHealth('opponent', state.enemy.hp);
  towerButtons.forEach((button) => {
    const selected = button.dataset.tower === state.selectedTowerType;
    const free = state.currentRound === 0 && state.player.freeBuildsRemaining > 0;
    button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected));
    button.querySelector('.mp-price-value').textContent = free ? 'Gratis bauen' : String(CONFIG.TOWERS[button.dataset.tower].cost);
    button.querySelector('em img').hidden = free;
    button.title = free ? `Kostenlose Platzierung. Verschmelzen kostet ${CONFIG.TOWERS[button.dataset.tower].cost} Gold.` : '';
    button.disabled = !assetsReady || !online || Boolean(state.result)
      || (state.paused || (!free && state.player.gold < CONFIG.TOWERS[button.dataset.tower].cost));
  });
  balloonButtons.forEach((button) => {
    const type = button.dataset.balloon;
    const balloon = CONFIG.BALLOONS[type];
    const unlocked = isSendUnlocked(type, state.currentRound);
    button.disabled = !assetsReady || !online || !state.active || state.paused || Boolean(state.result)
      || !unlocked || state.player.gold < balloon.cost;
    button.querySelector('small').textContent = unlocked
      ? `${sendBatchSize(state.currentRound, type)} Ballons` : `Ab Runde ${balloon.unlockRound}`;
  });
  startRoundButton.disabled = !assetsReady || !online || state.paused || Boolean(state.result) || ['spawning', 'clearing'].includes(state.roundStatus) || readyState.you || state.currentRound >= CONFIG.WAVES;
  startRoundButton.textContent = roundButtonLabel();
  pauseButton.disabled = !online || !state.active || Boolean(state.result);
  pauseButton.textContent = state.paused ? 'Fortsetzen' : 'Pausieren'; pauseButton.setAttribute('aria-pressed', String(state.paused));
}

function showStatus(message) { localStatus.textContent = message; }
function setNetworkStatus(connected, label = connected ? 'Verbindung aktiv' : 'Verbindung wird wiederhergestellt …') {
  online = connected; connectionStatus.classList.toggle('is-offline', !connected); connectionLabel.textContent = label;
}
function formatDuration(seconds) { const value = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }

function showResult(outcome, saved) {
  const firstDisplay = !resultDisplayed;
  const draw = outcome.winner_side === null;
  const won = Number(outcome.winner_side) === ownSide;
  resultIcon.textContent = draw ? '◆' : won ? '★' : '♥';
  resultTitle.textContent = draw ? 'Unentschieden!' : won ? 'Du hast gewonnen!' : 'Dein Gegner gewinnt';
  resultMessage.textContent = draw
    ? `Du und ${shell.dataset.opponentName} beendet das Duell gleichauf.`
    : won ? `Starke Verteidigung – die Basis von ${shell.dataset.opponentName} ist gefallen.` : 'Deine Basis ist gefallen. Im Rückspiel kannst du direkt Revanche nehmen.';
  document.getElementById('multiplayer-result-round').textContent = `${state.currentRound}/${CONFIG.WAVES}`;
  document.getElementById('multiplayer-result-duration').textContent = formatDuration(state.secondsElapsed);
  document.getElementById('multiplayer-result-saved').textContent = saved ? 'Gespeichert ✓' : 'Speichert …';
  resultModal.hidden = false; resultDisplayed = true;
  if (firstDisplay) window.setTimeout(() => rematchButton.focus(), 0);
}
function setTip(step, text) { mapTip.querySelector('b').textContent = String(step); mapTip.querySelector('span').textContent = text; }

function selectTower(type) {
  if (!assetsReady || state.result) return;
  selectedTower = null;
  towerDrag = null;
  state.selectedTowerType = state.selectedTowerType === type ? null : type;
  state.buildCursor.active = Boolean(state.selectedTowerType); updateInterface();
  if (state.selectedTowerType) {
    setTip(2, `${CONFIG.TOWERS[type].name} auf einer Baufläche platzieren oder auf einen Stufe-1-Turm derselben Art setzen.`);
    playerCanvas.focus();
  }
  else setTip(1, 'Turm auswählen und auf einer dunklen Baufläche platzieren.');
}

function clearSelection() {
  state.selectedTowerType = null; state.buildCursor.active = false; updateInterface();
  setTip(1, state.currentRound === 0 && state.player.freeBuildsRemaining > 0
    ? `Noch ${state.player.freeBuildsRemaining} kostenlose Türme platzieren.`
    : 'Turm wählen oder zwei gleichstufige Türme nacheinander zum Verschmelzen anklicken.');
}

function placementMessage(result, type) {
  if (result === 'occupied') return 'Dieser Platz ist bereits belegt.';
  if (result === 'gold') return 'Nicht genug Gold für diesen Turm.';
  if (result === 'zone') return `${CONFIG.TOWERS[type].name} muss auf einer dunklen Baufläche stehen.`;
  return 'Turm konnte nicht platziert werden.';
}

function applyEvent(event) {
  if (!event?.id || event.id <= lastEventId) return;
  const owner = Number(event.side) === ownSide ? 'player' : 'enemy';
  if (event.type === 'build') engine.buildTowerFor(owner, event.payload.tower, Number(event.payload.x), Number(event.payload.y), true);
  else if (event.type === 'merge') {
    const side = owner === 'player' ? state.player : state.enemy;
    const target = side.towers[Number(event.payload.target)];
    const position = target && { x: target.x, y: target.y };
    engine.mergeTowerFor(owner, Number(event.payload.source), Number(event.payload.target), Boolean(event.payload.purchased));
    if (owner === 'player' && position) selectedTower = side.towers.find((tower) => tower.x === position.x && tower.y === position.y) || null;
  } else if (event.type === 'move') {
    engine.moveTowerFor(owner, Number(event.payload.source), Number(event.payload.x), Number(event.payload.y));
  } else if (event.type === 'remove') {
    engine.removeTowerFor(owner, Number(event.payload.source));
  }
  else if (event.type === 'send') engine.sendBalloonFor(owner, event.payload.balloon, true);
  else if (event.type === 'round_start') {
    readyState = { you: false, opponent: false };
    engine.startRound(Number(event.payload.seed));
    showStatus(`Runde ${event.payload.round} wurde gemeinsam gestartet.`);
  } else if (event.type === 'pause') engine.setPaused(Boolean(event.payload.paused));
  lastEventId = Math.max(lastEventId, Number(event.id));
}

function applyResponse(data) {
  if (!snapshotRestored) {
    snapshotRestored = true;
    if (data.snapshot?.state && engine.restoreSnapshot(data.snapshot.state)) {
      lastEventId = Math.max(lastEventId, Number(data.snapshot.event_id) || 0);
      showStatus('Gespeicherter Online-Spielstand wurde wiederhergestellt.');
    }
  }
  (data.events || []).forEach(applyEvent);
  if (data.ready) readyState = data.ready;
  if (data.outcome) {
    shell.dataset.matchFinished = 'true';
    const draw = data.outcome.winner_side === null;
    const won = Number(data.outcome.winner_side) === ownSide;
    state.result = draw ? 'draw' : (won ? 'win' : 'loss'); state.active = false;
    showStatus(draw ? 'Unentschieden! Beide Basen haben gleich viele Lebenspunkte.' : won ? 'Sieg! Das Server-Ergebnis bestätigt deinen Erfolg.' : 'Das Match ist beendet: Dein Gegner gewinnt.');
    showResult(data.outcome, Boolean(data.result_saved));
  }
  setNetworkStatus(true); updateInterface();
}

async function apiRequest(values = null) {
  while (requestRunning) await new Promise((resolve) => window.setTimeout(resolve, 20));
  requestRunning = true;
  try {
    const options = { credentials: 'same-origin', headers: { Accept: 'application/json' } };
    let url = `${gameApi}?match_id=${encodeURIComponent(matchId)}&after=${encodeURIComponent(lastEventId)}`;
    if (values) {
      const body = new URLSearchParams({ csrf_token: csrfToken, match_id: String(matchId), after: String(lastEventId), ...values });
      options.method = 'POST'; options.body = body; options.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8'; url = gameApi;
    }
    const response = await fetch(url, options); const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`);
    applyResponse(data); return data;
  } finally { requestRunning = false; }
}

async function sendAction(action, values = {}) {
  try { return await apiRequest({ action, action_id: actionId(), ...values }); }
  catch (error) { setNetworkStatus(false); updateInterface(); showStatus(`Synchronisierung fehlgeschlagen: ${error.message}`); return null; }
}

async function poll() {
  if (document.hidden || requestRunning) return;
  try { await apiRequest(); }
  catch (error) { setNetworkStatus(false); updateInterface(); showStatus('Verbindung unterbrochen – automatischer neuer Versuch läuft.'); }
}

async function sendSnapshot(force = false) {
  if (!assetsReady || document.hidden || (!force && requestRunning)) return null;
  const snapshot = JSON.stringify(engine.exportSnapshot(lastEventId));
  try { return await apiRequest({ action: 'snapshot', action_id: actionId(), snapshot }); }
  catch { setNetworkStatus(false); updateInterface(); return null; }
}

async function finalizeResult(result) {
  if (!['loss', 'survived'].includes(result) || resultReported) return;
  resultReported = true;
  const stored = await sendSnapshot(true);
  if (result === 'survived' && !stored) {
    resultReported = false;
    window.setTimeout(() => finalizeResult(result), 1500);
    return;
  }
  const reported = await sendAction('report_result', { result });
  if (!reported) {
    resultReported = false;
    window.setTimeout(() => finalizeResult(result), 1500);
  }
}

async function leaveFinishedMatch(destination) {
  [rematchButton, resultMenuButton].forEach((button) => { button.disabled = true; });
  const body = new URLSearchParams({ action: 'leave', csrf_token: csrfToken });
  try { await fetch(shell.dataset.matchmakingApi, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body, credentials: 'same-origin' }); }
  finally { window.location.assign(destination); }
}

function placeTower(x = mousePosition.x, y = mousePosition.y) {
  const type = state.selectedTowerType;
  if (!type || !assetsReady || !online || state.paused || state.result) return;
  const target = towerAtPoint(state.player, x, y);
  if (target) {
    if (!canMergeTowers({ type, level: 1 }, target)) {
      setTip(2, 'Zum Aufwerten einen Turm derselben Art auf einen Stufe-1-Turm setzen.'); return;
    }
    if (state.player.gold < CONFIG.TOWERS[type].cost) { setTip(2, 'Nicht genug Gold für die Verschmelzung.'); return; }
    sendAction('merge', { target: String(state.player.towers.indexOf(target)), purchased: '1' })
      .then((data) => { if (data) clearSelection(); });
    return;
  }
  const localCheck = canBuildAt(state.player, type, x, y, state.player.freeBuildsRemaining > 0 && state.currentRound === 0);
  if (localCheck !== true) { setTip(2, placementMessage(localCheck, type)); return; }
  sendAction('build', { tower: type, x: String(x), y: String(y) }).then((data) => {
    if (data) { selectedTower = state.player.towers.at(-1) || null; clearSelection(); }
  });
}

function updatePointer(event) {
  const rectangle = playerCanvas.getBoundingClientRect();
  mousePosition.x = Math.floor((((event.clientX - rectangle.left) * CONFIG.CANVAS_WIDTH / rectangle.width) / CONFIG.GRID_SIZE)) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
  mousePosition.y = Math.floor((((event.clientY - rectangle.top) * CONFIG.CANVAS_HEIGHT / rectangle.height) / CONFIG.GRID_SIZE)) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
  mousePosition.onCanvas = true;
}

function pointerPoint(event) {
  const rectangle = playerCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rectangle.left) * CONFIG.CANVAS_WIDTH / rectangle.width,
    y: (event.clientY - rectangle.top) * CONFIG.CANVAS_HEIGHT / rectangle.height,
    inside: event.clientX >= rectangle.left && event.clientX < rectangle.right
      && event.clientY >= rectangle.top && event.clientY < rectangle.bottom
  };
}

function snap(value) { return Math.floor(value / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2; }

function updateTowerDrag(event) {
  if (!towerDrag || towerDrag.pointerId !== event.pointerId) return;
  towerDrag.active ||= Math.hypot(event.clientX - towerDrag.startX, event.clientY - towerDrag.startY) >= 6;
  if (!towerDrag.active) return;
  const point = pointerPoint(event);
  towerDrag.x = snap(point.x - towerDrag.offsetX);
  towerDrag.y = snap(point.y - towerDrag.offsetY);
  towerDrag.target = point.inside ? (towerAtPoint(state.player, point.x, point.y, towerDrag.source)
    || towerAtPoint(state.player, towerDrag.x, towerDrag.y, towerDrag.source)) : null;
  towerDrag.result = point.inside
    ? towerDropResult(state.player, towerDrag.source, towerDrag.x, towerDrag.y, towerDrag.target) : 'outside';
  setTip(2, towerDrag.result === 'move' ? 'Loslassen, um die Figur hierhin zu verschieben.'
    : towerDrag.result === 'merge' ? 'Loslassen, um die Figuren zu verschmelzen.'
      : 'Hier kann die Figur nicht abgelegt werden.');
  updateTowerSelection();
}

function cancelTowerDrag() {
  const pointerId = towerDrag?.pointerId;
  towerDrag = null;
  playerCanvas.classList.remove('is-dragging-tower');
  if (pointerId !== undefined && playerCanvas.hasPointerCapture(pointerId)) playerCanvas.releasePointerCapture(pointerId);
  updateTowerSelection();
}

async function requestRoundReady() {
  window.clearTimeout(autoReadyTimer);
  if (readyState.you || ['spawning', 'clearing'].includes(state.roundStatus) || state.result) return;
  if (state.currentRound === 0 && !firstRoundGateChecked) {
    if (firstRoundPending) return;
    firstRoundPending = true;
    if (firstRoundTour) firstRoundTour.start(firstRoundSteps, () => {
      firstRoundPending = false;
      firstRoundGateChecked = true;
      requestRoundReady();
    });
    else { firstRoundPending = false; firstRoundGateChecked = true; requestRoundReady(); }
    return;
  }
  const data = await sendAction('ready_round');
  if (data) showStatus(data.ready?.opponent ? 'Beide Spieler sind bereit. Runde startet …' : 'Bereit – warte auf deinen Gegner.');
}

function frame(now) {
  const frameDelta = Math.min((now - lastFrameTime) / 1000, CONFIG.MAX_FRAME_DELTA); lastFrameTime = now; accumulator += frameDelta;
  while (accumulator >= CONFIG.FIXED_STEP) { engine.update(CONFIG.FIXED_STEP); accumulator -= CONFIG.FIXED_STEP; }
  renderSide(playerContext, state.player, true); renderSide(opponentContext, state.enemy, false);
  animationFrame = window.requestAnimationFrame(frame);
}

towerButtons.forEach((button) => button.addEventListener('click', () => selectTower(button.dataset.tower)));
balloonButtons.forEach((button) => button.addEventListener('click', () => {
  const type = button.dataset.balloon;
  if (button.disabled) return;
  sendAction('send', { balloon: type }).then((data) => {
    if (data) showStatus(`${button.querySelector('strong').textContent}: ${sendBatchSize(state.currentRound, type)} Ballons wurden zum Gegner gesendet.`);
  });
}));
startRoundButton.addEventListener('click', requestRoundReady);
pauseButton.addEventListener('click', () => sendAction('pause', { paused: state.paused ? '0' : '1' }));
autoStartInput.addEventListener('change', updateInterface);
removeTowerButton.addEventListener('click', () => {
  if (removeTowerButton.disabled || !selectedTower || !state.player.towers.includes(selectedTower)) return;
  cancelTowerDrag();
  pendingRemoval = selectedTower;
  removeDialog.showModal();
  updateTowerSelection();
  cancelRemoveButton.focus();
});
cancelRemoveButton.addEventListener('click', () => removeDialog.close());
removeDialog.addEventListener('cancel', (event) => {
  if (confirmRemoveButton.disabled) event.preventDefault();
});
removeDialog.addEventListener('close', () => {
  pendingRemoval = null;
  updateTowerSelection();
  if (selectedTower) removeTowerButton.focus({ preventScroll: true });
});
confirmRemoveButton.addEventListener('click', async () => {
  const source = state.player.towers.indexOf(pendingRemoval);
  if (source < 0 || !online || state.paused || state.result) {
    removeDialog.close();
    return;
  }
  confirmRemoveButton.disabled = true;
  cancelRemoveButton.disabled = true;
  const data = await sendAction('remove', { source: String(source) });
  confirmRemoveButton.disabled = false;
  cancelRemoveButton.disabled = false;
  removeDialog.close();
  if (data) { selectedTower = null; updateTowerSelection(); }
});
rematchButton.addEventListener('click', () => leaveFinishedMatch('multiplayer.php?rematch=1'));
resultMenuButton.addEventListener('click', () => leaveFinishedMatch('game.php'));
resultHistoryLink.addEventListener('click', (event) => { event.preventDefault(); leaveFinishedMatch(resultHistoryLink.href); });
playerCanvas.addEventListener('pointermove', (event) => {
  updatePointer(event);
  if (towerDrag) { updateTowerDrag(event); return; }
  const point = pointerPoint(event);
  hoveredTower = !state.selectedTowerType && assetsReady && online && !state.paused
    ? towerAtPoint(state.player, point.x, point.y) : null;
  playerCanvas.classList.toggle('has-hovered-tower', Boolean(hoveredTower));
  updateTowerSelection();
});
playerCanvas.addEventListener('pointerleave', () => {
  mousePosition.onCanvas = false; hoveredTower = null;
  playerCanvas.classList.remove('has-hovered-tower');
  updateTowerSelection();
});
playerCanvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.isPrimary === false || !assetsReady || !online || state.paused || state.result || removeDialog.open) return;
  event.preventDefault(); updatePointer(event);
  playerCanvas.focus({ preventScroll: true });
  if (state.selectedTowerType) { placeTower(); return; }
  const point = pointerPoint(event);
  const source = towerAtPoint(state.player, point.x, point.y);
  if (!source) { selectedTower = null; hoveredTower = null; updateTowerSelection(); return; }
  const previousSelected = selectedTower;
  selectedTower = source;
  hoveredTower = null;
  towerDrag = {
    source, previousSelected, pointerId: event.pointerId,
    startX: event.clientX, startY: event.clientY,
    offsetX: point.x - source.x, offsetY: point.y - source.y,
    x: source.x, y: source.y, target: null, active: false, result: 'move'
  };
  playerCanvas.classList.add('is-dragging-tower');
  playerCanvas.setPointerCapture(event.pointerId);
  setTip(2, `${CONFIG.TOWERS[source.type].name} · Stufe ${source.level} ausgewählt. Ziehen zum Verschieben oder Verschmelzen.`);
  updateTowerSelection();
});
playerCanvas.addEventListener('pointerup', (event) => {
  if (!towerDrag || towerDrag.pointerId !== event.pointerId) return;
  updateTowerDrag(event);
  const drag = towerDrag;
  const sourceIndex = state.player.towers.indexOf(drag.source);
  if (drag.active && sourceIndex >= 0) {
    if (drag.result === 'move') {
      sendAction('move', { source: String(sourceIndex), x: String(drag.x), y: String(drag.y) })
        .then((data) => { if (data) setTip(1, 'Figur verschoben.'); });
    } else if (drag.result === 'merge') {
      sendAction('merge', { source: String(sourceIndex), target: String(state.player.towers.indexOf(drag.target)) })
        .then((data) => { if (data) setTip(1, 'Figuren verschmolzen.'); });
    } else setTip(1, 'Ungültiger Platz. Die Figur bleibt an ihrer bisherigen Position.');
  } else if (!drag.active && drag.previousSelected && drag.previousSelected !== drag.source
    && canMergeTowers(drag.previousSelected, drag.source)) {
    sendAction('merge', {
      source: String(state.player.towers.indexOf(drag.previousSelected)), target: String(sourceIndex)
    }).then((data) => { if (data) setTip(1, 'Figuren verschmolzen.'); });
  }
  cancelTowerDrag();
});
for (const eventName of ['pointercancel', 'lostpointercapture']) {
  playerCanvas.addEventListener(eventName, (event) => {
    if (towerDrag?.pointerId === event.pointerId) cancelTowerDrag();
  });
}
playerCanvas.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !state.selectedTowerType && selectedTower) {
    event.preventDefault(); selectedTower = null; updateTowerSelection(); return;
  }
  if (!state.selectedTowerType) return;
  const movement = { ArrowLeft: [-CONFIG.GRID_SIZE, 0], ArrowRight: [CONFIG.GRID_SIZE, 0], ArrowUp: [0, -CONFIG.GRID_SIZE], ArrowDown: [0, CONFIG.GRID_SIZE] }[event.key];
  if (movement) {
    event.preventDefault(); mousePosition.onCanvas = false;
    state.buildCursor.x = Math.max(4, Math.min(CONFIG.CANVAS_WIDTH - 4, state.buildCursor.x + movement[0])); state.buildCursor.y = Math.max(4, Math.min(CONFIG.CANVAS_HEIGHT - 4, state.buildCursor.y + movement[1])); state.buildCursor.active = true;
  } else if (event.key === 'Enter') { event.preventDefault(); placeTower(state.buildCursor.x, state.buildCursor.y); }
  else if (event.key === 'Escape') { event.preventDefault(); selectedTower = null; clearSelection(); }
});

document.addEventListener('visibilitychange', () => {
  lastFrameTime = performance.now(); accumulator = 0;
  if (document.hidden) cancelTowerDrag();
  else poll();
});

async function initialize() {
  const images = requiredAssets(); let loaded = 0;
  try {
    await Promise.all(images.map((image) => whenImageReady(image).then(() => { loaded += 1; loadingStatus.textContent = `Spielgrafiken werden geladen: ${loaded}/${images.length}`; })));
    assetsReady = true; loadingStatus.hidden = true; renderTowerPortraits(); renderBalloonPortraits(); updateInterface();
    await poll(); frame(performance.now()); window.setInterval(poll, 450);
    snapshotTimer = window.setInterval(sendSnapshot, 2000);
  } catch (error) { loadingStatus.textContent = `Spiel konnte nicht geladen werden: ${error.message}`; loadingStatus.classList.add('is-error'); }
}

window.addEventListener('pagehide', () => {
  window.cancelAnimationFrame(animationFrame); window.clearTimeout(autoReadyTimer); window.clearInterval(snapshotTimer);
  if (!assetsReady || !navigator.sendBeacon) return;
  const body = new URLSearchParams({ action: 'snapshot', action_id: actionId(), csrf_token: csrfToken, match_id: String(matchId), after: String(lastEventId), snapshot: JSON.stringify(engine.exportSnapshot(lastEventId)) });
  navigator.sendBeacon(gameApi, body);
});
updateInterface(); initialize();
