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
    1 => ['id' => 'frost', 'name' => 'Frostpfad', 'image' => 'game/assets/Maps/image2.webp', 'width' => 1440, 'height' => 1080],
    2 => ['id' => 'woodland', 'name' => 'Waldweg', 'image' => 'game/assets/Maps/Grafik.webp', 'width' => 1024, 'height' => 765],
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
    <link rel="stylesheet" href="multiplayer-game.css?v=multiplayer-ui-2">
    <link rel="stylesheet" href="multiplayer-game/game.css?v=multiplayer-controls-2">
</head>
<body class="multiplayer-game-page">
    <main id="main-content" class="multiplayer-match-shell"
          data-matchmaking-api="matchmaking-api.php"
          data-game-api="multiplayer-game-api.php"
          data-csrf-token="<?= htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') ?>"
          data-match-id="<?= $matchId ?>"
          data-player-side="<?= $side ?>"
          data-opponent-name="<?= htmlspecialchars((string) $status['opponent'], ENT_QUOTES, 'UTF-8') ?>"
          data-local-engine="true"
          data-player-map="<?= $playerMap['id'] ?>"
          data-opponent-map="<?= $opponentMap['id'] ?>">
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
                <small id="multiplayer-round-state">Beide Spieler müssen bereit sein</small>
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
                <div class="mp-map-canvas-stage"><canvas class="mp-game-canvas" id="multiplayer-player-canvas" width="960" height="720" tabindex="0" aria-label="Deine Karte <?= htmlspecialchars($playerMap['name'], ENT_QUOTES, 'UTF-8') ?>. Türme platzieren oder zwei gleichstufige Türme nacheinander zum Verschmelzen anklicken."></canvas><div class="mp-canvas-status" id="multiplayer-canvas-status">Spielgrafiken werden geladen …</div><div class="mp-map-tip" id="multiplayer-map-tip"><b>1</b><span>Vor Runde 1 drei kostenlose Türme auf Bauflächen platzieren.</span></div></div>
                <footer><div><span>Deine Lebenspunkte</span><strong id="your-hp"><?= (int) $gameState['you']['hp'] ?> / 99</strong></div><div class="mp-health" id="your-health" role="progressbar" aria-label="Deine Lebenspunkte" aria-valuemin="0" aria-valuemax="99" aria-valuenow="<?= (int) $gameState['you']['hp'] ?>"><i style="width: <?= min(100, max(0, (int) $gameState['you']['hp'] / 99 * 100)) ?>%"></i></div></footer>
            </article>
            <article class="mp-map-card mp-map-card--opponent">
                <header><div><span>Karte von <?= htmlspecialchars((string) $status['opponent'], ENT_QUOTES, 'UTF-8') ?></span><strong><?= htmlspecialchars($opponentMap['name'], ENT_QUOTES, 'UTF-8') ?></strong></div><b>Angreifen</b></header>
                <div class="mp-map-canvas-stage"><canvas class="mp-game-canvas mp-game-canvas--readonly" id="multiplayer-opponent-canvas" width="960" height="720" aria-label="Karte des Gegners <?= htmlspecialchars($opponentMap['name'], ENT_QUOTES, 'UTF-8') ?>"></canvas></div>
                <footer><div><span>Gegnerische Lebenspunkte</span><strong id="opponent-hp"><?= (int) $gameState['opponent']['hp'] ?> / 99</strong></div><div class="mp-health" id="opponent-health" role="progressbar" aria-label="Lebenspunkte des Gegners" aria-valuemin="0" aria-valuemax="99" aria-valuenow="<?= (int) $gameState['opponent']['hp'] ?>"><i style="width: <?= min(100, max(0, (int) $gameState['opponent']['hp'] / 99 * 100)) ?>%"></i></div></footer>
            </article>
        </section>

        <section class="mp-canvas-controls" aria-labelledby="online-actions-title">
            <div class="mp-tower-panel">
                <div class="mp-control-heading"><div><span class="mp-kicker">Online · Verteidigung</span><h1 id="online-actions-title">Turm auswählen</h1></div><p>Wird live mit deinem Gegner synchronisiert</p></div>
                <div class="mp-tower-grid">
                    <button class="mp-tower-card" data-tower="cactus" type="button" aria-pressed="false"><canvas data-portrait="cactus" width="92" height="72" aria-hidden="true"></canvas><span><strong>Kaktus</strong><small>Schneller Schaden</small><em><img src="assets/img/goldnugget.png" alt=""><span class="mp-price-value">Gratis</span></em></span></button>
                    <button class="mp-tower-card" data-tower="fan" type="button" aria-pressed="false"><canvas data-portrait="fan" width="92" height="72" aria-hidden="true"></canvas><span><strong>Gebläse</strong><small>Kurze Abklingzeit</small><em><img src="assets/img/goldnugget.png" alt=""><span class="mp-price-value">Gratis</span></em></span></button>
                    <button class="mp-tower-card" data-tower="lens" type="button" aria-pressed="false"><canvas data-portrait="lens" width="92" height="72" aria-hidden="true"></canvas><span><strong>Lupe</strong><small>Hoher Schaden</small><em><img src="assets/img/goldnugget.png" alt=""><span class="mp-price-value">Gratis</span></em></span></button>
                </div>
            </div>
            <div class="mp-attack-panel">
                <div class="mp-control-heading"><div><span class="mp-kicker">Online · Angriff</span><h2>Ballons senden</h2></div><p>Ballonpakete werden im Rundenverlauf freigeschaltet</p></div>
                <div class="mp-balloon-grid">
                    <button class="mp-balloon-card" data-balloon="red" type="button"><canvas data-balloon-portrait="red" width="64" height="64" aria-hidden="true"></canvas><span><strong>Rot</strong><small>Ab Runde 1</small><em><img src="assets/img/goldnugget.png" alt="">25 <b>+0,1/s</b></em></span></button>
                    <button class="mp-balloon-card" data-balloon="blue" type="button"><canvas data-balloon-portrait="blue" width="64" height="64" aria-hidden="true"></canvas><span><strong>Blau</strong><small>Ab Runde 5</small><em><img src="assets/img/goldnugget.png" alt="">50 <b>+0,2/s</b></em></span></button>
                    <button class="mp-balloon-card" data-balloon="green" type="button"><canvas data-balloon-portrait="green" width="64" height="64" aria-hidden="true"></canvas><span><strong>Grün</strong><small>Ab Runde 10</small><em><img src="assets/img/goldnugget.png" alt="">90 <b>+0,3/s</b></em></span></button>
                    <button class="mp-balloon-card" data-balloon="yellow" type="button"><canvas data-balloon-portrait="yellow" width="64" height="64" aria-hidden="true"></canvas><span><strong>Gelb</strong><small>Ab Runde 15</small><em><img src="assets/img/goldnugget.png" alt="">140 <b>+0,5/s</b></em></span></button>
                </div>
                <div class="mp-local-round-controls">
                    <label><input id="multiplayer-auto-start" type="checkbox" checked> Auto-Start</label>
                    <button class="mp-local-primary" id="multiplayer-start-round" type="button">Bereit für Runde 1</button>
                    <button id="multiplayer-pause" type="button" disabled aria-pressed="false">Pausieren</button>
                </div>
                <p class="mp-local-status" id="multiplayer-local-status" role="status" aria-live="polite">Online-Synchronisierung aktiv. Beide Spieler geben jede Runde gemeinsam frei.</p>
            </div>
        </section>
        <section class="mp-result-modal" id="multiplayer-result-modal" role="dialog" aria-modal="true" aria-labelledby="multiplayer-result-title" hidden>
            <div class="mp-result-card">
                <div class="mp-result-icon" id="multiplayer-result-icon" aria-hidden="true">★</div>
                <p class="mp-kicker" id="multiplayer-result-kicker">Match beendet</p>
                <h2 id="multiplayer-result-title">Ergebnis</h2>
                <p id="multiplayer-result-message">Das Server-Ergebnis wird bestätigt …</p>
                <div class="mp-result-stats" aria-label="Zusammenfassung des Matches">
                    <span><small>Runde</small><strong id="multiplayer-result-round">0/30</strong></span>
                    <span><small>Spieldauer</small><strong id="multiplayer-result-duration">00:00</strong></span>
                    <span><small>Statistik</small><strong id="multiplayer-result-saved">Wird gespeichert</strong></span>
                </div>
                <div class="mp-result-actions">
                    <button class="mp-result-primary" id="multiplayer-rematch" type="button">Rückspiel suchen</button>
                    <button id="multiplayer-result-menu" type="button">Spielmodus wählen</button>
                    <a href="history.php" id="multiplayer-result-history">Meine Runden</a>
                </div>
            </div>
        </section>
    </main>
    <script src="multiplayer-room.js?v=multiplayer-final-1"></script>
    <script type="module" src="multiplayer-game/multiplayer-local.js?v=multiplayer-controls-2"></script>
</body>
</html>
