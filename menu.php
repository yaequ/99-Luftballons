<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();
require __DIR__ . '/db.php';

$statement = $pdo->prepare('SELECT username FROM users WHERE id = ? LIMIT 1');
$statement->execute([$_SESSION['user_id']]);
$user = $statement->fetch();

if ($user === false) {
    $_SESSION = [];
    session_destroy();
    header('Location: login.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Menü – 99 Luftballons</title>
    <link rel="stylesheet" href="style.css?v=leaderboard-tabs-1">
    <script src="theme.js?v=camp-1"></script>
</head>
<body class="menu-page">
    <?php require __DIR__ . '/site-header.php'; ?>

    <main id="main-content" class="menu-card camp-card">
        <div class="camp-copy"><p class="eyebrow"><span class="status-dot"></span> Dein Basislager</p>
        <h1>Hallo, <?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?>!</h1>
        <p>Die Ballons sind unterwegs. Baue deine Verteidigung, beschütze deine Basis und fordere die KI heraus.</p>
        <div class="button-row"><a class="primary-link" href="game.php">Spiel starten <span aria-hidden="true">→</span></a><a class="secondary-link" href="leaderboard.php">Bestenliste</a></div>
        <p class="camp-footnote"><a href="account.php">Meine Statistiken</a> · <a href="instructions.php">Spielanleitung</a></p></div>
        <figure class="map-preview">
            <img src="game/assets/Maps/Grafik.webp" alt="Waldkarte mit kurvigen Wegen, Bauflächen und einer befestigten Basis" width="1024" height="765">
            <figcaption><span class="map-caption-icon" aria-hidden="true">⌁</span><span><small>Ein Blick in die Spielwelt</small><strong>Zwischen Wald &amp; Abenteuer</strong></span></figcaption>
        </figure>
    </main>
    <?php require __DIR__ . '/site-footer.php'; ?>
</body>
</html>
