<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();
require __DIR__ . '/db.php';
require __DIR__ . '/portal.php';
$userId = (int) $_SESSION['user_id'];
$mode = option($_GET, 'mode', ['all', 'ai', 'multiplayer'], 'all');
$filter = option($_GET, 'result', ['all', 'win', 'loss', 'draw'], 'all');
$pageInput = $_GET['page'] ?? '1';
$page = is_string($pageInput) ? (filter_var($pageInput, FILTER_VALIDATE_INT) ?: 1) : 1;
$history = match_history($pdo, $userId, $filter, $page, 10, $mode);
$best = $history['best'];
?>
<!DOCTYPE html><html lang="de">
<head><?php portal_head('Meine Runden'); ?></head>
<body><?php require __DIR__ . '/site-header.php'; ?>
<main id="main-content" class="portal-shell">
    <div class="page-heading"><p class="eyebrow">Dein Spielverlauf</p><h1>Runde für Runde.</h1><p class="card-intro">Deine gespeicherten Partien, Ergebnisse und persönlichen Bestzeiten.</p></div>
    <section class="portal-panel">
        <nav class="mode-tabs mode-tabs-three" aria-label="Spielmodus filtern">
            <?php foreach (['all'=>'Alle Partien', 'ai'=>'Gegen KI', 'multiplayer'=>'Multiplayer'] as $value=>$label): ?>
            <a href="history.php?<?= escape(http_build_query(['mode'=>$value, 'result'=>$filter])) ?>"<?= $mode === $value ? ' aria-current="page"' : '' ?>><?= $label ?></a>
            <?php endforeach; ?>
        </nav>
        <nav class="filter-pills" aria-label="Partien nach Ergebnis filtern">
            <?php foreach (['all'=>'Alle', 'win'=>'Siege', 'loss'=>'Niederlagen', 'draw'=>'Unentschieden'] as $value=>$label): ?>
            <a href="history.php?<?= escape(http_build_query(['mode'=>$mode, 'result'=>$value])) ?>"<?= $filter === $value ? ' aria-current="page"' : '' ?>><?= $label ?></a>
            <?php endforeach; ?>
        </nav>
        <p><?= $history['total'] ?> <?= $history['total'] === 1 ? 'Partie' : 'Partien' ?> in dieser Auswahl. Neueste zuerst.</p>
        <?php history_table($history['entries'], $best); ?>
        <?php if ($history['pages'] > 1): ?>
        <nav class="pagination" aria-label="Seiten des Spielverlaufs">
            <?php if ($history['page'] > 1): ?><a class="secondary-link" href="history.php?<?= escape(http_build_query(['mode'=>$mode, 'result'=>$filter, 'page'=>$history['page']-1])) ?>">← Zurück</a><?php endif; ?>
            <span>Seite <?= $history['page'] ?> von <?= $history['pages'] ?></span>
            <?php if ($history['page'] < $history['pages']): ?><a class="secondary-link" href="history.php?<?= escape(http_build_query(['mode'=>$mode, 'result'=>$filter, 'page'=>$history['page']+1])) ?>">Weiter →</a><?php endif; ?>
        </nav>
        <?php endif; ?>
        <div class="button-row"><a class="secondary-link" href="account.php">Zum Profil</a><a class="primary-link" href="game.php">Spiel starten</a></div>
    </section>
</main><?php require __DIR__ . '/site-footer.php'; ?></body></html>
