<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();
require __DIR__ . '/db.php';

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false]);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false]);
    exit;
}

$result = $data['result'] ?? null;
$duration = $data['duration_seconds'] ?? null;
$roundReached = $data['round_reached'] ?? null;

if (!in_array($result, ['win', 'loss'], true)
    || !is_int($duration) || $duration < 0 || $duration > 86400
    || !is_int($roundReached) || $roundReached < 0 || $roundReached > 30) {
    http_response_code(422);
    echo json_encode(['success' => false]);
    exit;
}

$statement = $pdo->prepare(
    'INSERT INTO game_results (user_id, result, duration_seconds, round_reached) VALUES (?, ?, ?, ?)'
);
$statement->execute([$_SESSION['user_id'], $result, $duration, $roundReached]);

echo json_encode(['success' => true]);
