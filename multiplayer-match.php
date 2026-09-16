<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();
require __DIR__ . '/db.php';
require_once __DIR__ . '/account-security.php';
require_once __DIR__ . '/matchmaking.php';

ensure_matchmaking_tables($pdo);
$matchId = filter_input(INPUT_GET, 'match', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$status = matchmaking_status($pdo, (int) $_SESSION['user_id'], true);

if ($matchId === false || $matchId === null || (int) ($status['match_id'] ?? 0) !== $matchId || !in_array($status['state'], ['starting', 'active'], true)) {
    header('Location: multiplayer.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Online-Match – 99 Luftballons</title>
    <link rel="stylesheet" href="style.css?v=multiplayer-ready-1">
    <script src="theme.js?v=camp-1"></script>
</head>
<body>
    <?php require __DIR__ . '/site-header.php'; ?>
    <main id="main-content" class="portal-shell multiplayer-match-shell"
          data-matchmaking-api="matchmaking-api.php"
          data-csrf-token="<?= htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') ?>"
          data-match-id="<?= $matchId ?>">
        <section class="multiplayer-gate-card">
            <div class="gate-status-icon" aria-hidden="true">✓</div>
            <p class="eyebrow">Match #<?= $matchId ?> verbunden</p>
            <h1>Der Spielraum steht</h1>
            <p>Du spielst gegen <strong><?= htmlspecialchars((string) $status['opponent'], ENT_QUOTES, 'UTF-8') ?></strong>. Beide Browser sind im selben Match angekommen.</p>
            <div class="connection-status" id="connection-status"><span></span> Verbindung aktiv</div>
            <div class="message">
                <p><strong>Paket 3A ist abgeschlossen.</strong></p>
                <p>Die eigentliche Multiplayer-Spieloberfläche und synchronisierte Aktionen werden getrennt in Paket 3B und 4 umgesetzt. Das KI-Spiel bleibt davon unabhängig.</p>
            </div>
            <div class="button-row">
                <button class="secondary-link" id="leave-online-match" type="button">Online-Match verlassen</button>
                <a class="primary-link" id="switch-to-ai" href="game/index.php">Stattdessen gegen KI spielen</a>
            </div>
        </section>
    </main>
    <?php require __DIR__ . '/site-footer.php'; ?>
    <script src="multiplayer-room.js?v=multiplayer-ready-1"></script>
</body>
</html>
