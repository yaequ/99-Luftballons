<?php

declare(strict_types=1);

require_once __DIR__ . '/../matchmaking.php';
require_once __DIR__ . '/../multiplayer-sync.php';

function sync_check(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException('FAIL: ' . $message);
    echo "OK: {$message}\n";
}

$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('PRAGMA foreign_keys = ON');
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE)');
$pdo->exec("INSERT INTO users (id, username) VALUES (1, 'Ada'), (2, 'Bert')");
ensure_matchmaking_tables($pdo);
$pdo->exec("INSERT INTO multiplayer_matches (id, player_one_id, player_two_id, status) VALUES (1, 1, 2, 'active')");
ensure_multiplayer_sync_tables($pdo);
ensure_multiplayer_sync_tables($pdo);

multiplayer_record_action($pdo, 1, 1, 'build', 'action-build-0001', ['tower' => 'cactus', 'x' => 110, 'y' => 30]);
multiplayer_record_action($pdo, 1, 2, 'build', 'action-build-0002', ['tower' => 'fan', 'x' => 100, 'y' => 35]);
multiplayer_record_action($pdo, 1, 1, 'send', 'action-send-00001', ['balloon' => 'red']);
multiplayer_record_action($pdo, 1, 2, 'pause', 'action-pause-0001', ['paused' => '1']);
$events = multiplayer_sync_events($pdo, 1, 0);
sync_check(count($events) === 4, 'Build, attack and pause actions are stored in one ordered event stream');
sync_check($events[0]['side'] === 1 && $events[1]['side'] === 2, 'Events retain the acting player side');
sync_check($events[2]['payload']['balloon'] === 'red' && $events[3]['payload']['paused'] === true, 'Validated event payloads can be replayed by both browsers');

multiplayer_record_action($pdo, 1, 1, 'send', 'action-send-00001', ['balloon' => 'red']);
sync_check(count(multiplayer_sync_events($pdo, 1, 0)) === 4, 'A retried client action is idempotent');

multiplayer_ready_round($pdo, 1, 1);
sync_check(multiplayer_readiness($pdo, 1, 1) === ['you' => true, 'opponent' => false], 'One player can wait ready without starting alone');
multiplayer_ready_round($pdo, 1, 2);
$roundEvents = array_values(array_filter(multiplayer_sync_events($pdo, 1, 0), static fn(array $event): bool => $event['type'] === 'round_start'));
sync_check(count($roundEvents) === 1 && $roundEvents[0]['payload']['round'] === 1, 'The server emits exactly one shared round start after both players confirm');
sync_check(multiplayer_readiness($pdo, 1, 1) === ['you' => false, 'opponent' => false], 'Round readiness is cleared after the synchronized start');

$rejected = false;
try {
    multiplayer_record_action($pdo, 1, 1, 'build', 'action-invalid-01', ['tower' => 'cactus', 'x' => 10, 'y' => 10]);
} catch (InvalidArgumentException) {
    $rejected = true;
}
sync_check($rejected, 'The server rejects tower coordinates outside real build zones');
