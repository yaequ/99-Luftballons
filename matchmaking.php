<?php

declare(strict_types=1);

const MATCHMAKING_STALE_SECONDS = 120;

function ensure_matchmaking_tables(PDO $pdo): void
{
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

function matchmaking_status(PDO $pdo, int $userId, bool $touchQueue = false): array
{
    $matchQuery = $pdo->prepare("SELECT m.id, m.player_one_id, m.player_two_id, m.status,
            CASE WHEN m.player_one_id = ? THEN opponent_two.username ELSE opponent_one.username END AS opponent_username
        FROM multiplayer_matches m
        INNER JOIN users opponent_one ON opponent_one.id = m.player_one_id
        INNER JOIN users opponent_two ON opponent_two.id = m.player_two_id
        WHERE (m.player_one_id = ? OR m.player_two_id = ?) AND m.status IN ('matched', 'active')
        ORDER BY m.id DESC LIMIT 1");
    $matchQuery->execute([$userId, $userId, $userId]);
    $match = $matchQuery->fetch();

    if ($match !== false) {
        return [
            'state' => 'matched',
            'match_id' => (int) $match['id'],
            'opponent' => (string) $match['opponent_username'],
            'side' => (int) $match['player_one_id'] === $userId ? 1 : 2,
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
        if ($current['state'] === 'matched') {
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

function leave_matchmaking(PDO $pdo, int $userId): array
{
    $pdo->beginTransaction();
    try {
        $removeQueue = $pdo->prepare('DELETE FROM matchmaking_queue WHERE user_id = ?');
        $removeQueue->execute([$userId]);

        $cancelMatch = $pdo->prepare("UPDATE multiplayer_matches
            SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP
            WHERE (player_one_id = ? OR player_two_id = ?) AND status = 'matched'");
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
