<?php

declare(strict_types=1);

const MULTIPLAYER_EVENT_LIMIT = 200;

function ensure_multiplayer_sync_tables(PDO $pdo): void
{
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_game_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER NOT NULL,
            actor_side INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            client_action_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (match_id, actor_side, client_action_id),
            FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
        )");
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_multiplayer_game_events_poll ON multiplayer_game_events(match_id, id)');
        $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_round_readiness (
            match_id INTEGER NOT NULL,
            player_side INTEGER NOT NULL,
            target_round INTEGER NOT NULL,
            ready_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (match_id, player_side),
            FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
        )");
        return;
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_game_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        match_id BIGINT UNSIGNED NOT NULL,
        actor_side TINYINT UNSIGNED NOT NULL,
        event_type VARCHAR(24) NOT NULL,
        client_action_id VARCHAR(64) NOT NULL,
        payload JSON NOT NULL,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        CONSTRAINT fk_multiplayer_game_event_match FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
        UNIQUE KEY uq_multiplayer_client_action (match_id, actor_side, client_action_id),
        INDEX idx_multiplayer_game_events_poll (match_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_round_readiness (
        match_id BIGINT UNSIGNED NOT NULL,
        player_side TINYINT UNSIGNED NOT NULL,
        target_round TINYINT UNSIGNED NOT NULL,
        ready_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (match_id, player_side),
        CONSTRAINT fk_multiplayer_round_readiness_match FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function multiplayer_sync_match(PDO $pdo, int $matchId, int $userId, bool $lock = false): array
{
    $sql = "SELECT id, player_one_id, player_two_id, status FROM multiplayer_matches
        WHERE id = ? AND (player_one_id = ? OR player_two_id = ?) AND status = 'active' LIMIT 1";
    if ($lock && $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'sqlite') $sql .= ' FOR UPDATE';
    $query = $pdo->prepare($sql);
    $query->execute([$matchId, $userId, $userId]);
    $match = $query->fetch();
    if ($match === false) throw new DomainException('Das Online-Match ist nicht mehr aktiv.');
    return $match;
}

function multiplayer_sync_side(array $match, int $userId): int
{
    return (int) $match['player_one_id'] === $userId ? 1 : 2;
}

function multiplayer_sync_events(PDO $pdo, int $matchId, int $afterId): array
{
    $query = $pdo->prepare('SELECT id, actor_side, event_type, payload, created_at FROM multiplayer_game_events WHERE match_id = ? AND id > ? ORDER BY id LIMIT ' . MULTIPLAYER_EVENT_LIMIT);
    $query->execute([$matchId, max(0, $afterId)]);
    $events = [];
    foreach ($query->fetchAll() as $row) {
        $payload = json_decode((string) $row['payload'], true, 16, JSON_THROW_ON_ERROR);
        $events[] = [
            'id' => (int) $row['id'],
            'side' => (int) $row['actor_side'],
            'type' => (string) $row['event_type'],
            'payload' => is_array($payload) ? $payload : [],
            'created_at' => (string) $row['created_at'],
        ];
    }
    return $events;
}

function multiplayer_valid_action_id(string $value): bool
{
    return preg_match('/^[a-zA-Z0-9-]{16,64}$/', $value) === 1;
}

function multiplayer_build_zones(int $side): array
{
    if ($side === 1) {
        $width = 1440; $height = 1080; $crop = 53;
        $zones = [[472,166,258,54],[322,377,273,53],[971,354,154,53],[104,518,48,176],[772,585,258,49],[1291,382,48,223],[846,780,147,139]];
    } else {
        $width = 1024; $height = 765; $crop = 38;
        $zones = [[302,136,204,38],[267,253,195,32],[725,255,85,33],[61,387,56,103],[521,409,186,33],[923,289,38,166],[206,656,269,27],[598,534,117,97]];
    }
    return array_map(static fn(array $zone): array => [
        'x' => $zone[0] / $width * 320,
        'y' => ($zone[1] - $crop) / ($height - $crop) * 240,
        'w' => $zone[2] / $width * 320,
        'h' => $zone[3] / ($height - $crop) * 240,
    ], $zones);
}

function multiplayer_validate_build(PDO $pdo, int $matchId, int $side, string $tower, float $x, float $y): void
{
    if (!in_array($tower, ['cactus', 'fan', 'lens'], true)) throw new InvalidArgumentException('Unbekannter Turm.');
    $inside = false;
    foreach (multiplayer_build_zones($side) as $zone) {
        if ($x >= $zone['x'] && $x <= $zone['x'] + $zone['w'] && $y >= $zone['y'] && $y <= $zone['y'] + $zone['h']) {
            $inside = true;
            break;
        }
    }
    if (!$inside) throw new InvalidArgumentException('Dieser Punkt liegt nicht auf einer Baufläche.');

    $query = $pdo->prepare("SELECT payload FROM multiplayer_game_events WHERE match_id = ? AND actor_side = ? AND event_type = 'build'");
    $query->execute([$matchId, $side]);
    foreach ($query->fetchAll(PDO::FETCH_COLUMN) as $payloadJson) {
        $payload = json_decode((string) $payloadJson, true);
        if (is_array($payload) && hypot((float) ($payload['x'] ?? 0) - $x, (float) ($payload['y'] ?? 0) - $y) < 12) {
            throw new InvalidArgumentException('Dieser Bauplatz ist bereits belegt.');
        }
    }
}

function multiplayer_insert_event(PDO $pdo, int $matchId, int $side, string $type, string $actionId, array $payload): void
{
    $insert = $pdo->prepare('INSERT INTO multiplayer_game_events (match_id, actor_side, event_type, client_action_id, payload) VALUES (?, ?, ?, ?, ?)');
    try {
        $insert->execute([$matchId, $side, $type, $actionId, json_encode($payload, JSON_THROW_ON_ERROR)]);
    } catch (PDOException $error) {
        $duplicate = $pdo->prepare('SELECT COUNT(*) FROM multiplayer_game_events WHERE match_id = ? AND actor_side = ? AND client_action_id = ?');
        $duplicate->execute([$matchId, $side, $actionId]);
        if ((int) $duplicate->fetchColumn() === 0) throw $error;
    }
}

function multiplayer_record_action(PDO $pdo, int $matchId, int $userId, string $action, string $actionId, array $input): void
{
    if (!multiplayer_valid_action_id($actionId)) throw new InvalidArgumentException('Ungültige Aktions-ID.');
    $pdo->beginTransaction();
    try {
        $match = multiplayer_sync_match($pdo, $matchId, $userId, true);
        $side = multiplayer_sync_side($match, $userId);
        if ($action === 'build') {
            $tower = is_string($input['tower'] ?? null) ? $input['tower'] : '';
            $x = filter_var($input['x'] ?? null, FILTER_VALIDATE_FLOAT);
            $y = filter_var($input['y'] ?? null, FILTER_VALIDATE_FLOAT);
            if ($x === false || $y === false) throw new InvalidArgumentException('Ungültige Bauposition.');
            $x = round(max(0, min(320, (float) $x)), 2);
            $y = round(max(0, min(240, (float) $y)), 2);
            multiplayer_validate_build($pdo, $matchId, $side, $tower, $x, $y);
            multiplayer_insert_event($pdo, $matchId, $side, 'build', $actionId, ['tower' => $tower, 'x' => $x, 'y' => $y]);
        } elseif ($action === 'send') {
            $balloon = is_string($input['balloon'] ?? null) ? $input['balloon'] : '';
            if (!in_array($balloon, ['red', 'blue', 'green', 'yellow'], true)) throw new InvalidArgumentException('Unbekannte Ballonart.');
            multiplayer_insert_event($pdo, $matchId, $side, 'send', $actionId, ['balloon' => $balloon]);
        } elseif ($action === 'pause') {
            $paused = filter_var($input['paused'] ?? null, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($paused === null) throw new InvalidArgumentException('Ungültiger Pausenstatus.');
            multiplayer_insert_event($pdo, $matchId, $side, 'pause', $actionId, ['paused' => $paused]);
        } else {
            throw new InvalidArgumentException('Unbekannte Spielaktion.');
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function multiplayer_ready_round(PDO $pdo, int $matchId, int $userId): void
{
    $pdo->beginTransaction();
    try {
        $match = multiplayer_sync_match($pdo, $matchId, $userId, true);
        $side = multiplayer_sync_side($match, $userId);
        $roundQuery = $pdo->prepare("SELECT COUNT(*) FROM multiplayer_game_events WHERE match_id = ? AND event_type = 'round_start'");
        $roundQuery->execute([$matchId]);
        $targetRound = (int) $roundQuery->fetchColumn() + 1;
        if ($targetRound > 30) throw new DomainException('Alle Runden wurden bereits gestartet.');

        $ready = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
            ? $pdo->prepare('INSERT INTO multiplayer_round_readiness (match_id, player_side, target_round) VALUES (?, ?, ?) ON CONFLICT(match_id, player_side) DO UPDATE SET target_round = excluded.target_round, ready_at = CURRENT_TIMESTAMP')
            : $pdo->prepare('INSERT INTO multiplayer_round_readiness (match_id, player_side, target_round) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE target_round = VALUES(target_round), ready_at = CURRENT_TIMESTAMP');
        $ready->execute([$matchId, $side, $targetRound]);
        $count = $pdo->prepare('SELECT COUNT(*) FROM multiplayer_round_readiness WHERE match_id = ? AND target_round = ?');
        $count->execute([$matchId, $targetRound]);
        if ((int) $count->fetchColumn() === 2) {
            multiplayer_insert_event($pdo, $matchId, 0, 'round_start', 'server-round-' . str_pad((string) $targetRound, 4, '0', STR_PAD_LEFT), [
                'round' => $targetRound,
                'seed' => random_int(1, 2147483646),
            ]);
            $clear = $pdo->prepare('DELETE FROM multiplayer_round_readiness WHERE match_id = ?');
            $clear->execute([$matchId]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function multiplayer_readiness(PDO $pdo, int $matchId, int $side): array
{
    $roundQuery = $pdo->prepare("SELECT COUNT(*) FROM multiplayer_game_events WHERE match_id = ? AND event_type = 'round_start'");
    $roundQuery->execute([$matchId]);
    $targetRound = (int) $roundQuery->fetchColumn() + 1;
    $query = $pdo->prepare('SELECT player_side FROM multiplayer_round_readiness WHERE match_id = ? AND target_round = ?');
    $query->execute([$matchId, $targetRound]);
    $readySides = array_map('intval', $query->fetchAll(PDO::FETCH_COLUMN));
    return ['you' => in_array($side, $readySides, true), 'opponent' => in_array($side === 1 ? 2 : 1, $readySides, true)];
}
