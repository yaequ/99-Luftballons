import { CONFIG } from '../game/modules/ai-config.js';
import { ASSETS, whenImageReady } from '../game/modules/ai-assets.js';
import { MAP_DATA } from '../game/modules/maps.js';
import { createRenderer } from '../game/modules/ai-renderer.js';
import { canBuildAt } from '../game/modules/ai-building.js';
import { towerAtPoint, canMergeTowers } from '../game/modules/towers.js';
import { sendBatchSize, isSendUnlocked } from '../game/modules/sending.js';
import { createMultiplayerEngine } from './engine.js?v=multiplayer-upgrades-1';

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
let selectedMergeSource = null;
let mergeDragStart = null;

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
  const type = state.selectedTowerType;
  const point = mousePosition.onCanvas ? mousePosition : state.buildCursor.active ? state.buildCursor : null;
  if (!type || !point) return {};
  const target = towerAtPoint(state.player, point.x, point.y);
  const result = target
    ? (canMergeTowers({ type, level: 1 }, target) && state.player.gold >= CONFIG.TOWERS[type].cost ? 'merge' : 'incompatible')
    : (canBuildAt(state.player, type, point.x, point.y,
      state.player.freeBuildsRemaining > 0 && state.currentRound === 0) === true ? 'build' : 'zone');
  return { placement: { type, x: point.x, y: point.y, target, result } };
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

function updateInterface() {
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
    button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected));
    button.disabled = !assetsReady || !online || Boolean(state.result)
      || (state.player.freeBuildsRemaining === 0 && state.player.gold < CONFIG.TOWERS[button.dataset.tower].cost);
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
  selectedMergeSource = null;
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
  else if (event.type === 'merge') engine.mergeTowerFor(owner, Number(event.payload.source), Number(event.payload.target), Boolean(event.payload.purchased));
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
  if (!assetsReady || !online || state.result) return;
  const target = towerAtPoint(state.player, x, y);
  if (!type) {
    if (!target) { selectedMergeSource = null; return; }
    const targetIndex = state.player.towers.indexOf(target);
    if (selectedMergeSource === null) {
      selectedMergeSource = targetIndex;
      setTip(2, `${CONFIG.TOWERS[target.type].name} Stufe ${target.level} gewählt. Gleichstufigen Turm zum Verschmelzen anklicken.`);
    } else {
      const source = state.player.towers[selectedMergeSource];
      if (source && canMergeTowers(source, target)) sendAction('merge', { source: String(selectedMergeSource), target: String(targetIndex) })
        .then((data) => { if (data) { selectedMergeSource = null; clearSelection(); } });
      else { selectedMergeSource = targetIndex; setTip(2, 'Diese Türme passen nicht zusammen. Anderen gleichstufigen Turm wählen.'); }
    }
    return;
  }
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
    if (data) clearSelection();
  });
}

function updatePointer(event) {
  const rectangle = playerCanvas.getBoundingClientRect();
  mousePosition.x = Math.floor((((event.clientX - rectangle.left) * CONFIG.CANVAS_WIDTH / rectangle.width) / CONFIG.GRID_SIZE)) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
  mousePosition.y = Math.floor((((event.clientY - rectangle.top) * CONFIG.CANVAS_HEIGHT / rectangle.height) / CONFIG.GRID_SIZE)) * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
  mousePosition.onCanvas = true;
}

async function requestRoundReady() {
  window.clearTimeout(autoReadyTimer);
  if (readyState.you || ['spawning', 'clearing'].includes(state.roundStatus) || state.result) return;
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
rematchButton.addEventListener('click', () => leaveFinishedMatch('multiplayer.php?rematch=1'));
resultMenuButton.addEventListener('click', () => leaveFinishedMatch('game.php'));
resultHistoryLink.addEventListener('click', (event) => { event.preventDefault(); leaveFinishedMatch(resultHistoryLink.href); });
playerCanvas.addEventListener('pointermove', updatePointer);
playerCanvas.addEventListener('pointerleave', () => { mousePosition.onCanvas = false; });
playerCanvas.addEventListener('pointerdown', (event) => {
  event.preventDefault(); updatePointer(event);
  mergeDragStart = !state.selectedTowerType && towerAtPoint(state.player, mousePosition.x, mousePosition.y)
    ? { x: mousePosition.x, y: mousePosition.y } : null;
  placeTower();
});
playerCanvas.addEventListener('pointerup', (event) => {
  if (!mergeDragStart) return;
  updatePointer(event);
  if (Math.hypot(mousePosition.x - mergeDragStart.x, mousePosition.y - mergeDragStart.y) >= CONFIG.GRID_SIZE) placeTower();
  mergeDragStart = null;
});
playerCanvas.addEventListener('keydown', (event) => {
  if (!state.selectedTowerType) return;
  const movement = { ArrowLeft: [-CONFIG.GRID_SIZE, 0], ArrowRight: [CONFIG.GRID_SIZE, 0], ArrowUp: [0, -CONFIG.GRID_SIZE], ArrowDown: [0, CONFIG.GRID_SIZE] }[event.key];
  if (movement) {
    event.preventDefault(); mousePosition.onCanvas = false;
    state.buildCursor.x = Math.max(4, Math.min(CONFIG.CANVAS_WIDTH - 4, state.buildCursor.x + movement[0])); state.buildCursor.y = Math.max(4, Math.min(CONFIG.CANVAS_HEIGHT - 4, state.buildCursor.y + movement[1])); state.buildCursor.active = true;
  } else if (event.key === 'Enter') { event.preventDefault(); placeTower(state.buildCursor.x, state.buildCursor.y); }
  else if (event.key === 'Escape') { event.preventDefault(); clearSelection(); }
});

document.addEventListener('visibilitychange', () => { lastFrameTime = performance.now(); accumulator = 0; if (!document.hidden) poll(); });

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
