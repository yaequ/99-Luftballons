<?php

declare(strict_types=1);

function achievement_catalog(): array
{
    return [
        'first_match' => [
            'name' => 'Feuerprobe',
            'description' => 'Schließe deine erste Partie ab.',
            'icon' => 'assets/img/achievements/achievement-first-match.png',
            'sort_order' => 1,
        ],
        'first_win' => [
            'name' => 'Basiswächter',
            'description' => 'Erringe deinen ersten Sieg.',
            'icon' => 'assets/img/achievements/achievement-first-win.png',
            'sort_order' => 2,
        ],
        'win_streak' => [
            'name' => 'Unaufhaltsam',
            'description' => 'Gewinne drei Partien hintereinander.',
            'icon' => 'assets/img/achievements/achievement-win-streak.png',
            'sort_order' => 3,
        ],
        'veteran' => [
            'name' => 'Veteran der Lüfte',
            'description' => 'Schließe insgesamt 25 Partien ab.',
            'icon' => 'assets/img/achievements/achievement-veteran.png',
            'sort_order' => 4,
        ],
        'speedrunner' => [
            'name' => 'Blitzstratege',
            'description' => 'Gewinne eine Partie in höchstens 5 Minuten.',
            'icon' => 'assets/img/achievements/achievement-speedrunner.png',
            'sort_order' => 5,
        ],
    ];
}

function ensure_achievement_tables(PDO $pdo): void
{
    $sqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
    if ($sqlite) {
        $pdo->exec('CREATE TABLE IF NOT EXISTS achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            icon_path TEXT NOT NULL,
            sort_order INTEGER NOT NULL
        )');
        $pdo->exec('CREATE TABLE IF NOT EXISTS user_achievements (
            user_id INTEGER NOT NULL,
            achievement_id INTEGER NOT NULL,
            source_result_id INTEGER DEFAULT NULL,
            unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, achievement_id)
        )');
    } else {
        $pdo->exec('CREATE TABLE IF NOT EXISTS achievements (
            id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(40) NOT NULL UNIQUE,
            name VARCHAR(80) NOT NULL,
            description VARCHAR(255) NOT NULL,
            icon_path VARCHAR(255) NOT NULL,
            sort_order TINYINT UNSIGNED NOT NULL,
            INDEX idx_achievements_order (sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
        $pdo->exec('CREATE TABLE IF NOT EXISTS user_achievements (
            user_id INT UNSIGNED NOT NULL,
            achievement_id SMALLINT UNSIGNED NOT NULL,
            source_result_id BIGINT UNSIGNED DEFAULT NULL,
            unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, achievement_id),
            CONSTRAINT fk_user_achievements_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_user_achievements_achievement FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
            CONSTRAINT fk_user_achievements_result FOREIGN KEY (source_result_id) REFERENCES game_results(id) ON DELETE SET NULL,
            INDEX idx_user_achievements_unlocked (unlocked_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    }

    $statement = $sqlite
        ? $pdo->prepare('INSERT INTO achievements (code, name, description, icon_path, sort_order) VALUES (?, ?, ?, ?, ?) ON CONFLICT(code) DO UPDATE SET name=excluded.name, description=excluded.description, icon_path=excluded.icon_path, sort_order=excluded.sort_order')
        : $pdo->prepare('INSERT INTO achievements (code, name, description, icon_path, sort_order) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), icon_path=VALUES(icon_path), sort_order=VALUES(sort_order)');
    foreach (achievement_catalog() as $code => $achievement) {
        $statement->execute([$code, $achievement['name'], $achievement['description'], $achievement['icon'], $achievement['sort_order']]);
    }
}

function achievement_progress(PDO $pdo, int $userId): array
{
    $query = $pdo->prepare("SELECT COUNT(*) AS matches,
        COALESCE(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END), 0) AS wins,
        MIN(CASE WHEN result = 'win' THEN duration_seconds END) AS best
        FROM game_results WHERE user_id = ?");
    $query->execute([$userId]);
    $stats = $query->fetch();

    $query = $pdo->prepare('SELECT result FROM game_results WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 3');
    $query->execute([$userId]);
    $latestResults = $query->fetchAll(PDO::FETCH_COLUMN);
    $streak = 0;
    foreach ($latestResults as $result) {
        if ($result !== 'win') break;
        $streak++;
    }

    $matches = (int) $stats['matches'];
    $wins = (int) $stats['wins'];
    $best = $stats['best'] === null ? null : (int) $stats['best'];
    return [
        'first_match' => ['current' => min(1, $matches), 'target' => 1, 'unlocked' => $matches >= 1],
        'first_win' => ['current' => min(1, $wins), 'target' => 1, 'unlocked' => $wins >= 1],
        'win_streak' => ['current' => min(3, $streak), 'target' => 3, 'unlocked' => $streak >= 3],
        'veteran' => ['current' => min(25, $matches), 'target' => 25, 'unlocked' => $matches >= 25],
        'speedrunner' => ['current' => $best !== null && $best <= 300 ? 1 : 0, 'target' => 1, 'unlocked' => $best !== null && $best <= 300],
    ];
}

function unlock_achievements(PDO $pdo, int $userId, ?int $sourceResultId = null): array
{
    ensure_achievement_tables($pdo);
    $progress = achievement_progress($pdo, $userId);
    $find = $pdo->prepare('SELECT id FROM achievements WHERE code = ?');
    $insert = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
        ? $pdo->prepare('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, source_result_id) VALUES (?, ?, ?)')
        : $pdo->prepare('INSERT IGNORE INTO user_achievements (user_id, achievement_id, source_result_id) VALUES (?, ?, ?)');
    $newlyUnlocked = [];
    foreach ($progress as $code => $state) {
        if (!$state['unlocked']) continue;
        $find->execute([$code]);
        $achievementId = (int) $find->fetchColumn();
        $insert->execute([$userId, $achievementId, $sourceResultId]);
        if ($insert->rowCount() === 1) $newlyUnlocked[] = $code;
    }
    return $newlyUnlocked;
}

function player_achievements(PDO $pdo, int $userId): array
{
    unlock_achievements($pdo, $userId);
    $progress = achievement_progress($pdo, $userId);
    $query = $pdo->prepare('SELECT a.code, ua.unlocked_at FROM achievements a LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = ? ORDER BY a.sort_order');
    $query->execute([$userId]);
    $unlocked = [];
    foreach ($query->fetchAll() as $row) $unlocked[$row['code']] = $row['unlocked_at'];

    $result = [];
    foreach (achievement_catalog() as $code => $achievement) {
        $result[] = array_merge($achievement, [
            'code' => $code,
            'unlocked_at' => $unlocked[$code] ?? null,
            'current' => $progress[$code]['current'],
            'target' => $progress[$code]['target'],
        ]);
    }
    return $result;
}
