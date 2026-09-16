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
    const opponentAvatar = document.getElementById('opponent-avatar');
    const matchNumber = document.getElementById('match-number');
    const readyRoom = document.getElementById('ready-room');
    const yourReadyState = document.getElementById('your-ready-state');
    const readyOpponentName = document.getElementById('ready-opponent-name');
    const opponentReadyState = document.getElementById('opponent-ready-state');
    const readyButton = document.getElementById('ready-match');
    const matchCountdown = document.getElementById('match-countdown');
    const countdownValue = document.getElementById('countdown-value');
    let state = 'idle';
    let joinedAt = null;
    let startDeadline = null;
    let redirectUrl = '';
    let redirecting = false;
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
        readyButton.disabled = busy;
        leaveButton.disabled = busy;
    }

    function stopPolling() {
        window.clearTimeout(pollTimer);
        pollTimer = 0;
    }

    function startPolling() {
        stopPolling();
        const delay = state === 'waiting' ? 2000 : 750;
        pollTimer = window.setTimeout(refreshStatus, delay);
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

    function updateCountdown() {
        if (!startDeadline || state !== 'starting') return;
        const remaining = Math.max(0, startDeadline - Date.now());
        countdownValue.textContent = String(Math.max(1, Math.ceil(remaining / 1000)));
        if (remaining === 0 && redirectUrl && !redirecting) {
            redirecting = true;
            window.location.assign(redirectUrl);
        }
    }

    function render(status) {
        const previousState = state;
        state = status.state || 'idle';
        shell.dataset.queueState = state;
        queueStatus.hidden = state !== 'waiting';
        matchFound.hidden = !['matched', 'starting'].includes(state);
        readyRoom.hidden = state !== 'matched';
        matchCountdown.hidden = state !== 'starting';
        joinButton.hidden = state !== 'idle';
        readyButton.hidden = state !== 'matched' || Boolean(status.you_ready);
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
        redirectUrl = status.redirect_url || '';
        if (status.opponent_avatar) {
            opponentAvatar.src = status.opponent_avatar;
            opponentAvatar.nextElementSibling.textContent = status.opponent || 'Gegner';
        }
        if (state === 'matched') {
            startDeadline = null;
            kicker.textContent = 'Match gefunden';
            title.textContent = 'Seid ihr beide bereit?';
            message.textContent = status.you_ready
                ? 'Du bist bereit. Wir warten noch auf deinen Gegner.'
                : 'Bestätige deine Bereitschaft. Der Countdown beginnt, sobald beide bereit sind.';
            opponentName.textContent = status.opponent || 'Ballonjäger';
            readyOpponentName.textContent = status.opponent || 'Gegner';
            yourReadyState.textContent = status.you_ready ? 'Bereit' : 'Nicht bereit';
            opponentReadyState.textContent = status.opponent_ready ? 'Bereit' : 'Nicht bereit';
            yourReadyState.classList.toggle('is-ready', Boolean(status.you_ready));
            opponentReadyState.classList.toggle('is-ready', Boolean(status.opponent_ready));
            matchNumber.textContent = status.match_id ? `Match #${status.match_id}` : '';
            leaveButton.textContent = 'Match verlassen';
            startPolling();
            return;
        }

        if (state === 'starting') {
            kicker.textContent = 'Beide Spieler sind bereit';
            title.textContent = 'Gleich geht’s los!';
            message.textContent = 'Euer gemeinsames Match wird vorbereitet.';
            opponentName.textContent = status.opponent || 'Ballonjäger';
            matchNumber.textContent = status.match_id ? `Match #${status.match_id}` : '';
            startDeadline = Date.now() + Math.max(0, Number(status.starts_in_ms) || 0);
            updateCountdown();
            startPolling();
            return;
        }

        if (state === 'active') {
            stopPolling();
            if (redirectUrl && !redirecting) {
                redirecting = true;
                window.location.assign(redirectUrl);
            }
            return;
        }

        startDeadline = null;
        stopPolling();
        kicker.textContent = 'Warteschlange';
        title.textContent = ['matched', 'starting'].includes(previousState) ? 'Das Match wurde beendet' : 'Bereit zur Gegnersuche?';
        message.textContent = status.reason === 'opponent_disconnected'
            ? 'Die Verbindung zum Gegner wurde unterbrochen. Du kannst direkt erneut suchen.'
            : 'Du kannst die Suche jederzeit wieder verlassen.';
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
    readyButton.addEventListener('click', () => request('ready'));
    leaveButton.addEventListener('click', () => request('leave'));
    window.setInterval(() => { updateTimer(); updateCountdown(); }, 250);
    window.addEventListener('pagehide', stopPolling);
    render(parseInitialStatus());
})();
