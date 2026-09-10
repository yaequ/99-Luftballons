<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();
require __DIR__ . '/db.php';

$sort = $_GET['sort'] ?? 'fastest';

if ($sort === 'wins') {
    $statement = $pdo->query(
        "SELECT users.username, COUNT(*) AS wins, MIN(game_results.duration_seconds) AS fastest_win_seconds
         FROM game_results
         INNER JOIN users ON users.id = game_results.user_id
         WHERE game_results.result = 'win'
         GROUP BY users.id, users.username
         ORDER BY wins DESC, fastest_win_seconds ASC
         LIMIT 10"
    );
    $entries = $statement->fetchAll();
} else {
    $sort = 'fastest';
    $statement = $pdo->query(
        "SELECT users.username, game_results.duration_seconds, game_results.created_at
         FROM game_results
         INNER JOIN users ON users.id = game_results.user_id
         WHERE game_results.result = 'win'
         ORDER BY game_results.duration_seconds ASC, game_results.created_at ASC
         LIMIT 10"
    );
    $entries = $statement->fetchAll();
}

function format_duration(int $seconds): string
{
    return sprintf('%02d:%02d', intdiv($seconds, 60), $seconds % 60);
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bestenliste – 99 Luftballons</title>
    <link rel="stylesheet" href="style.css">
</head>
<body class="menu-page">
    <header class="site-header">
        <a class="brand" href="menu.php">99 Luftballons</a>
        <nav>
            <a href="account.php">Account</a>
            <a href="logout.php">Logout</a>
        </nav>
    </header>

    <main class="menu-card leaderboard-card">
        <p class="eyebrow">Bestenliste</p>
        <h1>Die besten Ballonjäger</h1>
        <div class="leaderboard-tabs" aria-label="Sortierung der Bestenliste">
            <a class="<?= $sort === 'fastest' ? 'active' : '' ?>" href="leaderboard.php?sort=fastest">Schnellste Siege</a>
            <a class="<?= $sort === 'wins' ? 'active' : '' ?>" href="leaderboard.php?sort=wins">Meiste Siege</a>
        </div>

        <?php if ($entries === []): ?>
            <p class="message">Noch gibt es keine gewonnenen Spiele. Starte die erste Partie!</p>
        <?php else: ?>
            <div class="leaderboard-table-wrapper">
                <table class="leaderboard-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Benutzername</th>
                            <?php if ($sort === 'fastest'): ?>
                                <th>Zeit</th>
                            <?php else: ?>
                                <th>Siege</th>
                                <th>Schnellster Sieg</th>
                            <?php endif; ?>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($entries as $index => $entry): ?>
                            <tr>
                                <td><?= $index + 1 ?></td>
                                <td><?= htmlspecialchars($entry['username'], ENT_QUOTES, 'UTF-8') ?></td>
                                <?php if ($sort === 'fastest'): ?>
                                    <td><?= format_duration((int) $entry['duration_seconds']) ?></td>
                                <?php else: ?>
                                    <td><?= (int) $entry['wins'] ?></td>
                                    <td><?= format_duration((int) $entry['fastest_win_seconds']) ?></td>
                                <?php endif; ?>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>

        <a class="secondary-link" href="menu.php">Zurück zum Menü</a>
    </main>
</body>
</html>
