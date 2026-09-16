<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();
require __DIR__ . '/db.php';
require_once __DIR__ . '/account-security.php';
require_once __DIR__ . '/matchmaking.php';

ensure_matchmaking_tables($pdo);
$userId = (int) $_SESSION['user_id'];
$statement = $pdo->prepare('SELECT username FROM users WHERE id = ? LIMIT 1');
$statement->execute([$userId]);
$user = $statement->fetch();

if ($user === false) {
    destroy_session();
    header('Location: login.php');
    exit;
}

$initialStatus = matchmaking_status($pdo, $userId, true);
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Online-Lobby – 99 Luftballons</title>
    <link rel="stylesheet" href="style.css?v=multiplayer-lobby-1">
    <script src="theme.js?v=camp-1"></script>
</head>
<body>
    <?php require __DIR__ . '/site-header.php'; ?>
    <main id="main-content" class="portal-shell matchmaking-shell"
          data-matchmaking-api="matchmaking-api.php"
          data-csrf-token="<?= htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') ?>"
          data-initial-status="<?= htmlspecialchars(json_encode($initialStatus, JSON_THROW_ON_ERROR), ENT_QUOTES, 'UTF-8') ?>">
        <header class="page-heading">
            <p class="eyebrow">Online-Duell</p>
            <h1>Finde deinen Gegner</h1>
            <p class="card-intro">Hallo <?= htmlspecialchars((string) $user['username'], ENT_QUOTES, 'UTF-8') ?>! Sobald ein zweiter Spieler sucht, werdet ihr automatisch verbunden.</p>
        </header>
        <section class="matchmaking-card" aria-labelledby="matchmaking-title">
            <div class="matchmaking-visual" aria-hidden="true">
                <span class="matchmaking-player">DU</span>
                <span class="matchmaking-path"><i></i><i></i><i></i></span>
                <span class="matchmaking-player matchmaking-player--opponent">?</span>
            </div>
            <div class="matchmaking-copy">
                <p class="eyebrow" id="matchmaking-kicker">Warteschlange</p>
                <h2 id="matchmaking-title">Bereit zur Gegnersuche?</h2>
                <p id="matchmaking-message" aria-live="polite">Du kannst die Suche jederzeit wieder verlassen.</p>
                <div class="queue-status" id="queue-status" hidden>
                    <span class="queue-spinner" aria-hidden="true"></span>
                    <span>Suche läuft</span>
                    <strong id="queue-timer">00:00</strong>
                </div>
                <div class="match-found" id="match-found" hidden>
                    <span>Dein Gegner</span>
                    <strong id="opponent-name">–</strong>
                    <small id="match-number"></small>
                </div>
                <div class="button-row matchmaking-actions">
                    <button class="primary-button" id="join-queue" type="button">Gegner suchen</button>
                    <button class="secondary-link" id="leave-queue" type="button" hidden>Suche verlassen</button>
                    <a class="secondary-link" href="game.php">Spielmodus wechseln</a>
                </div>
                <p class="matchmaking-note">Das Matchmaking ist bereits funktionsfähig. Das eigentliche Live-Duell wird im nächsten Paket angeschlossen.</p>
            </div>
        </section>
    </main>
    <?php require __DIR__ . '/site-footer.php'; ?>
    <script src="matchmaking.js?v=matchmaking-1"></script>
</body>
</html>
