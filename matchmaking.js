(() => {
    'use strict';

    const shell = document.querySelector('.matchmaking-shell');
    if (!shell) return;

    const apiUrl = shell.dataset.matchmakingApi;
    const csrfToken = shell.dataset.csrfToken;
    const joinButton = document.getElementById('join-queue');
    const leaveButton = document.getElementById('leave-queue');
    const kicker = document.getElementById('matchmaking-kicker');
    const title = document.getElementById('matchmaking-title');
    const message = document.getElementById('matchmaking-message');
    const queueStatus = document.getElementById('queue-status');
    const queueTimer = document.getElementById('queue-timer');
    const matchFound = document.getElementById('match-found');
    const opponentName = document.getElementById('opponent-name');
    const matchNumber = document.getElementById('match-number');
    let state = 'idle';
    let joinedAt = null;
    let pollTimer = 0;

    function parseInitialStatus() {
        try {
            return JSON.parse(shell.dataset.initialStatus || '{"state":"idle"}');
        } catch {
            return { state: 'idle' };
        }
    }

    function setBusy(busy) {
        joinButton.disabled = busy;
        leaveButton.disabled = busy;
    }

    function stopPolling() {
        window.clearTimeout(pollTimer);
        pollTimer = 0;
    }

    function startPolling() {
        stopPolling();
        pollTimer = window.setTimeout(refreshStatus, 2000);
    }

    function updateTimer() {
        if (!joinedAt || state !== 'waiting') {
            queueTimer.textContent = '00:00';
            return;
        }
        const elapsed = Math.max(0, Math.floor((Date.now() - joinedAt.getTime()) / 1000));
        const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const seconds = String(elapsed % 60).padStart(2, '0');
        queueTimer.textContent = `${minutes}:${seconds}`;
    }

    function render(status) {
        const previousState = state;
        state = status.state || 'idle';
        shell.dataset.queueState = state;
        queueStatus.hidden = state !== 'waiting';
        matchFound.hidden = state !== 'matched';
        joinButton.hidden = state !== 'idle';
        leaveButton.hidden = state === 'idle';

        if (state === 'waiting') {
            kicker.textContent = 'Spielersuche aktiv';
            title.textContent = 'Wir suchen einen Gegner …';
            message.textContent = 'Bleib auf dieser Seite. Sobald jemand verfügbar ist, wird euer Match automatisch erstellt.';
            if (status.joined_at) joinedAt = new Date(String(status.joined_at).replace(' ', 'T'));
            if (!joinedAt || Number.isNaN(joinedAt.getTime())) joinedAt = new Date();
            updateTimer();
            startPolling();
            return;
        }

        joinedAt = null;
        if (state === 'matched') {
            kicker.textContent = 'Match gefunden';
            title.textContent = 'Ein Gegner ist bereit!';
            message.textContent = 'Die Warteschlange hat euch erfolgreich verbunden.';
            opponentName.textContent = status.opponent || 'Ballonjäger';
            matchNumber.textContent = status.match_id ? `Match #${status.match_id}` : '';
            leaveButton.textContent = 'Match verlassen';
            startPolling();
            return;
        }

        stopPolling();
        kicker.textContent = 'Warteschlange';
        title.textContent = previousState === 'matched' ? 'Das Match wurde verlassen' : 'Bereit zur Gegnersuche?';
        message.textContent = 'Du kannst die Suche jederzeit wieder verlassen.';
        leaveButton.textContent = 'Suche verlassen';
    }

    async function request(action) {
        setBusy(true);
        try {
            const body = new URLSearchParams({ action, csrf_token: csrfToken });
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body,
                credentials: 'same-origin'
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Die Anfrage ist fehlgeschlagen.');
            render(result);
        } catch (error) {
            message.textContent = error instanceof Error ? error.message : 'Die Online-Lobby ist momentan nicht erreichbar.';
        } finally {
            setBusy(false);
        }
    }

    async function refreshStatus() {
        try {
            const response = await fetch(apiUrl, { headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Status konnte nicht geladen werden.');
            render(result);
        } catch {
            message.textContent = 'Verbindung unterbrochen. Neuer Versuch läuft …';
            startPolling();
        }
    }

    joinButton.addEventListener('click', () => request('join'));
    leaveButton.addEventListener('click', () => request('leave'));
    window.setInterval(updateTimer, 1000);
    window.addEventListener('pagehide', stopPolling);
    render(parseInitialStatus());
})();
