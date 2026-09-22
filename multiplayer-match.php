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
    1 => ['id' => 'frost', 'name' => 'Frostpfad', 'image' => 'game/assets/Maps/image2.webp', 'width' => 1440, 'height' => 1080, 'crop' => 53,
        'zones' => [[472,166,258,54],[322,377,273,53],[971,354,154,53],[104,518,48,176],[772,585,258,49],[1291,382,48,223],[846,780,147,139]]],
    2 => ['id' => 'woodland', 'name' => 'Waldweg', 'image' => 'game/assets/Maps/Grafik.webp', 'width' => 1024, 'height' => 765, 'crop' => 38,
        'zones' => [[302,136,204,38],[267,253,195,32],[725,255,85,33],[61,387,56,103],[521,409,186,33],[923,289,38,166],[206,656,269,27],[598,534,117,97]]],
];
$playerMap = $maps[$side];
$opponentMap = $maps[$side === 1 ? 2 : 1];
$towerTypes = multiplayer_tower_types();
$balloonTypes = multiplayer_balloon_types();
$towerImages = [
    'cactus' => 'game/assets/Charaktere/Kaktus/Kaktus/Segment 1.png',
    'fan' => 'game/assets/Charaktere/Geblaese/Ballon Hunter/Ballon Hunter 1.png',
    'lens' => 'game/assets/Charaktere/Lupe/Fliegerstaffel/Fliegerstaffel 1.png',
];
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Online-Match – 99 Luftballons</title>
    <link rel="stylesheet" href="multiplayer-game.css?v=multiplayer-actions-1">
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
                <div class="mp-map-image mp-map-image--<?= $playerMap['id'] ?>" data-map-side="you"><img src="<?= htmlspecialchars($playerMap['image'], ENT_QUOTES, 'UTF-8') ?>" alt="Deine Karte <?= htmlspecialchars($playerMap['name'], ENT_QUOTES, 'UTF-8') ?>" width="<?= $playerMap['width'] ?>" height="<?= $playerMap['height'] ?>">
                    <div class="mp-map-overlay" aria-label="Bauplätze auf deiner Karte">
                    <?php foreach ($playerMap['zones'] as $slot => [$x, $y, $width, $height]): ?>
                        <button class="mp-build-slot" type="button" data-slot="<?= $slot ?>" aria-label="Bauplatz <?= $slot + 1 ?>" style="--slot-x:<?= $x / $playerMap['width'] * 100 ?>%;--slot-y:<?= ($y - $playerMap['crop']) / ($playerMap['height'] - $playerMap['crop']) * 100 ?>%;--slot-w:<?= $width / $playerMap['width'] * 100 ?>%;--slot-h:<?= $height / ($playerMap['height'] - $playerMap['crop']) * 100 ?>%"></button>
                    <?php endforeach; ?>
                    </div>
                </div>
                <footer><div><span>Deine Lebenspunkte</span><strong id="your-hp"><?= (int) $gameState['you']['hp'] ?> / 99</strong></div><div class="mp-health" id="your-health" role="progressbar" aria-label="Deine Lebenspunkte" aria-valuemin="0" aria-valuemax="99" aria-valuenow="<?= (int) $gameState['you']['hp'] ?>"><i style="width: <?= min(100, max(0, (int) $gameState['you']['hp'] / 99 * 100)) ?>%"></i></div></footer>
            </article>
            <article class="mp-map-card mp-map-card--opponent">
                <header><div><span>Karte von <?= htmlspecialchars((string) $status['opponent'], ENT_QUOTES, 'UTF-8') ?></span><strong><?= htmlspecialchars($opponentMap['name'], ENT_QUOTES, 'UTF-8') ?></strong></div><b>Angreifen</b></header>
                <div class="mp-map-image mp-map-image--<?= $opponentMap['id'] ?>" data-map-side="opponent"><img src="<?= htmlspecialchars($opponentMap['image'], ENT_QUOTES, 'UTF-8') ?>" alt="Karte des Gegners <?= htmlspecialchars($opponentMap['name'], ENT_QUOTES, 'UTF-8') ?>" width="<?= $opponentMap['width'] ?>" height="<?= $opponentMap['height'] ?>">
                    <div class="mp-map-overlay" aria-label="Verteidigung des Gegners">
                    <?php foreach ($opponentMap['zones'] as $slot => [$x, $y, $width, $height]): ?>
                        <span class="mp-build-slot mp-build-slot--opponent" data-slot="<?= $slot ?>" style="--slot-x:<?= $x / $opponentMap['width'] * 100 ?>%;--slot-y:<?= ($y - $opponentMap['crop']) / ($opponentMap['height'] - $opponentMap['crop']) * 100 ?>%;--slot-w:<?= $width / $opponentMap['width'] * 100 ?>%;--slot-h:<?= $height / ($opponentMap['height'] - $opponentMap['crop']) * 100 ?>%"></span>
                    <?php endforeach; ?>
                    </div>
                </div>
                <footer><div><span>Gegnerische Lebenspunkte</span><strong id="opponent-hp"><?= (int) $gameState['opponent']['hp'] ?> / 99</strong></div><div class="mp-health" id="opponent-health" role="progressbar" aria-label="Lebenspunkte des Gegners" aria-valuemin="0" aria-valuemax="99" aria-valuenow="<?= (int) $gameState['opponent']['hp'] ?>"><i style="width: <?= min(100, max(0, (int) $gameState['opponent']['hp'] / 99 * 100)) ?>%"></i></div></footer>
            </article>
        </section>

        <section class="mp-action-dock" aria-labelledby="online-actions-title">
            <div class="mp-shop-panel">
                <span class="mp-kicker">Verteidigung</span><h1 id="online-actions-title">Turm wählen</h1>
                <div class="mp-shop-row" id="tower-shop">
                <?php foreach ($towerTypes as $type => $tower): ?>
                    <button class="mp-shop-card mp-tower-choice" type="button" data-tower="<?= $type ?>" data-cost="<?= $tower['cost'] ?>" aria-pressed="false"><img src="<?= htmlspecialchars($towerImages[$type], ENT_QUOTES, 'UTF-8') ?>" alt=""><span><strong><?= htmlspecialchars($tower['name'], ENT_QUOTES, 'UTF-8') ?></strong><small><img src="assets/img/goldnugget.png" alt=""><?= $tower['cost'] ?></small></span></button>
                <?php endforeach; ?>
                </div>
                <p class="mp-shop-help" id="build-help">Turm auswählen und danach einen markierten Bauplatz anklicken.</p>
            </div>
            <div class="mp-shop-panel mp-shop-panel--attack">
                <span class="mp-kicker">Angriff</span><h2>Ballons senden</h2>
                <div class="mp-shop-row" id="balloon-shop">
                <?php foreach ($balloonTypes as $type => $balloon): ?>
                    <button class="mp-shop-card mp-balloon-choice" type="button" data-balloon="<?= $type ?>" data-cost="<?= $balloon['cost'] ?>"><img src="game/assets/Balloons/transparent/<?= $type ?>/balloon_<?= $type ?>_frame_01.png" alt=""><span><strong><?= htmlspecialchars($balloon['name'], ENT_QUOTES, 'UTF-8') ?></strong><small><img src="assets/img/goldnugget.png" alt=""><?= $balloon['cost'] ?> · +<?= $balloon['income'] ?>/s</small></span></button>
                <?php endforeach; ?>
                </div>
                <p class="mp-shop-help"><strong id="outgoing-attacks">0</strong> Angriffspakete für die nächste Runde vorbereitet.</p>
            </div>
            <div class="mp-round-actions">
                <div class="mp-events"><strong>Live-Meldungen</strong><ul id="match-events"><li>Beide Seiten können handeln.</li></ul></div>
                <button class="mp-button mp-button--start" id="start-online-round" type="button">Runde 1 bereit</button>
                <p class="mp-action-feedback" id="action-feedback" role="status" aria-live="polite"></p>
            </div>
        </section>
    </main>
    <script id="multiplayer-assets" type="application/json"><?= json_encode(['towers' => $towerImages], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) ?></script>
    <script src="multiplayer-room.js?v=multiplayer-actions-1"></script>
</body>
</html>
