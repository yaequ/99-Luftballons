<?php

declare(strict_types=1);

function avatar_catalog(): array
{
    return [
        'forest_guardian' => ['name' => 'Waldwächter', 'image' => 'assets/img/avatars/avatar-forest-guardian.png'],
        'balloon_hunter' => ['name' => 'Ballonjägerin', 'image' => 'assets/img/avatars/avatar-balloon-hunter.png'],
        'wind_engineer' => ['name' => 'Windtüftler', 'image' => 'assets/img/avatars/avatar-wind-engineer.png'],
        'desert_scout' => ['name' => 'Wüstenkundschafter', 'image' => 'assets/img/avatars/avatar-desert-scout.png'],
        'frost_mage' => ['name' => 'Frostmagierin', 'image' => 'assets/img/avatars/avatar-frost-mage.png'],
    ];
}

function valid_avatar_code(mixed $code): bool
{
    return is_string($code) && array_key_exists($code, avatar_catalog());
}

function avatar_data(mixed $code): array
{
    $catalog = avatar_catalog();
    return $catalog[valid_avatar_code($code) ? $code : 'forest_guardian'];
}

function ensure_user_profiles_table(PDO $pdo): void
{
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec('CREATE TABLE IF NOT EXISTS user_profiles (
            user_id INTEGER PRIMARY KEY,
            avatar_code TEXT NOT NULL DEFAULT \'forest_guardian\',
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )');
        return;
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INT UNSIGNED PRIMARY KEY,
        avatar_code VARCHAR(40) NOT NULL DEFAULT 'forest_guardian',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function user_avatar_code(PDO $pdo, int $userId): string
{
    ensure_user_profiles_table($pdo);
    $query = $pdo->prepare('SELECT avatar_code FROM user_profiles WHERE user_id = ? LIMIT 1');
    $query->execute([$userId]);
    $code = $query->fetchColumn();
    return valid_avatar_code($code) ? (string) $code : 'forest_guardian';
}

function save_user_avatar(PDO $pdo, int $userId, string $code): void
{
    if (!valid_avatar_code($code)) throw new InvalidArgumentException('Ungültiger Avatar.');
    ensure_user_profiles_table($pdo);
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $query = $pdo->prepare('INSERT INTO user_profiles (user_id, avatar_code) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET avatar_code=excluded.avatar_code, updated_at=CURRENT_TIMESTAMP');
    } else {
        $query = $pdo->prepare('INSERT INTO user_profiles (user_id, avatar_code) VALUES (?, ?) ON DUPLICATE KEY UPDATE avatar_code=VALUES(avatar_code), updated_at=CURRENT_TIMESTAMP');
    }
    $query->execute([$userId, $code]);
}
