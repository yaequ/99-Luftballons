<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require __DIR__ . '/db.php';
require __DIR__ . '/portal.php';
$sort = option($_GET, 'sort', ['fastest','wins'], 'fastest');
$period = option($_GET, 'period', ['all','week','month'], 'all');
$userId = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
$board = rankings($pdo, $sort, $period, $userId);
$entries = $board['entries'];
$mine = $board['mine'];
function board_url(string $sort, string $period): string {
    return 'leaderboard.php?' . escape(http_build_query(['sort'=>$sort, 'period'=>$period]));
}
?>
<!DOCTYPE html><html lang="de">
<head><?php portal_head('Bestenliste'); ?></head>
<body><?php require __DIR__ . '/site-header.php'; ?>
<main id="main-content" class="portal-shell">
    <div class="page-heading"><p class="eyebrow">Bestenliste</p><h1>Die besten Ballonjäger</h1><p class="card-intro">Große Siege. Schnelle Runden. Ein Platz ganz oben.</p></div>
    <section class="portal-panel">
        <nav class="leaderboard-tabs" aria-label="Rangliste sortieren">
            <a class="<?= $sort === 'fastest' ? 'active' : '' ?>" <?= $sort === 'fastest' ? 'aria-current="page"' : '' ?> href="<?= board_url('fastest', $period) ?>">Schnellste Sieger</a>
            <a class="<?= $sort === 'wins' ? 'active' : '' ?>" <?= $sort === 'wins' ? 'aria-current="page"' : '' ?> href="<?= board_url('wins', $period) ?>">Meiste Siege</a>
        </nav>
        <nav class="filter-pills" aria-label="Zeitraum">
            <?php foreach (['all'=>'Gesamt','week'=>'Diese Woche','month'=>'Dieser Monat'] as $value=>$label): ?>
            <a href="<?= board_url($sort, $value) ?>"<?= $period === $value ? ' aria-current="page"' : '' ?>><?= $label ?></a>
            <?php endforeach; ?>
        </nav>
        <?php podium($entries, $sort); ?>
        <p class="ranking-note">Ein Eintrag pro Spieler. <?= $sort === 'wins' ? 'Bei gleicher Siegzahl entscheidet die schnellere Bestzeit.' : 'Gewertet wird der schnellste Sieg im gewählten Zeitraum.' ?> Bei identischen Werten entscheidet die Spieler-ID. Wochen beginnen montags; Zeiträume richten sich nach der Datenbankzeit.</p>
        <?php if ($mine): ?>
        <div class="own-rank"><strong>Dein Platz: #<?= (int) $mine['rank'] ?></strong><span><?= (int) $mine['wins'] ?> Siege · Bestzeit <?= duration((int) $mine['best']) ?></span></div>
        <?php elseif ($userId !== null): ?><p class="message">Du hast in diesem Zeitraum noch keinen gespeicherten Sieg.</p><?php else: ?><p class="message"><a href="login.php">Melde dich an</a>, um deine eigene Platzierung zu sehen.</p><?php endif; ?>
        <?php if ($entries !== []): ?>
        <div class="leaderboard-table-wrapper"><table class="leaderboard-table">
            <caption class="table-caption">Top 10<?= $mine && $mine['rank'] > 10 ? ' und deine Platzierung' : '' ?></caption>
            <thead><tr><th scope="col">Platz</th><th scope="col">Spieler</th><th scope="col">Siege</th><th scope="col">Bestzeit</th></tr></thead>
            <tbody>
            <?php
            $displayRows = $entries;
            if ($mine && $mine['rank'] > 10) $displayRows[] = $mine;
            foreach ($displayRows as $entry):
                $isMine = $userId !== null && (int) $entry['id'] === $userId;
            ?>
                <tr<?= $isMine ? ' class="current-user"' : '' ?>>
                    <td><span class="rank-badge rank-<?= (int) $entry['rank'] ?>"><?= (int) $entry['rank'] ?></span></td>
                    <td><?= escape($entry['username']) ?><?= $isMine ? ' <span class="personal-best">Du</span>' : '' ?></td>
                    <td><?= (int) $entry['wins'] ?></td>
                    <td><?= duration((int) $entry['best']) ?><?= $isMine ? ' <span class="personal-best">Deine Bestzeit' . ($period === 'all' ? '' : ' im Zeitraum') . '</span>' : '' ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table></div>
        <?php endif; ?>
    </section>
</main><?php require __DIR__ . '/site-footer.php'; ?></body></html>
