import { CONFIG } from '../game/modules/config.js';
import { ASSETS, whenImageReady } from '../game/modules/assets.js';
import { MAP_DATA } from '../game/modules/maps.js';
import { createRenderer } from '../game/modules/renderer.js';
import { canBuildAt } from '../game/modules/building.js';
import { createMultiplayerEngine } from './engine.js';

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

const engine = createMultiplayerEngine(playerMap, opponentMap, {
  ownSide,
  onChange: updateInterface,
  onRoundComplete: (round) => {
    showStatus(`Runde ${round} geschafft. Beide Spieler können die nächste Runde freigeben.`);
    if (autoStartInput.checked) autoReadyTimer = window.setTimeout(requestRoundReady, 1800);
  },
  onGameOver: (result) => showStatus(result === 'win'
    ? 'Sieg! Die gegnerische Basis ist gefallen.'
    : result === 'loss' ? 'Niederlage: Deine Basis ist gefallen.' : 'Alle 30 Runden geschafft.')
});
const state = engine.state;
const { renderSide, renderTowerPortraits, renderBalloonPortraits } = createRenderer(() => state, mousePosition);
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
  const images = [state.player.map.image, state.enemy.map.image, ...Object.values(ASSETS.characters).flat(), ...Object.values(ASSETS.balloons).flat(), ASSETS.boss];
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
  document.getElementById('your-income').textContent = `+${state.player.income} Gold/s`;
  document.getElementById('opponent-gold').textContent = String(Math.floor(state.enemy.gold));
  document.getElementById('opponent-income').textContent = `+${state.enemy.income} Gold/s`;
  document.getElementById('match-round').textContent = `${state.currentRound}/${CONFIG.WAVES}`;
  document.getElementById('multiplayer-round-state').textContent = !online ? 'Verbindung wird wiederhergestellt …'
    : state.paused ? 'Online-Match pausiert'
      : ['spawning', 'clearing'].includes(state.roundStatus) ? `${state.remainingEnemies} Ballons auf deiner Karte`
        : readyState.you ? 'Warte auf die Freigabe des Gegners' : 'Beide Spieler müssen bereit sein';
  updateHealth('your', state.player.hp); updateHealth('opponent', state.enemy.hp);
  towerButtons.forEach((button) => {
    const selected = button.dataset.tower === state.selectedTowerType;
    button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected));
    button.disabled = !assetsReady || !online || Boolean(state.result) || state.player.gold < CONFIG.TOWERS[button.dataset.tower].cost;
  });
  balloonButtons.forEach((button) => { button.disabled = !assetsReady || !online || !state.active || state.paused || Boolean(state.result) || state.player.gold < CONFIG.BALLOONS[button.dataset.balloon].cost; });
  startRoundButton.disabled = !assetsReady || !online || state.paused || Boolean(state.result) || ['spawning', 'clearing'].includes(state.roundStatus) || readyState.you || state.currentRound >= CONFIG.WAVES;
  startRoundButton.textContent = roundButtonLabel();
  pauseButton.disabled = !online || !state.active || Boolean(state.result);
  pauseButton.textContent = state.paused ? 'Fortsetzen' : 'Pausieren'; pauseButton.setAttribute('aria-pressed', String(state.paused));
}

function showStatus(message) { localStatus.textContent = message; }
function setTip(step, text) { mapTip.querySelector('b').textContent = String(step); mapTip.querySelector('span').textContent = text; }

function selectTower(type) {
  if (!assetsReady || state.result) return;
  state.selectedTowerType = state.selectedTowerType === type ? null : type;
  state.buildCursor.active = Boolean(state.selectedTowerType); updateInterface();
  if (state.selectedTowerType) { setTip(2, `${CONFIG.TOWERS[type].name} auf einer dunklen Baufläche platzieren.`); playerCanvas.focus(); }
  else setTip(1, 'Turm auswählen und auf einer dunklen Baufläche platzieren.');
}

function clearSelection() {
  state.selectedTowerType = null; state.buildCursor.active = false; updateInterface();
  setTip(1, 'Turm auswählen und auf einer dunklen Baufläche platzieren.');
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
  else if (event.type === 'send') engine.sendBalloonFor(owner, event.payload.balloon, true);
  else if (event.type === 'round_start') {
    readyState = { you: false, opponent: false };
    engine.startRound(Number(event.payload.seed));
    showStatus(`Runde ${event.payload.round} wurde gemeinsam gestartet.`);
  } else if (event.type === 'pause') engine.setPaused(Boolean(event.payload.paused));
  lastEventId = Math.max(lastEventId, Number(event.id));
}

function applyResponse(data) {
  (data.events || []).forEach(applyEvent);
  if (data.ready) readyState = data.ready;
  online = true; updateInterface();
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
  catch (error) { online = false; updateInterface(); showStatus(`Synchronisierung fehlgeschlagen: ${error.message}`); return null; }
}

async function poll() {
  if (document.hidden || requestRunning) return;
  try { await apiRequest(); }
  catch (error) { online = false; updateInterface(); showStatus('Verbindung unterbrochen – automatischer neuer Versuch läuft.'); }
}

function placeTower(x = mousePosition.x, y = mousePosition.y) {
  const type = state.selectedTowerType;
  if (!type || !assetsReady) return;
  const localCheck = canBuildAt(state.player, type, x, y);
  if (localCheck !== true) { setTip(2, placementMessage(localCheck, type)); return; }
  sendAction('build', { tower: type, x: String(x), y: String(y) }).then((data) => {
    if (data) { clearSelection(); setTip('✓', `${CONFIG.TOWERS[type].name} wurde bei beiden Spielern platziert.`); }
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
balloonButtons.forEach((button) => button.addEventListener('click', () => sendAction('send', { balloon: button.dataset.balloon }).then((data) => { if (data) showStatus(`${button.querySelector('strong').textContent}: 10 Ballons wurden zum Gegner gesendet.`); })));
startRoundButton.addEventListener('click', requestRoundReady);
pauseButton.addEventListener('click', () => sendAction('pause', { paused: state.paused ? '0' : '1' }));
autoStartInput.addEventListener('change', updateInterface);
playerCanvas.addEventListener('pointermove', updatePointer);
playerCanvas.addEventListener('pointerleave', () => { mousePosition.onCanvas = false; });
playerCanvas.addEventListener('pointerdown', (event) => { event.preventDefault(); updatePointer(event); placeTower(); });
playerCanvas.addEventListener('keydown', (event) => {
  if (!state.selectedTowerType) return;
  const movement = { ArrowLeft: [-CONFIG.GRID_SIZE, 0], ArrowRight: [CONFIG.GRID_SIZE, 0], ArrowUp: [0, -CONFIG.GRID_SIZE], ArrowDown: [0, CONFIG.GRID_SIZE] }[event.key];
  if (movement) {
    event.preventDefault(); state.buildCursor.x = Math.max(4, Math.min(CONFIG.CANVAS_WIDTH - 4, state.buildCursor.x + movement[0])); state.buildCursor.y = Math.max(4, Math.min(CONFIG.CANVAS_HEIGHT - 4, state.buildCursor.y + movement[1])); state.buildCursor.active = true;
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
  } catch (error) { loadingStatus.textContent = `Spiel konnte nicht geladen werden: ${error.message}`; loadingStatus.classList.add('is-error'); }
}

window.addEventListener('pagehide', () => { window.cancelAnimationFrame(animationFrame); window.clearTimeout(autoReadyTimer); });
updateInterface(); initialize();
