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
    <link rel="stylesheet" href="style.css">
</head>
<body class="menu-page">
    <header class="site-header">
        <a class="brand" href="menu.php">99 Luftballons</a>
        <nav>
            <a href="menu.php">Menü</a>
            <a href="leaderboard.php">Bestenliste</a>
            <a href="logout.php">Logout</a>
        </nav>
    </header>

    <main class="menu-card">
        <p class="eyebrow">Account</p>
        <h1>Dein Profil</h1>
        <p>Die Account-Personalisierung wird später ergänzt.</p>
        <a class="secondary-link" href="menu.php">Zurück zum Menü</a>
    </main>
</body>
</html>
