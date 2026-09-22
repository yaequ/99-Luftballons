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
    const localEngine = shell.dataset.localEngine === 'true';
    let pollTimer = 0;

    function updateHealth(prefix, value) {
        const health = Math.max(0, Math.min(99, Number(value) || 0));
        document.getElementById(`${prefix}-hp`).textContent = `${health} / 99`;
        const meter = document.getElementById(`${prefix}-health`);
        meter.setAttribute('aria-valuenow', String(health));
        meter.querySelector('i').style.width = `${health / 99 * 100}%`;
    }

    function applyGameState(gameState) {
        if (!gameState) return;
        document.getElementById('match-round').textContent = `${gameState.round}/${gameState.total_rounds}`;
        document.getElementById('your-gold').textContent = gameState.you.gold;
        document.getElementById('your-income').textContent = `+${gameState.you.income} Gold/s`;
        updateHealth('your', gameState.you.hp);
        document.getElementById('opponent-gold').textContent = gameState.opponent.gold;
        document.getElementById('opponent-income').textContent = `+${gameState.opponent.income} Gold/s`;
        updateHealth('opponent', gameState.opponent.hp);
    }

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
            if (!localEngine) applyGameState(status.game_state);
            window.dispatchEvent(new CustomEvent('multiplayer:status', { detail: status }));
        } catch {
            connectionStatus.classList.add('is-offline');
            connectionLabel.textContent = 'Verbindung wird wiederhergestellt …';
        }
        pollTimer = window.setTimeout(poll, 2000);
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
