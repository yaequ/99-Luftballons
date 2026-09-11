<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account – 99 Luftballons</title>
    <link rel="stylesheet" href="style.css?v=camp-1">
    <script src="theme.js?v=camp-1"></script>
</head>
<body class="menu-page">
    <?php require __DIR__ . '/site-header.php'; ?>

    <main id="main-content" class="menu-card">
        <div class="profile-avatar" aria-hidden="true">☺</div>
        <p class="eyebrow">Dein Platz im Basislager</p>
        <h1>Dein Profil</h1>
        <p>Hier entsteht dein persönlicher Bereich. Die Anpassung deines Profils kommt in einem späteren Update.</p>
        <a class="secondary-link" href="menu.php">Zurück zum Menü</a>
    </main>
</body>
</html>
