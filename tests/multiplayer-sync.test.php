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
ensure_multiplayer_match_state($pdo, 1);
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

$sideState = static fn(int $hp, int $gold): array => [
    'hp' => $hp, 'gold' => $gold, 'income' => 5, 'sendClock' => 0,
    'towers' => [], 'balloons' => [], 'sendQueue' => [],
];
$waveState = ['groups' => [], 'groupIndex' => 0, 'remainingInGroup' => 0, 'spawnClock' => 0, 'remaining' => 0, 'doneSpawning' => true];
$snapshot = [
    'version' => 1, 'eventId' => (int) end($roundEvents)['id'], 'ownSide' => 1,
    'active' => true, 'paused' => false, 'secondsElapsed' => 10, 'economyClock' => 0.4,
    'currentRound' => 1, 'roundStatus' => 'spawning',
    'sides' => ['1' => $sideState(91, 120), '2' => $sideState(88, 140)],
    'waves' => ['1' => $waveState, '2' => $waveState],
];
multiplayer_store_snapshot($pdo, 1, 1, json_encode($snapshot, JSON_THROW_ON_ERROR));
$stored = multiplayer_snapshot($pdo, 1);
sync_check($stored !== null && $stored['event_id'] === $snapshot['eventId'], 'A versioned snapshot is persisted with its event cursor');
sync_check($stored['state']['sides']['1']['hp'] === 91 && $stored['state']['currentRound'] === 1, 'A snapshot preserves health, resources and round progress');

$older = $snapshot; $older['ownSide'] = 2; $older['secondsElapsed'] = 9; $older['sides']['1']['hp'] = 1;
multiplayer_store_snapshot($pdo, 1, 2, json_encode($older, JSON_THROW_ON_ERROR));
sync_check(multiplayer_snapshot($pdo, 1)['state']['sides']['1']['hp'] === 91, 'A less advanced browser cannot overwrite a newer snapshot at the same event cursor');

$futureRejected = false;
try {
    $future = $snapshot; $future['eventId'] = 9999;
    multiplayer_store_snapshot($pdo, 1, 1, json_encode($future, JSON_THROW_ON_ERROR));
} catch (InvalidArgumentException) {
    $futureRejected = true;
}
sync_check($futureRejected, 'The server rejects snapshots that skip unknown actions');

multiplayer_report_result($pdo, 1, 1, 'loss');
$outcome = multiplayer_outcome($pdo, 1);
sync_check($outcome !== null && $outcome['winner_side'] === 2 && $outcome['reported_by_side'] === 1, 'Reporting only the own destroyed base creates an unambiguous server result');
multiplayer_report_result($pdo, 1, 2, 'loss');
sync_check(multiplayer_outcome($pdo, 1)['winner_side'] === 2, 'A simultaneous later report cannot replace the first committed result');

$finishedRejected = false;
try {
    multiplayer_record_action($pdo, 1, 2, 'send', 'action-after-end-1', ['balloon' => 'blue']);
} catch (DomainException) {
    $finishedRejected = true;
}
sync_check($finishedRejected, 'Gameplay actions are rejected after the server has committed an outcome');

$pdo->exec("INSERT INTO multiplayer_matches (id, player_one_id, player_two_id, status) VALUES (2, 1, 2, 'active')");
ensure_multiplayer_match_state($pdo, 2);
$finalSnapshot = $snapshot;
$finalSnapshot['eventId'] = 0; $finalSnapshot['currentRound'] = 30; $finalSnapshot['roundStatus'] = 'completed';
$finalSnapshot['sides']['1']['hp'] = 70; $finalSnapshot['sides']['2']['hp'] = 54;
multiplayer_store_snapshot($pdo, 2, 1, json_encode($finalSnapshot, JSON_THROW_ON_ERROR));
multiplayer_report_result($pdo, 2, 1, 'survived');
sync_check(multiplayer_outcome($pdo, 2)['winner_side'] === 1 && multiplayer_outcome($pdo, 2)['reason'] === 'waves_survived', 'After round thirty the server decides by remaining base health');

$pdo->exec("INSERT INTO multiplayer_matches (id, player_one_id, player_two_id, status) VALUES (3, 1, 2, 'active')");
ensure_multiplayer_match_state($pdo, 3);
for ($index = 0; $index < 20; $index++) {
    multiplayer_record_action($pdo, 3, 1, 'send', 'rate-action-' . str_pad((string) $index, 5, '0', STR_PAD_LEFT), ['balloon' => 'red']);
}
$rateRejected = false;
try {
    multiplayer_record_action($pdo, 3, 1, 'send', 'rate-action-99999', ['balloon' => 'red']);
} catch (DomainException) {
    $rateRejected = true;
}
sync_check($rateRejected, 'Server-side rate limiting blocks automated action flooding');
