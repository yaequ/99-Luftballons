<?php

declare(strict_types=1);

function ensure_first_round_tutorial_table(PDO $pdo): void
{
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec('CREATE TABLE IF NOT EXISTS first_round_tutorials (
            user_id INTEGER PRIMARY KEY,
            started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT DEFAULT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )');
        return;
    }

    $pdo->exec('CREATE TABLE IF NOT EXISTS first_round_tutorials (
        user_id INT UNSIGNED PRIMARY KEY,
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL DEFAULT NULL,
        CONSTRAINT fk_first_round_tutorial_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
}

function should_show_first_round_tutorial(PDO $pdo, int $userId): bool
{
    ensure_first_round_tutorial_table($pdo);
    $query = $pdo->prepare('SELECT completed_at FROM first_round_tutorials WHERE user_id = ?');
    $query->execute([$userId]);
    $row = $query->fetch(PDO::FETCH_ASSOC);
    if ($row !== false) return $row['completed_at'] === null;

    // Accounts with a recorded match have already played before this feature existed.
    $history = $pdo->prepare('SELECT 1 FROM game_results WHERE user_id = ? LIMIT 1');
    $history->execute([$userId]);
    if ($history->fetchColumn() !== false) return false;

    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $insert = $pdo->prepare('INSERT OR IGNORE INTO first_round_tutorials (user_id) VALUES (?)');
    } else {
        $insert = $pdo->prepare('INSERT IGNORE INTO first_round_tutorials (user_id) VALUES (?)');
    }
    $insert->execute([$userId]);
    $query->execute([$userId]);
    $row = $query->fetch(PDO::FETCH_ASSOC);
    return $row !== false && $row['completed_at'] === null;
}

function complete_first_round_tutorial(PDO $pdo, int $userId): void
{
    ensure_first_round_tutorial_table($pdo);
    $query = $pdo->prepare('UPDATE first_round_tutorials SET completed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND completed_at IS NULL');
    $query->execute([$userId]);
}
