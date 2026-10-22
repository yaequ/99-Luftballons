<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();
require __DIR__ . '/db.php';
require_once __DIR__ . '/account-security.php';
require_once __DIR__ . '/first-round-tutorial.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Methode nicht erlaubt.']);
    exit;
}
if (!valid_csrf($_POST)) {
    http_response_code(403);
    echo json_encode(['error' => 'Die Anfrage ist abgelaufen.']);
    exit;
}

try {
    $userId = (int) $_SESSION['user_id'];
    $action = $_POST['action'] ?? '';
    if ($action === 'begin') {
        echo json_encode(['show' => should_show_first_round_tutorial($pdo, $userId)], JSON_THROW_ON_ERROR);
    } elseif ($action === 'complete') {
        complete_first_round_tutorial($pdo, $userId);
        echo json_encode(['completed' => true], JSON_THROW_ON_ERROR);
    } else {
        http_response_code(422);
        echo json_encode(['error' => 'Unbekannte Tutorial-Aktion.'], JSON_THROW_ON_ERROR);
    }
} catch (Throwable $error) {
    error_log('First-round tutorial error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Das Tutorial konnte nicht geladen werden.'], JSON_THROW_ON_ERROR);
}
