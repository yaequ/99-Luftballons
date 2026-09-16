<?php

declare(strict_types=1);

require_once __DIR__ . '/../matchmaking.php';

function matchmaking_check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
    echo "OK: {$message}\n";
}

$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('PRAGMA foreign_keys = ON');
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE)');
$pdo->exec("INSERT INTO users (id, username) VALUES (1, 'Ada'), (2, 'Bert'), (3, 'Clara')");

ensure_matchmaking_tables($pdo);
ensure_matchmaking_tables($pdo);
matchmaking_check(matchmaking_status($pdo, 1)['state'] === 'idle', 'A new player starts outside the queue');

$first = join_matchmaking($pdo, 1);
matchmaking_check($first['state'] === 'waiting', 'The first player waits for an opponent');
matchmaking_check((int) $pdo->query('SELECT COUNT(*) FROM matchmaking_queue')->fetchColumn() === 1, 'Joining creates exactly one queue row');

join_matchmaking($pdo, 1);
matchmaking_check((int) $pdo->query('SELECT COUNT(*) FROM matchmaking_queue')->fetchColumn() === 1, 'A player cannot join the queue twice');

$second = join_matchmaking($pdo, 2);
matchmaking_check($second['state'] === 'matched', 'The second player creates a match');
$firstStatus = matchmaking_status($pdo, 1);
matchmaking_check($firstStatus['state'] === 'matched', 'The waiting player sees the created match');
matchmaking_check($firstStatus['opponent'] === 'Bert' && $second['opponent'] === 'Ada', 'Both players see the correct opponent');
matchmaking_check(in_array($firstStatus['side'], [1, 2], true) && $firstStatus['side'] !== $second['side'], 'The two match sides are assigned exactly once');
matchmaking_check((int) $pdo->query('SELECT COUNT(*) FROM matchmaking_queue')->fetchColumn() === 0, 'Matched players are removed from the queue');

leave_matchmaking($pdo, 1);
matchmaking_check(matchmaking_status($pdo, 1)['state'] === 'idle', 'Leaving cancels a match that has not started');
matchmaking_check(matchmaking_status($pdo, 2)['state'] === 'idle', 'The opponent is released from a cancelled match');

join_matchmaking($pdo, 3);
$pdo->exec("UPDATE matchmaking_queue SET last_seen_at = '2000-01-01 00:00:00' WHERE user_id = 3");
matchmaking_cleanup($pdo, 30);
matchmaking_check(matchmaking_status($pdo, 3)['state'] === 'idle', 'Inactive queue entries are cleaned up');
