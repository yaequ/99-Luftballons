(() => {
    'use strict';

    const shell = document.querySelector('.multiplayer-match-shell');
    if (!shell) return;

    const apiUrl = shell.dataset.matchmakingApi;
    const csrfToken = shell.dataset.csrfToken;
    const matchId = Number(shell.dataset.matchId);
    const leaveButton = document.getElementById('leave-online-match');
    const homeLink = document.getElementById('leave-to-home');
    const connectionStatus = document.getElementById('connection-status');
    const connectionLabel = document.getElementById('connection-label');
    const feedback = document.getElementById('action-feedback');
    const startRoundButton = document.getElementById('start-online-round');
    const towerButtons = [...document.querySelectorAll('.mp-tower-choice')];
    const balloonButtons = [...document.querySelectorAll('.mp-balloon-choice')];
    const buildSlots = [...document.querySelectorAll('[data-map-side="you"] .mp-build-slot')];
    const towerAssets = JSON.parse(document.getElementById('multiplayer-assets').textContent).towers;
    let pollTimer = 0;
    let actionPending = false;
    let selectedTower = '';
    let latestState = null;

    function updateHealth(prefix, value) {
        const health = Math.max(0, Math.min(99, Number(value) || 0));
        document.getElementById(`${prefix}-hp`).textContent = `${health} / 99`;
        const meter = document.getElementById(`${prefix}-health`);
        meter.setAttribute('aria-valuenow', String(health));
        meter.querySelector('i').style.width = `${health / 99 * 100}%`;
    }

    function renderTowers(owner, towers) {
        const overlay = document.querySelector(`[data-map-side="${owner}"] .mp-map-overlay`);
        overlay.querySelectorAll('.mp-tower-marker').forEach((marker) => marker.remove());
        towers.forEach((tower) => {
            const slot = overlay.querySelector(`[data-slot="${tower.slot}"]`);
            if (!slot || !towerAssets[tower.type]) return;
            if (owner === 'you') slot.classList.add('is-occupied');
            const marker = document.createElement('img');
            marker.className = 'mp-tower-marker';
            marker.src = towerAssets[tower.type];
            marker.alt = '';
            marker.style.setProperty('--slot-x', slot.style.getPropertyValue('--slot-x'));
            marker.style.setProperty('--slot-y', slot.style.getPropertyValue('--slot-y'));
            marker.style.setProperty('--slot-w', slot.style.getPropertyValue('--slot-w'));
            marker.style.setProperty('--slot-h', slot.style.getPropertyValue('--slot-h'));
            overlay.append(marker);
        });
    }

    function updateControls(gameState) {
        const locked = actionPending || Boolean(gameState.ready.you) || Boolean(gameState.finished);
        towerButtons.forEach((button) => {
            button.disabled = locked || Number(button.dataset.cost) > gameState.you.gold;
        });
        balloonButtons.forEach((button) => {
            button.disabled = locked || Number(button.dataset.cost) > gameState.you.gold;
        });
        buildSlots.forEach((slot) => {
            slot.disabled = locked || slot.classList.contains('is-occupied');
        });
        startRoundButton.disabled = actionPending || Boolean(gameState.ready.you) || Boolean(gameState.finished);
        startRoundButton.textContent = gameState.finished
            ? (gameState.result === 'win' ? 'Du hast gewonnen!' : gameState.result === 'loss' ? 'Gegner gewinnt' : 'Unentschieden')
            : gameState.ready.you
            ? (gameState.ready.opponent ? 'Runde wird ausgewertet …' : 'Warte auf Gegner …')
            : `Runde ${gameState.round + 1} bereit`;
    }

    function applyGameState(gameState) {
        if (!gameState) return;
        latestState = gameState;
        document.getElementById('match-round').textContent = `${gameState.round}/${gameState.total_rounds}`;
        document.getElementById('your-gold').textContent = gameState.you.gold;
        document.getElementById('your-income').textContent = `+${gameState.you.income} Gold/s`;
        updateHealth('your', gameState.you.hp);
        document.getElementById('opponent-gold').textContent = gameState.opponent.gold;
        document.getElementById('opponent-income').textContent = `+${gameState.opponent.income} Gold/s`;
        updateHealth('opponent', gameState.opponent.hp);
        renderTowers('you', gameState.towers.you);
        renderTowers('opponent', gameState.towers.opponent);
        document.getElementById('outgoing-attacks').textContent = Object.values(gameState.attacks.you).reduce((sum, count) => sum + Number(count), 0);
        const events = document.getElementById('match-events');
        events.replaceChildren(...(gameState.events.length ? gameState.events : ['Noch keine Aktion ausgeführt.']).map((message) => {
            const item = document.createElement('li');
            item.textContent = message;
            return item;
        }));
        updateControls(gameState);
    }

    async function requestAction(action, values = {}) {
        if (actionPending) return;
        actionPending = true;
        feedback.classList.remove('is-error');
        feedback.textContent = 'Aktion wird synchronisiert …';
        if (latestState) updateControls(latestState);
        const body = new URLSearchParams({ action, csrf_token: csrfToken, ...values });
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json' },
                body,
                credentials: 'same-origin'
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Die Aktion konnte nicht ausgeführt werden.');
            applyGameState(result.game_state);
            feedback.textContent = action === 'start_round' ? 'Bereit gemeldet.' : 'Aktion synchronisiert.';
        } catch (error) {
            feedback.classList.add('is-error');
            feedback.textContent = error.message;
        } finally {
            actionPending = false;
            if (latestState) updateControls(latestState);
        }
    }

    towerButtons.forEach((button) => button.addEventListener('click', () => {
        selectedTower = button.dataset.tower;
        towerButtons.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
        document.getElementById('build-help').textContent = `${button.querySelector('strong').textContent} ausgewählt – jetzt einen freien Bauplatz anklicken.`;
        document.querySelector('[data-map-side="you"] .mp-map-overlay').classList.add('is-building');
    }));

    buildSlots.forEach((slot) => slot.addEventListener('click', () => {
        if (!selectedTower) {
            feedback.classList.add('is-error');
            feedback.textContent = 'Wähle zuerst einen Turm aus.';
            return;
        }
        requestAction('build_tower', { tower_type: selectedTower, slot: slot.dataset.slot });
    }));

    balloonButtons.forEach((button) => button.addEventListener('click', () => {
        requestAction('send_balloons', { balloon_type: button.dataset.balloon });
    }));
    startRoundButton.addEventListener('click', () => requestAction('start_round'));

    async function poll() {
        try {
            const response = await fetch(apiUrl, { headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
            const status = await response.json();
            if (!response.ok) throw new Error();
            if (!['starting', 'active'].includes(status.state) || Number(status.match_id) !== matchId) {
                window.location.replace('multiplayer.php');
                return;
            }
            connectionStatus.classList.remove('is-offline');
            connectionLabel.textContent = 'Verbindung aktiv';
            applyGameState(status.game_state);
        } catch {
            connectionStatus.classList.add('is-offline');
            connectionLabel.textContent = 'Verbindung wird wiederhergestellt …';
        }
        pollTimer = window.setTimeout(poll, 1500);
    }

    async function leaveMatch(destination) {
        leaveButton.disabled = true;
        homeLink.setAttribute('aria-disabled', 'true');
        const body = new URLSearchParams({ action: 'leave', csrf_token: csrfToken });
        try {
            await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body,
                credentials: 'same-origin'
            });
        } finally {
            window.location.assign(destination);
        }
    }

    leaveButton.addEventListener('click', () => leaveMatch('game.php'));
    homeLink.addEventListener('click', (event) => {
        event.preventDefault();
        leaveMatch(homeLink.href);
    });

    window.addEventListener('pagehide', () => window.clearTimeout(pollTimer));
    poll();
})();
