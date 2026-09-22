<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();
require __DIR__ . '/db.php';
require_once __DIR__ . '/account-security.php';
require_once __DIR__ . '/matchmaking.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    $userId = (int) $_SESSION['user_id'];
    if ((int) ($_SESSION['matchmaking_schema_version'] ?? 0) < 3) {
        ensure_matchmaking_tables($pdo);
        $_SESSION['matchmaking_schema_version'] = 3;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        matchmaking_cleanup($pdo);
        echo json_encode(matchmaking_status($pdo, $userId, true), JSON_THROW_ON_ERROR);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        header('Allow: GET, POST');
        echo json_encode(['error' => 'Methode nicht erlaubt.'], JSON_THROW_ON_ERROR);
        exit;
    }

    if (!valid_csrf($_POST)) {
        http_response_code(403);
        echo json_encode(['error' => 'Die Anfrage ist abgelaufen. Bitte lade die Seite neu.'], JSON_THROW_ON_ERROR);
        exit;
    }

    $action = is_string($_POST['action'] ?? null) ? $_POST['action'] : '';
    if ($action === 'join') {
        $result = join_matchmaking($pdo, $userId);
    } elseif ($action === 'ready') {
        $result = ready_multiplayer_match($pdo, $userId);
    } elseif ($action === 'leave') {
        $result = leave_matchmaking($pdo, $userId);
    } elseif ($action === 'build_tower') {
        $towerType = is_string($_POST['tower_type'] ?? null) ? $_POST['tower_type'] : '';
        $slot = filter_var($_POST['slot'] ?? null, FILTER_VALIDATE_INT);
        if ($slot === false) throw new InvalidArgumentException('Ungültiger Bauplatz.');
        $result = multiplayer_build_tower($pdo, $userId, $towerType, (int) $slot);
    } elseif ($action === 'send_balloons') {
        $balloonType = is_string($_POST['balloon_type'] ?? null) ? $_POST['balloon_type'] : '';
        $result = multiplayer_send_balloons($pdo, $userId, $balloonType);
    } elseif ($action === 'start_round') {
        $result = multiplayer_start_round($pdo, $userId);
    } else {
        http_response_code(422);
        echo json_encode(['error' => 'Unbekannte Matchmaking-Aktion.'], JSON_THROW_ON_ERROR);
        exit;
    }

    echo json_encode($result, JSON_THROW_ON_ERROR);
} catch (InvalidArgumentException | DomainException $error) {
    http_response_code(422);
    echo json_encode(['error' => $error->getMessage()], JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    error_log('Matchmaking error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Die Online-Lobby ist momentan nicht erreichbar.'], JSON_THROW_ON_ERROR);
}
