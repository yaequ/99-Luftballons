(() => {
    'use strict';

    const shell = document.querySelector('.multiplayer-match-shell');
    if (!shell) return;

    const apiUrl = shell.dataset.matchmakingApi;
    const csrfToken = shell.dataset.csrfToken;
    const matchId = Number(shell.dataset.matchId);
    const leaveButton = document.getElementById('leave-online-match');
    const switchToAi = document.getElementById('switch-to-ai');
    const connectionStatus = document.getElementById('connection-status');
    let pollTimer = 0;

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
            connectionStatus.lastChild.textContent = ' Verbindung aktiv';
        } catch {
            connectionStatus.classList.add('is-offline');
            connectionStatus.lastChild.textContent = ' Verbindung wird wiederhergestellt …';
        }
        pollTimer = window.setTimeout(poll, 2000);
    }

    async function leaveMatch(destination) {
        leaveButton.disabled = true;
        switchToAi.setAttribute('aria-disabled', 'true');
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
    switchToAi.addEventListener('click', (event) => {
        event.preventDefault();
        leaveMatch(switchToAi.href);
    });

    window.addEventListener('pagehide', () => window.clearTimeout(pollTimer));
    poll();
})();
