<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();
require __DIR__ . '/db.php';
require_once __DIR__ . '/account-security.php';
require_once __DIR__ . '/matchmaking.php';

ensure_matchmaking_tables($pdo);
$userId = (int) $_SESSION['user_id'];
$matchId = filter_input(INPUT_GET, 'match', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$status = matchmaking_status($pdo, $userId, true);

if ($matchId === false || $matchId === null || (int) ($status['match_id'] ?? 0) !== $matchId || !in_array($status['state'], ['starting', 'active'], true)) {
    header('Location: multiplayer.php');
    exit;
}

$userQuery = $pdo->prepare('SELECT username FROM users WHERE id = ? LIMIT 1');
$userQuery->execute([$userId]);
$playerName = (string) $userQuery->fetchColumn();
$playerAvatar = avatar_data(user_avatar_code($pdo, $userId));
$gameState = $status['game_state'];
$side = (int) $status['side'];
$maps = [
    1 => ['name' => 'Frostpfad', 'image' => 'game/assets/Maps/image2.webp'],
    2 => ['name' => 'Waldweg', 'image' => 'game/assets/Maps/Grafik.webp'],
];
$playerMap = $maps[$side];
$opponentMap = $maps[$side === 1 ? 2 : 1];
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Online-Match – 99 Luftballons</title>
    <link rel="stylesheet" href="multiplayer-game.css?v=multiplayer-ui-1">
</head>
<body class="multiplayer-game-page">
    <main id="main-content" class="multiplayer-match-shell"
          data-matchmaking-api="matchmaking-api.php"
          data-csrf-token="<?= htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') ?>"
          data-match-id="<?= $matchId ?>">
        <header class="mp-topbar">
            <a class="mp-brand" id="leave-to-home" href="index.php" aria-label="Online-Match verlassen und zur Startseite"><img src="assets/img/branding/logo.png" alt="99 Luftballons" width="1024" height="512"></a>
            <div class="mp-match-label"><span>Online-Duell</span><strong>Match #<?= $matchId ?></strong></div>
            <div class="mp-topbar-actions">
                <div class="connection-status" id="connection-status"><i></i><span id="connection-label">Verbindung aktiv</span></div>
                <button class="mp-button mp-button--quiet" id="leave-online-match" type="button">Match verlassen</button>
            </div>
        </header>

        <section class="mp-scoreboard" aria-label="Gemeinsamer Matchstatus">
            <article class="mp-player-card">
                <img src="<?= htmlspecialchars($playerAvatar['image'], ENT_QUOTES, 'UTF-8') ?>" alt="" width="512" height="512">
                <div class="mp-player-copy"><span>Du · Seite <?= $side ?></span><strong><?= htmlspecialchars($playerName, ENT_QUOTES, 'UTF-8') ?></strong></div>
                <div class="mp-resources"><span><img src="assets/img/goldnugget.png" alt="" width="1254" height="1254"><strong id="your-gold"><?= (int) $gameState['you']['gold'] ?></strong></span><small id="your-income">+<?= (int) $gameState['you']['income'] ?> Gold/s</small></div>
            </article>
            <div class="mp-round-card">
                <span>Runde</span>
                <strong id="match-round"><?= (int) $gameState['round'] ?>/<?= (int) $gameState['total_rounds'] ?></strong>
                <small>Online-Spiel bereit</small>
            </div>
            <article class="mp-player-card mp-player-card--opponent">
                <img src="<?= htmlspecialchars((string) $status['opponent_avatar'], ENT_QUOTES, 'UTF-8') ?>" alt="" width="512" height="512">
                <div class="mp-player-copy"><span>Gegner · Seite <?= $side === 1 ? 2 : 1 ?></span><strong><?= htmlspecialchars((string) $status['opponent'], ENT_QUOTES, 'UTF-8') ?></strong></div>
                <div class="mp-resources"><span><img src="assets/img/goldnugget.png" alt="" width="1254" height="1254"><strong id="opponent-gold"><?= (int) $gameState['opponent']['gold'] ?></strong></span><small id="opponent-income">+<?= (int) $gameState['opponent']['income'] ?> Gold/s</small></div>
            </article>
        </section>

        <section class="mp-map-grid" aria-label="Spielfelder">
            <article class="mp-map-card">
                <header><div><span>Deine Karte</span><strong><?= htmlspecialchars($playerMap['name'], ENT_QUOTES, 'UTF-8') ?></strong></div><b>Verteidigen</b></header>
                <div class="mp-map-image"><img src="<?= htmlspecialchars($playerMap['image'], ENT_QUOTES, 'UTF-8') ?>" alt="Deine Karte <?= htmlspecialchars($playerMap['name'], ENT_QUOTES, 'UTF-8') ?>" width="1440" height="1080"></div>
                <footer><div><span>Deine Lebenspunkte</span><strong id="your-hp"><?= (int) $gameState['you']['hp'] ?> / 99</strong></div><div class="mp-health" id="your-health" role="progressbar" aria-label="Deine Lebenspunkte" aria-valuemin="0" aria-valuemax="99" aria-valuenow="<?= (int) $gameState['you']['hp'] ?>"><i style="width: <?= min(100, max(0, (int) $gameState['you']['hp'] / 99 * 100)) ?>%"></i></div></footer>
            </article>
            <article class="mp-map-card mp-map-card--opponent">
                <header><div><span>Karte von <?= htmlspecialchars((string) $status['opponent'], ENT_QUOTES, 'UTF-8') ?></span><strong><?= htmlspecialchars($opponentMap['name'], ENT_QUOTES, 'UTF-8') ?></strong></div><b>Angreifen</b></header>
                <div class="mp-map-image"><img src="<?= htmlspecialchars($opponentMap['image'], ENT_QUOTES, 'UTF-8') ?>" alt="Karte des Gegners <?= htmlspecialchars($opponentMap['name'], ENT_QUOTES, 'UTF-8') ?>" width="1024" height="765"></div>
                <footer><div><span>Gegnerische Lebenspunkte</span><strong id="opponent-hp"><?= (int) $gameState['opponent']['hp'] ?> / 99</strong></div><div class="mp-health" id="opponent-health" role="progressbar" aria-label="Lebenspunkte des Gegners" aria-valuemin="0" aria-valuemax="99" aria-valuenow="<?= (int) $gameState['opponent']['hp'] ?>"><i style="width: <?= min(100, max(0, (int) $gameState['opponent']['hp'] / 99 * 100)) ?>%"></i></div></footer>
            </article>
        </section>

        <section class="mp-action-preview" aria-labelledby="online-actions-title">
            <div><span class="mp-kicker">Nächster Ausbauschritt</span><h1 id="online-actions-title">Online-Aktionen vorbereitet</h1><p>Die Oberfläche ist vollständig vom KI-Spiel getrennt. Turmbau, Ballons und Rundenstart werden erst in Paket 4 serverseitig synchronisiert.</p></div>
            <div class="mp-disabled-actions" aria-label="Noch nicht verfügbare Online-Aktionen">
                <button type="button" disabled>Turm bauen</button>
                <button type="button" disabled>Ballons senden</button>
                <button type="button" disabled>Runde starten</button>
            </div>
        </section>
    </main>
    <script src="multiplayer-room.js?v=multiplayer-ui-1"></script>
</body>
</html>
