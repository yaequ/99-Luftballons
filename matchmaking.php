<?php

declare(strict_types=1);

require_once __DIR__ . '/avatars.php';

const MATCHMAKING_STALE_SECONDS = 120;
const MATCH_PRESENCE_STALE_SECONDS = 45;
const MATCH_COUNTDOWN_SECONDS = 4;

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
        return [
            'state' => $state,
            'match_id' => $matchId,
            'opponent' => (string) $match['opponent_username'],
            'opponent_avatar' => $opponentAvatar['image'],
            'side' => (int) $match['player_one_id'] === $userId ? 1 : 2,
            'you_ready' => $ready[$userId] ?? false,
            'opponent_ready' => $ready[$opponentId] ?? false,
            'starts_in_ms' => $startsInMs,
            'redirect_url' => 'multiplayer-match.php?match=' . $matchId,
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
