<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();
require __DIR__ . '/db.php';
require __DIR__ . '/portal.php';
$userId = (int) $_SESSION['user_id'];
$query = $pdo->prepare('SELECT username, created_at FROM users WHERE id = ?');
$query->execute([$userId]);
$player = $query->fetch();
if (!$player) {
    $_SESSION = [];
    session_destroy();
    header('Location: login.php');
    exit;
}
$stats = player_stats($pdo, $userId);
$rank = rankings($pdo, 'fastest', 'all', $userId)['mine'];
$recent = match_history($pdo, $userId, 'all', 1, 5);
$best = $stats['best'] === null ? null : (int) $stats['best'];
?>
<!DOCTYPE html><html lang="de">
<head><?php portal_head('Dein Account'); ?></head>
<body><?php require __DIR__ . '/site-header.php'; ?>
<main id="main-content" class="portal-shell">
    <div class="page-heading">
        <div class="profile-avatar" aria-hidden="true">☺</div><p class="eyebrow">Dein Platz im Basislager</p>
        <h1><?= escape($player['username']) ?></h1>
        <p class="card-intro">Dabei seit <?= escape((new DateTimeImmutable($player['created_at']))->format('d.m.Y')) ?>.</p>
    </div>
    <section class="stats-grid" aria-label="Deine Spielstatistiken">
        <div class="portal-panel stat-card"><span>Gespielte Partien</span><strong><?= (int) $stats['matches'] ?></strong></div>
        <div class="portal-panel stat-card"><span>Siege</span><strong><?= (int) $stats['wins'] ?></strong></div>
        <div class="portal-panel stat-card"><span>Siegquote</span><strong><?= $stats['rate'] === null ? '–' : number_format($stats['rate'], 1, ',', '.') . ' %' ?></strong></div>
        <div class="portal-panel stat-card"><span>Persönliche Bestzeit</span><strong><?= duration($best) ?></strong></div>
    </section>
    <section class="portal-panel portal-section">
        <div class="section-heading"><div><p class="eyebrow">Schnellste Sieger · Gesamt</p><h2><?= $rank ? 'Dein Rang: #' . (int) $rank['rank'] : 'Dein erster Sieg wartet.' ?></h2></div><a class="secondary-link" href="leaderboard.php">Zur Bestenliste</a></div>
        <p>Gewertet wird deine schnellste gewonnene Partie. Abgebrochene und nicht gespeicherte Spiele zählen nicht zur Statistik.</p>
    </section>
    <section class="portal-panel portal-section">
        <div class="section-heading"><div><p class="eyebrow">Deine letzten fünf Partien</p><h2>Zuletzt gespielt</h2></div><a class="secondary-link" href="history.php">Alle meine Runden</a></div>
        <?php history_table($recent['entries'], $best); ?>
        <a class="primary-link" href="game.php">Nächste Runde starten →</a>
    </section>
</main></body></html>
