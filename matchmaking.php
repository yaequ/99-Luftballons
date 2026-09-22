<?php

declare(strict_types=1);

require_once __DIR__ . '/avatars.php';

const MATCHMAKING_STALE_SECONDS = 120;
const MATCH_PRESENCE_STALE_SECONDS = 45;
const MATCH_COUNTDOWN_SECONDS = 4;
const MULTIPLAYER_INCOME_TICKS_PER_ROUND = 5;

function multiplayer_tower_types(): array
{
    return [
        'cactus' => ['name' => 'Kaktus', 'cost' => 25, 'defense' => 2],
        'fan' => ['name' => 'Gebläse', 'cost' => 45, 'defense' => 4],
        'lens' => ['name' => 'Lupe', 'cost' => 70, 'defense' => 7],
    ];
}

function multiplayer_balloon_types(): array
{
    return [
        'red' => ['name' => 'Rot', 'cost' => 10, 'income' => 1, 'attack' => 3],
        'blue' => ['name' => 'Blau', 'cost' => 25, 'income' => 2, 'attack' => 6],
        'green' => ['name' => 'Grün', 'cost' => 45, 'income' => 4, 'attack' => 10],
        'yellow' => ['name' => 'Gelb', 'cost' => 70, 'income' => 7, 'attack' => 16],
    ];
}

function ensure_matchmaking_tables(PDO $pdo): void
{
    ensure_user_profiles_table($pdo);
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_one_id INTEGER NOT NULL,
            player_two_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'matched',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            started_at TEXT DEFAULT NULL,
            ended_at TEXT DEFAULT NULL,
            FOREIGN KEY (player_one_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (player_two_id) REFERENCES users(id) ON DELETE CASCADE
        )");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_multiplayer_matches_player_one ON multiplayer_matches(player_one_id, status)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_multiplayer_matches_player_two ON multiplayer_matches(player_two_id, status)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS matchmaking_queue (
            user_id INTEGER PRIMARY KEY,
            joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_order ON matchmaking_queue(joined_at, user_id)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_match_presence (
            match_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            ready_at TEXT DEFAULT NULL,
            last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (match_id, user_id),
            FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_match_state (
            match_id INTEGER PRIMARY KEY,
            round_number INTEGER NOT NULL DEFAULT 0,
            total_rounds INTEGER NOT NULL DEFAULT 30,
            player_one_hp INTEGER NOT NULL DEFAULT 99,
            player_one_gold INTEGER NOT NULL DEFAULT 100,
            player_one_income INTEGER NOT NULL DEFAULT 5,
            player_two_hp INTEGER NOT NULL DEFAULT 99,
            player_two_gold INTEGER NOT NULL DEFAULT 100,
            player_two_income INTEGER NOT NULL DEFAULT 5,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_towers (
            match_id INTEGER NOT NULL,
            player_side INTEGER NOT NULL,
            slot_index INTEGER NOT NULL,
            tower_type TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (match_id, player_side, slot_index),
            FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_attacks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER NOT NULL,
            sender_side INTEGER NOT NULL,
            balloon_type TEXT NOT NULL,
            target_round INTEGER NOT NULL,
            resolved_at TEXT DEFAULT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_round_ready (
            match_id INTEGER NOT NULL,
            player_side INTEGER NOT NULL,
            target_round INTEGER NOT NULL,
            ready_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (match_id, player_side),
            FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER NOT NULL,
            event_text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
        )");
        return;
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_matches (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        player_one_id INT UNSIGNED NOT NULL,
        player_two_id INT UNSIGNED NOT NULL,
        status ENUM('matched', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'matched',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME DEFAULT NULL,
        ended_at DATETIME DEFAULT NULL,
        CONSTRAINT fk_multiplayer_player_one FOREIGN KEY (player_one_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_multiplayer_player_two FOREIGN KEY (player_two_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_multiplayer_player_one (player_one_id, status),
        INDEX idx_multiplayer_player_two (player_two_id, status),
        INDEX idx_multiplayer_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS matchmaking_queue (
        user_id INT UNSIGNED PRIMARY KEY,
        joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_matchmaking_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_matchmaking_order (joined_at, user_id),
        INDEX idx_matchmaking_last_seen (last_seen_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_match_presence (
        match_id BIGINT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        ready_at DATETIME DEFAULT NULL,
        last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (match_id, user_id),
        CONSTRAINT fk_match_presence_match FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
        CONSTRAINT fk_match_presence_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_match_presence_seen (match_id, last_seen_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_match_state (
        match_id BIGINT UNSIGNED PRIMARY KEY,
        round_number TINYINT UNSIGNED NOT NULL DEFAULT 0,
        total_rounds TINYINT UNSIGNED NOT NULL DEFAULT 30,
        player_one_hp TINYINT UNSIGNED NOT NULL DEFAULT 99,
        player_one_gold INT UNSIGNED NOT NULL DEFAULT 100,
        player_one_income INT UNSIGNED NOT NULL DEFAULT 5,
        player_two_hp TINYINT UNSIGNED NOT NULL DEFAULT 99,
        player_two_gold INT UNSIGNED NOT NULL DEFAULT 100,
        player_two_income INT UNSIGNED NOT NULL DEFAULT 5,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_match_state_match FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_towers (
        match_id BIGINT UNSIGNED NOT NULL,
        player_side TINYINT UNSIGNED NOT NULL,
        slot_index TINYINT UNSIGNED NOT NULL,
        tower_type VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (match_id, player_side, slot_index),
        CONSTRAINT fk_multiplayer_tower_match FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_attacks (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        match_id BIGINT UNSIGNED NOT NULL,
        sender_side TINYINT UNSIGNED NOT NULL,
        balloon_type VARCHAR(20) NOT NULL,
        target_round TINYINT UNSIGNED NOT NULL,
        resolved_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_multiplayer_attack_match FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
        INDEX idx_multiplayer_attack_round (match_id, target_round, resolved_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_round_ready (
        match_id BIGINT UNSIGNED NOT NULL,
        player_side TINYINT UNSIGNED NOT NULL,
        target_round TINYINT UNSIGNED NOT NULL,
        ready_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (match_id, player_side),
        CONSTRAINT fk_multiplayer_round_ready_match FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS multiplayer_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        match_id BIGINT UNSIGNED NOT NULL,
        event_text VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_multiplayer_event_match FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
        INDEX idx_multiplayer_event_match (match_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function matchmaking_cleanup(PDO $pdo, int $staleSeconds = MATCHMAKING_STALE_SECONDS): void
{
    $staleSeconds = max(30, $staleSeconds);
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $query = $pdo->prepare("DELETE FROM matchmaking_queue WHERE last_seen_at < datetime(CURRENT_TIMESTAMP, ?)");
        $query->execute(['-' . $staleSeconds . ' seconds']);
        return;
    }

    $pdo->exec('DELETE FROM matchmaking_queue WHERE last_seen_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ' . $staleSeconds . ' SECOND)');
}

function ensure_match_presence(PDO $pdo, int $matchId, array $playerIds): void
{
    $sqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
    $insert = $sqlite
        ? $pdo->prepare('INSERT OR IGNORE INTO multiplayer_match_presence (match_id, user_id) VALUES (?, ?)')
        : $pdo->prepare('INSERT IGNORE INTO multiplayer_match_presence (match_id, user_id) VALUES (?, ?)');

    foreach ($playerIds as $playerId) {
        $insert->execute([$matchId, (int) $playerId]);
    }
}

function ensure_multiplayer_match_state(PDO $pdo, int $matchId): void
{
    $query = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
        ? $pdo->prepare('INSERT OR IGNORE INTO multiplayer_match_state (match_id) VALUES (?)')
        : $pdo->prepare('INSERT IGNORE INTO multiplayer_match_state (match_id) VALUES (?)');
    $query->execute([$matchId]);
}

function match_starts_in_ms(PDO $pdo, int $matchId): int
{
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $query = $pdo->prepare('SELECT MAX(0, CAST((julianday(started_at) - julianday(CURRENT_TIMESTAMP)) * 86400000 AS INTEGER)) FROM multiplayer_matches WHERE id = ?');
    } else {
        $query = $pdo->prepare('SELECT GREATEST(0, TIMESTAMPDIFF(MICROSECOND, CURRENT_TIMESTAMP, started_at) DIV 1000) FROM multiplayer_matches WHERE id = ?');
    }
    $query->execute([$matchId]);
    return max(0, (int) $query->fetchColumn());
}

function multiplayer_match_for_user(PDO $pdo, int $userId, bool $lock = false): ?array
{
    $sql = "SELECT id, player_one_id, player_two_id, status FROM multiplayer_matches
        WHERE (player_one_id = ? OR player_two_id = ?) AND status = 'active'
        ORDER BY id DESC LIMIT 1";
    if ($lock && $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'sqlite') {
        $sql .= ' FOR UPDATE';
    }
    $query = $pdo->prepare($sql);
    $query->execute([$userId, $userId]);
    $match = $query->fetch();
    return $match === false ? null : $match;
}

function multiplayer_side(array $match, int $userId): int
{
    return (int) $match['player_one_id'] === $userId ? 1 : 2;
}

function multiplayer_live_details(PDO $pdo, int $matchId, int $side, int $round): array
{
    $towerQuery = $pdo->prepare('SELECT player_side, slot_index, tower_type FROM multiplayer_towers WHERE match_id = ? ORDER BY player_side, slot_index');
    $towerQuery->execute([$matchId]);
    $towers = ['you' => [], 'opponent' => []];
    foreach ($towerQuery->fetchAll() as $tower) {
        $owner = (int) $tower['player_side'] === $side ? 'you' : 'opponent';
        $towers[$owner][] = ['slot' => (int) $tower['slot_index'], 'type' => (string) $tower['tower_type']];
    }

    $attackQuery = $pdo->prepare('SELECT sender_side, balloon_type, COUNT(*) AS batches FROM multiplayer_attacks WHERE match_id = ? AND target_round = ? AND resolved_at IS NULL GROUP BY sender_side, balloon_type');
    $attackQuery->execute([$matchId, $round + 1]);
    $attacks = ['you' => [], 'opponent' => []];
    foreach ($attackQuery->fetchAll() as $attack) {
        $sender = (int) $attack['sender_side'] === $side ? 'you' : 'opponent';
        $attacks[$sender][(string) $attack['balloon_type']] = (int) $attack['batches'];
    }

    $readyQuery = $pdo->prepare('SELECT player_side FROM multiplayer_round_ready WHERE match_id = ? AND target_round = ?');
    $readyQuery->execute([$matchId, $round + 1]);
    $ready = ['you' => false, 'opponent' => false];
    foreach ($readyQuery->fetchAll(PDO::FETCH_COLUMN) as $readySide) {
        $ready[(int) $readySide === $side ? 'you' : 'opponent'] = true;
    }

    $eventQuery = $pdo->prepare('SELECT event_text FROM multiplayer_events WHERE match_id = ? ORDER BY id DESC LIMIT 4');
    $eventQuery->execute([$matchId]);

    return [
        'towers' => $towers,
        'attacks' => $attacks,
        'ready' => $ready,
        'events' => array_reverse(array_map('strval', $eventQuery->fetchAll(PDO::FETCH_COLUMN))),
    ];
}

function multiplayer_add_event(PDO $pdo, int $matchId, string $text): void
{
    $insert = $pdo->prepare('INSERT INTO multiplayer_events (match_id, event_text) VALUES (?, ?)');
    $insert->execute([$matchId, $text]);
}

function multiplayer_assert_round_open(PDO $pdo, int $matchId, int $side, int $targetRound): void
{
    $query = $pdo->prepare('SELECT COUNT(*) FROM multiplayer_round_ready WHERE match_id = ? AND player_side = ? AND target_round = ?');
    $query->execute([$matchId, $side, $targetRound]);
    if ((int) $query->fetchColumn() > 0) {
        throw new DomainException('Du bist bereits bereit. Warte auf deinen Gegner.');
    }
}

function multiplayer_assert_game_running(array $state): void
{
    if ((int) $state['player_one_hp'] <= 0 || (int) $state['player_two_hp'] <= 0 || (int) $state['round_number'] >= (int) $state['total_rounds']) {
        throw new DomainException('Dieses Match ist bereits beendet.');
    }
}

function multiplayer_build_tower(PDO $pdo, int $userId, string $towerType, int $slot): array
{
    $types = multiplayer_tower_types();
    if (!isset($types[$towerType])) {
        throw new InvalidArgumentException('Unbekannter Turm.');
    }

    $pdo->beginTransaction();
    try {
        $match = multiplayer_match_for_user($pdo, $userId, true);
        if ($match === null) {
            throw new DomainException('Das Online-Match ist nicht mehr aktiv.');
        }
        $side = multiplayer_side($match, $userId);
        $maximumSlot = $side === 1 ? 6 : 7;
        if ($slot < 0 || $slot > $maximumSlot) {
            throw new InvalidArgumentException('Dieser Bauplatz existiert nicht.');
        }

        $state = $pdo->prepare('SELECT * FROM multiplayer_match_state WHERE match_id = ? LIMIT 1');
        $state->execute([(int) $match['id']]);
        $row = $state->fetch();
        multiplayer_assert_game_running($row);
        multiplayer_assert_round_open($pdo, (int) $match['id'], $side, (int) $row['round_number'] + 1);
        $goldColumn = $side === 1 ? 'player_one_gold' : 'player_two_gold';
        $cost = (int) $types[$towerType]['cost'];
        if ((int) $row[$goldColumn] < $cost) {
            throw new InvalidArgumentException('Nicht genug Gold für diesen Turm.');
        }

        $occupied = $pdo->prepare('SELECT COUNT(*) FROM multiplayer_towers WHERE match_id = ? AND player_side = ? AND slot_index = ?');
        $occupied->execute([(int) $match['id'], $side, $slot]);
        if ((int) $occupied->fetchColumn() > 0) {
            throw new InvalidArgumentException('Dieser Bauplatz ist bereits belegt.');
        }

        $insert = $pdo->prepare('INSERT INTO multiplayer_towers (match_id, player_side, slot_index, tower_type) VALUES (?, ?, ?, ?)');
        $insert->execute([(int) $match['id'], $side, $slot, $towerType]);
        $update = $pdo->prepare("UPDATE multiplayer_match_state SET {$goldColumn} = {$goldColumn} - ? WHERE match_id = ?");
        $update->execute([$cost, (int) $match['id']]);
        multiplayer_add_event($pdo, (int) $match['id'], 'Seite ' . $side . ' baut ' . $types[$towerType]['name'] . '.');
        $pdo->commit();
        return matchmaking_status($pdo, $userId, true);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function multiplayer_send_balloons(PDO $pdo, int $userId, string $balloonType): array
{
    $types = multiplayer_balloon_types();
    if (!isset($types[$balloonType])) {
        throw new InvalidArgumentException('Unbekannte Ballonart.');
    }

    $pdo->beginTransaction();
    try {
        $match = multiplayer_match_for_user($pdo, $userId, true);
        if ($match === null) throw new DomainException('Das Online-Match ist nicht mehr aktiv.');
        $side = multiplayer_side($match, $userId);
        $matchId = (int) $match['id'];
        $stateQuery = $pdo->prepare('SELECT * FROM multiplayer_match_state WHERE match_id = ? LIMIT 1');
        $stateQuery->execute([$matchId]);
        $state = $stateQuery->fetch();
        multiplayer_assert_game_running($state);
        multiplayer_assert_round_open($pdo, $matchId, $side, (int) $state['round_number'] + 1);
        $goldColumn = $side === 1 ? 'player_one_gold' : 'player_two_gold';
        $incomeColumn = $side === 1 ? 'player_one_income' : 'player_two_income';
        $cost = (int) $types[$balloonType]['cost'];
        if ((int) $state[$goldColumn] < $cost) throw new InvalidArgumentException('Nicht genug Gold für diese Ballons.');

        $update = $pdo->prepare("UPDATE multiplayer_match_state SET {$goldColumn} = {$goldColumn} - ?, {$incomeColumn} = {$incomeColumn} + ? WHERE match_id = ?");
        $update->execute([$cost, (int) $types[$balloonType]['income'], $matchId]);
        $insert = $pdo->prepare('INSERT INTO multiplayer_attacks (match_id, sender_side, balloon_type, target_round) VALUES (?, ?, ?, ?)');
        $insert->execute([$matchId, $side, $balloonType, (int) $state['round_number'] + 1]);
        multiplayer_add_event($pdo, $matchId, 'Seite ' . $side . ' schickt 10 ' . strtolower($types[$balloonType]['name']) . 'e Ballons.');
        $pdo->commit();
        return matchmaking_status($pdo, $userId, true);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function multiplayer_start_round(PDO $pdo, int $userId): array
{
    $pdo->beginTransaction();
    try {
        $match = multiplayer_match_for_user($pdo, $userId, true);
        if ($match === null) throw new DomainException('Das Online-Match ist nicht mehr aktiv.');
        $side = multiplayer_side($match, $userId);
        $matchId = (int) $match['id'];
        $stateQuery = $pdo->prepare('SELECT * FROM multiplayer_match_state WHERE match_id = ? LIMIT 1');
        $stateQuery->execute([$matchId]);
        $state = $stateQuery->fetch();
        multiplayer_assert_game_running($state);
        $targetRound = (int) $state['round_number'] + 1;
        if ($targetRound > (int) $state['total_rounds']) throw new InvalidArgumentException('Alle Runden wurden bereits gespielt.');

        $ready = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
            ? $pdo->prepare('INSERT INTO multiplayer_round_ready (match_id, player_side, target_round) VALUES (?, ?, ?) ON CONFLICT(match_id, player_side) DO UPDATE SET target_round = excluded.target_round, ready_at = CURRENT_TIMESTAMP')
            : $pdo->prepare('INSERT INTO multiplayer_round_ready (match_id, player_side, target_round) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE target_round = VALUES(target_round), ready_at = CURRENT_TIMESTAMP');
        $ready->execute([$matchId, $side, $targetRound]);

        $readyCount = $pdo->prepare('SELECT COUNT(*) FROM multiplayer_round_ready WHERE match_id = ? AND target_round = ?');
        $readyCount->execute([$matchId, $targetRound]);
        if ((int) $readyCount->fetchColumn() === 2) {
            $towerTypes = multiplayer_tower_types();
            $balloonTypes = multiplayer_balloon_types();
            $defense = [1 => 0, 2 => 0];
            $towerQuery = $pdo->prepare('SELECT player_side, tower_type FROM multiplayer_towers WHERE match_id = ?');
            $towerQuery->execute([$matchId]);
            foreach ($towerQuery->fetchAll() as $tower) {
                $defense[(int) $tower['player_side']] += (int) ($towerTypes[$tower['tower_type']]['defense'] ?? 0);
            }
            $attack = [1 => 0, 2 => 0];
            $attackQuery = $pdo->prepare('SELECT sender_side, balloon_type FROM multiplayer_attacks WHERE match_id = ? AND target_round = ? AND resolved_at IS NULL');
            $attackQuery->execute([$matchId, $targetRound]);
            foreach ($attackQuery->fetchAll() as $row) {
                $targetSide = (int) $row['sender_side'] === 1 ? 2 : 1;
                $attack[$targetSide] += (int) ($balloonTypes[$row['balloon_type']]['attack'] ?? 0);
            }
            $damageOne = max(0, $attack[1] - $defense[1]);
            $damageTwo = max(0, $attack[2] - $defense[2]);
            $signedType = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? 'INTEGER' : 'SIGNED';
            $clamp = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? 'MAX' : 'GREATEST';
            $update = $pdo->prepare("UPDATE multiplayer_match_state SET round_number = ?, player_one_hp = {$clamp}(0, CAST(player_one_hp AS {$signedType}) - ?), player_two_hp = {$clamp}(0, CAST(player_two_hp AS {$signedType}) - ?), player_one_gold = player_one_gold + (player_one_income * ?), player_two_gold = player_two_gold + (player_two_income * ?) WHERE match_id = ?");
            $update->execute([$targetRound, $damageOne, $damageTwo, MULTIPLAYER_INCOME_TICKS_PER_ROUND, MULTIPLAYER_INCOME_TICKS_PER_ROUND, $matchId]);
            $resolve = $pdo->prepare('UPDATE multiplayer_attacks SET resolved_at = CURRENT_TIMESTAMP WHERE match_id = ? AND target_round = ? AND resolved_at IS NULL');
            $resolve->execute([$matchId, $targetRound]);
            $clear = $pdo->prepare('DELETE FROM multiplayer_round_ready WHERE match_id = ?');
            $clear->execute([$matchId]);
            multiplayer_add_event($pdo, $matchId, 'Runde ' . $targetRound . ' ausgewertet: ' . $damageOne . ' / ' . $damageTwo . ' Schaden.');
        }
        $pdo->commit();
        return matchmaking_status($pdo, $userId, true);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function matchmaking_status(PDO $pdo, int $userId, bool $touchQueue = false): array
{
    $matchQuery = $pdo->prepare("SELECT m.id, m.player_one_id, m.player_two_id, m.status,
            CASE WHEN m.player_one_id = ? THEN opponent_two.username ELSE opponent_one.username END AS opponent_username,
            CASE WHEN m.player_one_id = ? THEN COALESCE(profile_two.avatar_code, 'forest_guardian') ELSE COALESCE(profile_one.avatar_code, 'forest_guardian') END AS opponent_avatar_code
        FROM multiplayer_matches m
        INNER JOIN users opponent_one ON opponent_one.id = m.player_one_id
        INNER JOIN users opponent_two ON opponent_two.id = m.player_two_id
        LEFT JOIN user_profiles profile_one ON profile_one.user_id = m.player_one_id
        LEFT JOIN user_profiles profile_two ON profile_two.user_id = m.player_two_id
        WHERE (m.player_one_id = ? OR m.player_two_id = ?) AND m.status IN ('matched', 'active')
        ORDER BY m.id DESC LIMIT 1");
    $matchQuery->execute([$userId, $userId, $userId, $userId]);
    $match = $matchQuery->fetch();

    if ($match !== false) {
        $matchId = (int) $match['id'];
        $opponentId = (int) $match['player_one_id'] === $userId
            ? (int) $match['player_two_id']
            : (int) $match['player_one_id'];
        ensure_match_presence($pdo, $matchId, [(int) $match['player_one_id'], (int) $match['player_two_id']]);
        ensure_multiplayer_match_state($pdo, $matchId);

        if ($touchQueue) {
            $touch = $pdo->prepare('UPDATE multiplayer_match_presence SET last_seen_at = CURRENT_TIMESTAMP WHERE match_id = ? AND user_id = ?');
            $touch->execute([$matchId, $userId]);

            $staleSql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
                ? "SELECT COUNT(*) FROM multiplayer_match_presence WHERE match_id = ? AND user_id = ? AND last_seen_at < datetime(CURRENT_TIMESTAMP, '-" . MATCH_PRESENCE_STALE_SECONDS . " seconds')"
                : 'SELECT COUNT(*) FROM multiplayer_match_presence WHERE match_id = ? AND user_id = ? AND last_seen_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ' . MATCH_PRESENCE_STALE_SECONDS . ' SECOND)';
            $stale = $pdo->prepare($staleSql);
            $stale->execute([$matchId, $opponentId]);
            if ((int) $stale->fetchColumn() > 0) {
                $cancel = $pdo->prepare("UPDATE multiplayer_matches SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('matched', 'active')");
                $cancel->execute([$matchId]);
                return ['state' => 'idle', 'reason' => 'opponent_disconnected'];
            }
        }

        $presenceQuery = $pdo->prepare('SELECT user_id, ready_at FROM multiplayer_match_presence WHERE match_id = ?');
        $presenceQuery->execute([$matchId]);
        $ready = [];
        foreach ($presenceQuery->fetchAll() as $presence) {
            $ready[(int) $presence['user_id']] = $presence['ready_at'] !== null;
        }

        $startsInMs = (string) $match['status'] === 'active' ? match_starts_in_ms($pdo, $matchId) : null;
        $state = (string) $match['status'] === 'active'
            ? ($startsInMs > 0 ? 'starting' : 'active')
            : 'matched';
        $opponentAvatar = avatar_data((string) $match['opponent_avatar_code']);
        $gameStateQuery = $pdo->prepare('SELECT * FROM multiplayer_match_state WHERE match_id = ? LIMIT 1');
        $gameStateQuery->execute([$matchId]);
        $gameState = $gameStateQuery->fetch();
        $ownPrefix = (int) $match['player_one_id'] === $userId ? 'player_one_' : 'player_two_';
        $opponentPrefix = $ownPrefix === 'player_one_' ? 'player_two_' : 'player_one_';
        $side = (int) $match['player_one_id'] === $userId ? 1 : 2;
        $liveDetails = multiplayer_live_details($pdo, $matchId, $side, (int) $gameState['round_number']);
        $ownHp = (int) $gameState[$ownPrefix . 'hp'];
        $opponentHp = (int) $gameState[$opponentPrefix . 'hp'];
        $finished = $ownHp <= 0 || $opponentHp <= 0 || (int) $gameState['round_number'] >= (int) $gameState['total_rounds'];
        $result = !$finished ? null : ($ownHp === $opponentHp ? 'draw' : ($ownHp > $opponentHp ? 'win' : 'loss'));
        return [
            'state' => $state,
            'match_id' => $matchId,
            'opponent' => (string) $match['opponent_username'],
            'opponent_avatar' => $opponentAvatar['image'],
            'side' => $side,
            'you_ready' => $ready[$userId] ?? false,
            'opponent_ready' => $ready[$opponentId] ?? false,
            'starts_in_ms' => $startsInMs,
            'redirect_url' => 'multiplayer-match.php?match=' . $matchId,
            'game_state' => [
                'round' => (int) $gameState['round_number'],
                'total_rounds' => (int) $gameState['total_rounds'],
                'finished' => $finished,
                'result' => $result,
                'you' => [
                    'hp' => (int) $gameState[$ownPrefix . 'hp'],
                    'gold' => (int) $gameState[$ownPrefix . 'gold'],
                    'income' => (int) $gameState[$ownPrefix . 'income'],
                ],
                'opponent' => [
                    'hp' => (int) $gameState[$opponentPrefix . 'hp'],
                    'gold' => (int) $gameState[$opponentPrefix . 'gold'],
                    'income' => (int) $gameState[$opponentPrefix . 'income'],
                ],
                'towers' => $liveDetails['towers'],
                'attacks' => $liveDetails['attacks'],
                'ready' => $liveDetails['ready'],
                'events' => $liveDetails['events'],
            ],
        ];
    }

    $queueQuery = $pdo->prepare('SELECT joined_at FROM matchmaking_queue WHERE user_id = ? LIMIT 1');
    $queueQuery->execute([$userId]);
    $queue = $queueQuery->fetch();

    if ($queue !== false) {
        if ($touchQueue) {
            $touch = $pdo->prepare('UPDATE matchmaking_queue SET last_seen_at = CURRENT_TIMESTAMP WHERE user_id = ?');
            $touch->execute([$userId]);
        }
        return ['state' => 'waiting', 'joined_at' => (string) $queue['joined_at']];
    }

    return ['state' => 'idle'];
}

function join_matchmaking(PDO $pdo, int $userId): array
{
    $pdo->beginTransaction();
    try {
        matchmaking_cleanup($pdo);
        $current = matchmaking_status($pdo, $userId);
        if (in_array($current['state'], ['matched', 'starting', 'active'], true)) {
            $pdo->commit();
            return $current;
        }

        if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
            $queue = $pdo->prepare('INSERT INTO matchmaking_queue (user_id) VALUES (?) ON CONFLICT(user_id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP');
        } else {
            $queue = $pdo->prepare('INSERT INTO matchmaking_queue (user_id) VALUES (?) ON DUPLICATE KEY UPDATE last_seen_at = CURRENT_TIMESTAMP');
        }
        $queue->execute([$userId]);

        $opponentSql = 'SELECT user_id FROM matchmaking_queue WHERE user_id <> ? ORDER BY joined_at, user_id LIMIT 1';
        if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'sqlite') {
            $opponentSql .= ' FOR UPDATE';
        }
        $opponentQuery = $pdo->prepare($opponentSql);
        $opponentQuery->execute([$userId]);
        $opponentId = $opponentQuery->fetchColumn();

        if ($opponentId === false) {
            $pdo->commit();
            return ['state' => 'waiting'];
        }

        $players = [(int) $opponentId, $userId];
        if (random_int(0, 1) === 1) {
            $players = [$players[1], $players[0]];
        }

        $createMatch = $pdo->prepare("INSERT INTO multiplayer_matches (player_one_id, player_two_id, status) VALUES (?, ?, 'matched')");
        $createMatch->execute($players);
        $matchId = (int) $pdo->lastInsertId();
        ensure_match_presence($pdo, $matchId, $players);
        ensure_multiplayer_match_state($pdo, $matchId);

        $removeQueue = $pdo->prepare('DELETE FROM matchmaking_queue WHERE user_id IN (?, ?)');
        $removeQueue->execute([$userId, (int) $opponentId]);
        $pdo->commit();

        return matchmaking_status($pdo, $userId) + ['match_id' => $matchId];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function ready_multiplayer_match(PDO $pdo, int $userId): array
{
    $pdo->beginTransaction();
    try {
        $matchSql = "SELECT id, player_one_id, player_two_id, status FROM multiplayer_matches
            WHERE (player_one_id = ? OR player_two_id = ?) AND status IN ('matched', 'active')
            ORDER BY id DESC LIMIT 1";
        if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'sqlite') {
            $matchSql .= ' FOR UPDATE';
        }
        $matchQuery = $pdo->prepare($matchSql);
        $matchQuery->execute([$userId, $userId]);
        $match = $matchQuery->fetch();

        if ($match === false) {
            $pdo->commit();
            return ['state' => 'idle'];
        }

        $matchId = (int) $match['id'];
        ensure_match_presence($pdo, $matchId, [(int) $match['player_one_id'], (int) $match['player_two_id']]);
        $ready = $pdo->prepare('UPDATE multiplayer_match_presence SET ready_at = COALESCE(ready_at, CURRENT_TIMESTAMP), last_seen_at = CURRENT_TIMESTAMP WHERE match_id = ? AND user_id = ?');
        $ready->execute([$matchId, $userId]);

        $readyCount = $pdo->prepare('SELECT COUNT(*) FROM multiplayer_match_presence WHERE match_id = ? AND ready_at IS NOT NULL');
        $readyCount->execute([$matchId]);
        if ((int) $readyCount->fetchColumn() >= 2 && (string) $match['status'] === 'matched') {
            $startSql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
                ? "UPDATE multiplayer_matches SET status = 'active', started_at = datetime(CURRENT_TIMESTAMP, '+" . MATCH_COUNTDOWN_SECONDS . " seconds') WHERE id = ? AND status = 'matched'"
                : "UPDATE multiplayer_matches SET status = 'active', started_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL " . MATCH_COUNTDOWN_SECONDS . " SECOND) WHERE id = ? AND status = 'matched'";
            $start = $pdo->prepare($startSql);
            $start->execute([$matchId]);
        }

        $pdo->commit();
        return matchmaking_status($pdo, $userId, true);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function leave_matchmaking(PDO $pdo, int $userId): array
{
    $pdo->beginTransaction();
    try {
        $removeQueue = $pdo->prepare('DELETE FROM matchmaking_queue WHERE user_id = ?');
        $removeQueue->execute([$userId]);

        $cancelMatch = $pdo->prepare("UPDATE multiplayer_matches
            SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP
            WHERE (player_one_id = ? OR player_two_id = ?) AND status IN ('matched', 'active')");
        $cancelMatch->execute([$userId, $userId]);
        $pdo->commit();
        return ['state' => 'idle'];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}
