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
$pdo->exec("INSERT INTO users (id, username) VALUES (1, 'Ada'), (2, 'Bert'), (3, 'Clara'), (4, 'Dora'), (5, 'Emil')");

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
matchmaking_check(str_starts_with($firstStatus['opponent_avatar'], 'assets/img/avatars/'), 'The opponent uses a safe preset avatar');
matchmaking_check(in_array($firstStatus['side'], [1, 2], true) && $firstStatus['side'] !== $second['side'], 'The two match sides are assigned exactly once');
matchmaking_check($firstStatus['game_state']['round'] === 0 && $firstStatus['game_state']['total_rounds'] === 30, 'A multiplayer match starts at round zero of thirty');
matchmaking_check($firstStatus['game_state']['you'] === $firstStatus['game_state']['opponent'], 'Both players start with identical server-side resources');
matchmaking_check($firstStatus['game_state']['you'] === ['hp'=>99, 'gold'=>100, 'income'=>5], 'The server provides the intended multiplayer start values');
matchmaking_check((int) $pdo->query('SELECT COUNT(*) FROM matchmaking_queue')->fetchColumn() === 0, 'Matched players are removed from the queue');

$firstReady = ready_multiplayer_match($pdo, 1);
matchmaking_check($firstReady['state'] === 'matched' && $firstReady['you_ready'] && !$firstReady['opponent_ready'], 'The first player can confirm readiness');
$secondReady = ready_multiplayer_match($pdo, 2);
matchmaking_check($secondReady['state'] === 'starting' && $secondReady['you_ready'] && $secondReady['opponent_ready'], 'The shared countdown starts when both players are ready');
$pdo->exec("UPDATE multiplayer_matches SET started_at = datetime(CURRENT_TIMESTAMP, '-1 second') WHERE id = " . (int) $secondReady['match_id']);
matchmaking_check(matchmaking_status($pdo, 1)['state'] === 'active', 'Both players enter the active match after the countdown');

leave_matchmaking($pdo, 1);
matchmaking_check(matchmaking_status($pdo, 1)['state'] === 'idle', 'Leaving cancels an online match');
matchmaking_check(matchmaking_status($pdo, 2)['state'] === 'idle', 'The opponent is released from a cancelled online match');

join_matchmaking($pdo, 3);
$pdo->exec("UPDATE matchmaking_queue SET last_seen_at = '2000-01-01 00:00:00' WHERE user_id = 3");
matchmaking_cleanup($pdo, 30);
matchmaking_check(matchmaking_status($pdo, 3)['state'] === 'idle', 'Inactive queue entries are cleaned up');

join_matchmaking($pdo, 4);
$disconnectMatch = join_matchmaking($pdo, 5);
$pdo->exec("UPDATE multiplayer_match_presence SET last_seen_at = '2000-01-01 00:00:00' WHERE match_id = " . (int) $disconnectMatch['match_id'] . ' AND user_id = 5');
$disconnected = matchmaking_status($pdo, 4, true);
matchmaking_check($disconnected['state'] === 'idle' && $disconnected['reason'] === 'opponent_disconnected', 'A disconnected opponent cancels only the affected online match');
