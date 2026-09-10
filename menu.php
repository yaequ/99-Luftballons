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
    <link rel="stylesheet" href="style.css">
</head>
<body class="menu-page">
    <header class="site-header">
        <a class="brand" href="menu.php">99 Luftballons</a>
        <nav>
            <a href="leaderboard.php">Bestenliste</a>
            <a href="account.php">Account</a>
            <a href="logout.php">Logout</a>
        </nav>
    </header>

    <main class="menu-card">
        <p class="eyebrow">Hauptmenü</p>
        <h1>Hallo, <?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?>!</h1>
        <p>Dein Account ist bestätigt und du bist erfolgreich eingeloggt.</p>
        <a class="primary-link" href="game.php">Spiel starten</a>
    </main>
</body>
</html>
