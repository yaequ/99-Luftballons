<?php

declare(strict_types=1);

require_once __DIR__ . '/game-results-schema.php';

const MULTIPLAYER_EVENT_LIMIT = 200;

function ensure_multiplayer_sync_tables(PDO $pdo): void
{
    ensure_game_results_schema($pdo);
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
        $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_game_snapshots (
            match_id INTEGER PRIMARY KEY,
            event_id INTEGER NOT NULL DEFAULT 0,
            source_side INTEGER NOT NULL,
            round_number INTEGER NOT NULL DEFAULT 0,
            state_payload TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_match_outcomes (
            match_id INTEGER PRIMARY KEY,
            winner_side INTEGER DEFAULT NULL,
            reason TEXT NOT NULL,
            reported_by_side INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_result_records (
            match_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            game_result_id INTEGER NOT NULL,
            PRIMARY KEY (match_id, user_id),
            FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (game_result_id) REFERENCES game_results(id) ON DELETE CASCADE
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

    $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_game_snapshots (
        match_id BIGINT UNSIGNED PRIMARY KEY,
        event_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
        source_side TINYINT UNSIGNED NOT NULL,
        round_number TINYINT UNSIGNED NOT NULL DEFAULT 0,
        state_payload MEDIUMTEXT NOT NULL,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        CONSTRAINT fk_multiplayer_game_snapshot_match FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_match_outcomes (
        match_id BIGINT UNSIGNED PRIMARY KEY,
        winner_side TINYINT UNSIGNED DEFAULT NULL,
        reason VARCHAR(24) NOT NULL,
        reported_by_side TINYINT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_multiplayer_match_outcome_match FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_result_records (
        match_id BIGINT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        game_result_id BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (match_id, user_id),
        UNIQUE KEY uq_multiplayer_game_result (game_result_id),
        CONSTRAINT fk_multiplayer_result_match FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
        CONSTRAINT fk_multiplayer_result_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_multiplayer_result_game FOREIGN KEY (game_result_id) REFERENCES game_results(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

}

function multiplayer_sync_match(PDO $pdo, int $matchId, int $userId, bool $lock = false): array
{
    $sql = "SELECT id, player_one_id, player_two_id, status FROM multiplayer_matches
        WHERE id = ? AND (player_one_id = ? OR player_two_id = ?) AND status IN ('active', 'completed') LIMIT 1";
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

function multiplayer_enforce_action_rate(PDO $pdo, int $matchId, int $side): void
{
    $recentSql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
        ? "SELECT COUNT(*) FROM multiplayer_game_events WHERE match_id = ? AND actor_side = ? AND created_at >= datetime(CURRENT_TIMESTAMP, '-1 second')"
        : 'SELECT COUNT(*) FROM multiplayer_game_events WHERE match_id = ? AND actor_side = ? AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)';
    $recent = $pdo->prepare($recentSql); $recent->execute([$matchId, $side]);
    if ((int) $recent->fetchColumn() >= 20) throw new DomainException('Zu viele Spielaktionen in kurzer Zeit.');
    $total = $pdo->prepare('SELECT COUNT(*) FROM multiplayer_game_events WHERE match_id = ?'); $total->execute([$matchId]);
    if ((int) $total->fetchColumn() >= 20000) throw new DomainException('Das Aktionslimit dieses Matches wurde erreicht.');
}

function multiplayer_record_action(PDO $pdo, int $matchId, int $userId, string $action, string $actionId, array $input): void
{
    if (!multiplayer_valid_action_id($actionId)) throw new InvalidArgumentException('Ungültige Aktions-ID.');
    $pdo->beginTransaction();
    try {
        $match = multiplayer_sync_match($pdo, $matchId, $userId, true);
        $side = multiplayer_sync_side($match, $userId);
        if ($match['status'] !== 'active') throw new DomainException('Das Online-Match ist bereits beendet.');
        multiplayer_assert_unfinished($pdo, $matchId);
        multiplayer_enforce_action_rate($pdo, $matchId, $side);
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
        if ($match['status'] !== 'active') throw new DomainException('Das Online-Match ist bereits beendet.');
        multiplayer_assert_unfinished($pdo, $matchId);
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

function multiplayer_validate_snapshot(array $snapshot): void
{
    if (($snapshot['version'] ?? null) !== 1) throw new InvalidArgumentException('Unbekannte Snapshot-Version.');
    $eventId = filter_var($snapshot['eventId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
    $round = filter_var($snapshot['currentRound'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 30]]);
    $seconds = filter_var($snapshot['secondsElapsed'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 86400]]);
    if ($eventId === false || $round === false || $seconds === false) throw new InvalidArgumentException('Ungültiger Snapshot-Fortschritt.');
    if (!in_array($snapshot['roundStatus'] ?? null, ['ready', 'spawning', 'clearing', 'completed'], true)) throw new InvalidArgumentException('Ungültiger Rundenstatus.');
    foreach ([1, 2] as $side) {
        $sideState = $snapshot['sides'][(string) $side] ?? $snapshot['sides'][$side] ?? null;
        $wave = $snapshot['waves'][(string) $side] ?? $snapshot['waves'][$side] ?? null;
        if (!is_array($sideState) || !is_array($wave)) throw new InvalidArgumentException('Snapshot-Seiten fehlen.');
        $hp = filter_var($sideState['hp'] ?? null, FILTER_VALIDATE_FLOAT);
        $gold = filter_var($sideState['gold'] ?? null, FILTER_VALIDATE_FLOAT);
        $income = filter_var($sideState['income'] ?? null, FILTER_VALIDATE_FLOAT);
        if ($hp === false || $hp < 0 || $hp > 99 || $gold === false || $gold < -1000 || $gold > 10000000 || $income === false || $income < 0 || $income > 100000) {
            throw new InvalidArgumentException('Ungültige Ressourcen im Snapshot.');
        }
        $towers = $sideState['towers'] ?? null; $balloons = $sideState['balloons'] ?? null; $queue = $sideState['sendQueue'] ?? null;
        if (!is_array($towers) || count($towers) > 100 || !is_array($balloons) || count($balloons) > 1500 || !is_array($queue) || count($queue) > 100) {
            throw new InvalidArgumentException('Snapshot enthält zu viele Spielelemente.');
        }
        foreach ($towers as $tower) {
            if (!is_array($tower) || !in_array($tower['type'] ?? null, ['cactus', 'fan', 'lens'], true)) throw new InvalidArgumentException('Ungültiger Turm im Snapshot.');
            $x = filter_var($tower['x'] ?? null, FILTER_VALIDATE_FLOAT); $y = filter_var($tower['y'] ?? null, FILTER_VALIDATE_FLOAT);
            if ($x === false || $y === false || $x < 0 || $x > 320 || $y < 0 || $y > 240) throw new InvalidArgumentException('Ungültige Turmposition im Snapshot.');
            $inside = false;
            foreach (multiplayer_build_zones($side) as $zone) {
                if ($x >= $zone['x'] && $x <= $zone['x'] + $zone['w'] && $y >= $zone['y'] && $y <= $zone['y'] + $zone['h']) { $inside = true; break; }
            }
            if (!$inside) throw new InvalidArgumentException('Ein Snapshot-Turm liegt außerhalb der Bauflächen.');
        }
        foreach ($balloons as $balloon) {
            if (!is_array($balloon) || !in_array($balloon['type'] ?? null, ['red', 'blue', 'green', 'yellow', 'boss'], true)) throw new InvalidArgumentException('Ungültiger Ballon im Snapshot.');
        }
        if (!is_array($wave['groups'] ?? null) || count($wave['groups']) > 1500) throw new InvalidArgumentException('Ungültige Welle im Snapshot.');
    }
}

function multiplayer_snapshot(PDO $pdo, int $matchId): ?array
{
    $query = $pdo->prepare('SELECT event_id, source_side, state_payload, updated_at FROM multiplayer_game_snapshots WHERE match_id = ? LIMIT 1');
    $query->execute([$matchId]);
    $row = $query->fetch();
    if ($row === false) return null;
    $state = json_decode((string) $row['state_payload'], true, 32, JSON_THROW_ON_ERROR);
    return ['event_id' => (int) $row['event_id'], 'source_side' => (int) $row['source_side'], 'state' => $state, 'updated_at' => (string) $row['updated_at']];
}

function multiplayer_store_snapshot(PDO $pdo, int $matchId, int $userId, string $snapshotJson): void
{
    if ($snapshotJson === '' || strlen($snapshotJson) > 350000) throw new InvalidArgumentException('Der Spielstand ist ungültig oder zu groß.');
    try {
        $snapshot = json_decode($snapshotJson, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new InvalidArgumentException('Ungültiges Snapshot-Format.');
    }
    if (!is_array($snapshot)) throw new InvalidArgumentException('Ungültiger Spielstand.');
    multiplayer_validate_snapshot($snapshot);

    $autoResult = null;
    $pdo->beginTransaction();
    try {
        $match = multiplayer_sync_match($pdo, $matchId, $userId, true);
        $side = multiplayer_sync_side($match, $userId);
        if ((int) ($snapshot['ownSide'] ?? 0) !== $side) throw new InvalidArgumentException('Der Snapshot gehört zur falschen Spielerseite.');
        $ownState = $snapshot['sides'][(string) $side] ?? $snapshot['sides'][$side];
        if ((float) ($ownState['hp'] ?? 99) <= 0) $autoResult = 'loss';
        elseif ((int) $snapshot['currentRound'] === 30 && $snapshot['roundStatus'] === 'completed') $autoResult = 'survived';
        $eventId = (int) $snapshot['eventId'];
        $latest = $pdo->prepare('SELECT COALESCE(MAX(id), 0) FROM multiplayer_game_events WHERE match_id = ?');
        $latest->execute([$matchId]);
        if ($eventId > (int) $latest->fetchColumn()) throw new InvalidArgumentException('Der Snapshot verweist auf unbekannte Aktionen.');

        $currentSql = 'SELECT event_id, state_payload FROM multiplayer_game_snapshots WHERE match_id = ?';
        if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'sqlite') $currentSql .= ' FOR UPDATE';
        $currentQuery = $pdo->prepare($currentSql); $currentQuery->execute([$matchId]); $current = $currentQuery->fetch();
        $currentSeconds = -1;
        if ($current !== false) {
            $decoded = json_decode((string) $current['state_payload'], true);
            $currentSeconds = is_array($decoded) ? (int) ($decoded['secondsElapsed'] ?? -1) : -1;
        }
        $shouldStore = $current === false || $eventId > (int) $current['event_id'] || ($eventId === (int) $current['event_id'] && (int) $snapshot['secondsElapsed'] >= $currentSeconds);
        if ($shouldStore) {
            $encoded = json_encode($snapshot, JSON_THROW_ON_ERROR);
            if ($current === false) {
                $write = $pdo->prepare('INSERT INTO multiplayer_game_snapshots (match_id, event_id, source_side, round_number, state_payload) VALUES (?, ?, ?, ?, ?)');
            } else {
                $write = $pdo->prepare('UPDATE multiplayer_game_snapshots SET event_id = ?, source_side = ?, round_number = ?, state_payload = ?, updated_at = CURRENT_TIMESTAMP WHERE match_id = ?');
            }
            $current === false
                ? $write->execute([$matchId, $eventId, $side, (int) $snapshot['currentRound'], $encoded])
                : $write->execute([$eventId, $side, (int) $snapshot['currentRound'], $encoded, $matchId]);

            $sideOne = $snapshot['sides']['1'] ?? $snapshot['sides'][1]; $sideTwo = $snapshot['sides']['2'] ?? $snapshot['sides'][2];
            $state = $pdo->prepare('UPDATE multiplayer_match_state SET round_number = ?, player_one_hp = ?, player_one_gold = ?, player_one_income = ?, player_two_hp = ?, player_two_gold = ?, player_two_income = ? WHERE match_id = ?');
            $state->execute([(int) $snapshot['currentRound'], (int) $sideOne['hp'], max(0, (int) $sideOne['gold']), (int) $sideOne['income'], (int) $sideTwo['hp'], max(0, (int) $sideTwo['gold']), (int) $sideTwo['income'], $matchId]);
        }
        $pdo->commit();
        if ($autoResult !== null) multiplayer_report_result($pdo, $matchId, $userId, $autoResult);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function multiplayer_outcome(PDO $pdo, int $matchId): ?array
{
    $query = $pdo->prepare('SELECT winner_side, reason, reported_by_side, created_at FROM multiplayer_match_outcomes WHERE match_id = ? LIMIT 1');
    $query->execute([$matchId]);
    $row = $query->fetch();
    if ($row === false) return null;
    return ['winner_side' => $row['winner_side'] === null ? null : (int) $row['winner_side'], 'reason' => (string) $row['reason'], 'reported_by_side' => (int) $row['reported_by_side'], 'created_at' => (string) $row['created_at']];
}

function multiplayer_assert_unfinished(PDO $pdo, int $matchId): void
{
    if (multiplayer_outcome($pdo, $matchId) !== null) throw new DomainException('Das Online-Match ist bereits beendet.');
}

function multiplayer_report_result(PDO $pdo, int $matchId, int $userId, string $result): void
{
    if (!in_array($result, ['loss', 'survived'], true)) throw new InvalidArgumentException('Ungültiges Match-Ergebnis.');
    $pdo->beginTransaction();
    try {
        $match = multiplayer_sync_match($pdo, $matchId, $userId, true);
        $reportingSide = multiplayer_sync_side($match, $userId);
        $winnerSide = $reportingSide === 1 ? 2 : 1;
        $reason = 'base_destroyed';
        if ($result === 'survived') {
            $snapshot = multiplayer_snapshot($pdo, $matchId);
            $state = $snapshot['state'] ?? null;
            if (!is_array($state) || (int) ($state['currentRound'] ?? 0) < 30 || ($state['roundStatus'] ?? '') !== 'completed') {
                throw new DomainException('Die letzte Runde ist serverseitig noch nicht abgeschlossen.');
            }
            $hpOne = (float) ($state['sides']['1']['hp'] ?? -1); $hpTwo = (float) ($state['sides']['2']['hp'] ?? -1);
            $winnerSide = $hpOne === $hpTwo ? null : ($hpOne > $hpTwo ? 1 : 2);
            $reason = 'waves_survived';
        }
        $existing = multiplayer_outcome($pdo, $matchId);
        if ($existing === null) {
            $insert = $pdo->prepare('INSERT INTO multiplayer_match_outcomes (match_id, winner_side, reason, reported_by_side) VALUES (?, ?, ?, ?)');
            $insert->execute([$matchId, $winnerSide, $reason, $reportingSide]);
            $complete = $pdo->prepare("UPDATE multiplayer_matches SET status = 'completed', ended_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'");
            $complete->execute([$matchId]);
        }
        $finalWinner = $existing === null ? $winnerSide : ($existing['winner_side'] === null ? null : (int) $existing['winner_side']);
        multiplayer_save_results($pdo, $match, $matchId, $finalWinner);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function multiplayer_save_results(PDO $pdo, array $match, int $matchId, ?int $winnerSide): void
{
    $snapshot = multiplayer_snapshot($pdo, $matchId);
    $snapshotState = $snapshot['state'] ?? [];
    $duration = max(0, min(86400, (int) ($snapshotState['secondsElapsed'] ?? 0)));
    $round = max(0, min(30, (int) ($snapshotState['currentRound'] ?? 0)));
    $players = [1 => (int) $match['player_one_id'], 2 => (int) $match['player_two_id']];
    $exists = $pdo->prepare('SELECT game_result_id FROM multiplayer_result_records WHERE match_id = ? AND user_id = ? LIMIT 1');
    $insertResult = $pdo->prepare("INSERT INTO game_results (user_id, result, game_mode, duration_seconds, round_reached) VALUES (?, ?, 'multiplayer', ?, ?)");
    $insertLink = $pdo->prepare('INSERT INTO multiplayer_result_records (match_id, user_id, game_result_id) VALUES (?, ?, ?)');
    foreach ($players as $side => $playerId) {
        $exists->execute([$matchId, $playerId]);
        if ($exists->fetchColumn() !== false) continue;
        $result = $winnerSide === null ? 'draw' : ($winnerSide === $side ? 'win' : 'loss');
        $insertResult->execute([$playerId, $result, $duration, $round]);
        $insertLink->execute([$matchId, $playerId, (int) $pdo->lastInsertId()]);
    }
}

function multiplayer_result_saved(PDO $pdo, int $matchId, int $userId): bool
{
    $query = $pdo->prepare('SELECT COUNT(*) FROM multiplayer_result_records WHERE match_id = ? AND user_id = ?');
    $query->execute([$matchId, $userId]);
    return (int) $query->fetchColumn() === 1;
}
