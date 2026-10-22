<?php

declare(strict_types=1);

require_once __DIR__ . '/../first-round-tutorial.php';

function tutorial_check(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException('FAIL: ' . $message);
    echo "OK: {$message}\n";
}

$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('PRAGMA foreign_keys = ON');
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY)');
$pdo->exec('CREATE TABLE game_results (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL)');
$pdo->exec('INSERT INTO users (id) VALUES (1), (2)');
$pdo->exec('INSERT INTO game_results (id, user_id) VALUES (1, 2)');

tutorial_check(should_show_first_round_tutorial($pdo, 1), 'A new account receives the tour at its first round start');
tutorial_check(should_show_first_round_tutorial($pdo, 1), 'An interrupted tour can resume on a later attempt');
complete_first_round_tutorial($pdo, 1);
tutorial_check(!should_show_first_round_tutorial($pdo, 1), 'A completed tour does not appear again');
tutorial_check(!should_show_first_round_tutorial($pdo, 2), 'An existing player with match history is not treated as new');
$pdo->exec('DELETE FROM users WHERE id = 1');
tutorial_check((int) $pdo->query('SELECT COUNT(*) FROM first_round_tutorials WHERE user_id = 1')->fetchColumn() === 0,
    'Deleting an account removes its tutorial state');
