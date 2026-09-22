<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();
require __DIR__ . '/db.php';
require_once __DIR__ . '/account-security.php';
require_once __DIR__ . '/matchmaking.php';
require_once __DIR__ . '/multiplayer-sync.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    $userId = (int) $_SESSION['user_id'];
    if ((int) ($_SESSION['multiplayer_sync_schema_version'] ?? 0) < 5) {
        ensure_multiplayer_sync_tables($pdo);
        $_SESSION['multiplayer_sync_schema_version'] = 5;
    }
    $input = $_SERVER['REQUEST_METHOD'] === 'POST' ? $_POST : $_GET;
    $matchId = filter_var($input['match_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $afterId = filter_var($input['after'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
    if ($matchId === false || $afterId === false) throw new InvalidArgumentException('Ungültige Match-Anfrage.');
    $match = multiplayer_sync_match($pdo, (int) $matchId, $userId);
    $side = multiplayer_sync_side($match, $userId);
    $snapshot = (int) $afterId === 0 ? multiplayer_snapshot($pdo, (int) $matchId) : null;

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!valid_csrf($_POST)) {
            http_response_code(403);
            echo json_encode(['error' => 'Die Anfrage ist abgelaufen. Bitte lade die Seite neu.'], JSON_THROW_ON_ERROR);
            exit;
        }
        $action = is_string($_POST['action'] ?? null) ? $_POST['action'] : '';
        if ($action === 'snapshot') {
            $snapshotJson = is_string($_POST['snapshot'] ?? null) ? $_POST['snapshot'] : '';
            multiplayer_store_snapshot($pdo, (int) $matchId, $userId, $snapshotJson);
        } elseif ($action === 'report_result') {
            $result = is_string($_POST['result'] ?? null) ? $_POST['result'] : '';
            multiplayer_report_result($pdo, (int) $matchId, $userId, $result);
        } elseif ($action === 'ready_round') {
            multiplayer_ready_round($pdo, (int) $matchId, $userId);
        } else {
            $actionId = is_string($_POST['action_id'] ?? null) ? $_POST['action_id'] : '';
            multiplayer_record_action($pdo, (int) $matchId, $userId, $action, $actionId, $_POST);
        }
    } elseif ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        throw new DomainException('Methode nicht erlaubt.');
    }

    $eventCursor = $snapshot !== null ? max((int) $afterId, (int) $snapshot['event_id']) : (int) $afterId;
    echo json_encode([
        'match_id' => (int) $matchId,
        'side' => $side,
        'snapshot' => $snapshot,
        'events' => multiplayer_sync_events($pdo, (int) $matchId, $eventCursor),
        'ready' => multiplayer_readiness($pdo, (int) $matchId, $side),
        'outcome' => multiplayer_outcome($pdo, (int) $matchId),
        'result_saved' => multiplayer_result_saved($pdo, (int) $matchId, $userId),
        'server_time' => round(microtime(true) * 1000),
    ], JSON_THROW_ON_ERROR);
} catch (InvalidArgumentException | DomainException $error) {
    http_response_code(422);
    echo json_encode(['error' => $error->getMessage()], JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    error_log('Multiplayer game sync error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Die Spielaktion konnte nicht synchronisiert werden.'], JSON_THROW_ON_ERROR);
}
