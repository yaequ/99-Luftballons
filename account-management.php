<?php

declare(strict_types=1);

function ensure_email_changes_table(PDO $pdo): void
{
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec('CREATE TABLE IF NOT EXISTS email_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            new_email TEXT NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            used_at TEXT DEFAULT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )');
        return;
    }
    $pdo->exec('CREATE TABLE IF NOT EXISTS email_changes (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        new_email VARCHAR(255) NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_email_changes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_email_changes_lookup (token_hash, used_at, expires_at),
        INDEX idx_email_changes_rate (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
}

function issue_email_change(PDO $pdo, int $userId, string $newEmail, int $ttlSeconds = 3600, int $minimumInterval = 300): ?string
{
    ensure_email_changes_table($pdo);
    $now = database_now($pdo);
    $query = $pdo->prepare('SELECT created_at FROM email_changes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
    $query->execute([$userId]);
    $lastCreated = $query->fetchColumn();
    if ($minimumInterval > 0 && $lastCreated !== false && new DateTimeImmutable((string) $lastCreated) > $now->modify("-$minimumInterval seconds")) return null;

    $token = bin2hex(random_bytes(32));
    $expiresAt = $now->modify('+' . max(60, $ttlSeconds) . ' seconds')->format('Y-m-d H:i:s');
    $pdo->beginTransaction();
    try {
        $query = $pdo->prepare('UPDATE email_changes SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL');
        $query->execute([$userId]);
        $query = $pdo->prepare('INSERT INTO email_changes (user_id, new_email, token_hash, expires_at) VALUES (?, ?, ?, ?)');
        $query->execute([$userId, $newEmail, hash('sha256', $token), $expiresAt]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    return $token;
}

function consume_email_change(PDO $pdo, string $token): ?int
{
    if (strlen($token) !== 64 || !ctype_xdigit($token)) return null;
    ensure_email_changes_table($pdo);
    $hash = hash('sha256', strtolower($token));
    $query = $pdo->prepare('SELECT id, user_id, new_email FROM email_changes WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP LIMIT 1');
    $query->execute([$hash]);
    $change = $query->fetch();
    if (!$change) return null;

    $pdo->beginTransaction();
    try {
        $query = $pdo->prepare('UPDATE email_changes SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP');
        $query->execute([(int) $change['id']]);
        if ($query->rowCount() !== 1) {
            $pdo->rollBack();
            return null;
        }
        $query = $pdo->prepare('UPDATE users SET email = ?, email_verified_at = CURRENT_TIMESTAMP WHERE id = ?');
        $query->execute([$change['new_email'], (int) $change['user_id']]);
        if ($query->rowCount() !== 1) {
            $pdo->rollBack();
            return null;
        }
        $pdo->commit();
        return (int) $change['user_id'];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function username_available(PDO $pdo, string $username, int $userId): bool
{
    $query = $pdo->prepare('SELECT COUNT(*) FROM users WHERE LOWER(username) = LOWER(?) AND id <> ?');
    $query->execute([$username, $userId]);
    return (int) $query->fetchColumn() === 0;
}

function email_available(PDO $pdo, string $email, int $userId): bool
{
    $query = $pdo->prepare('SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER(?) AND id <> ?');
    $query->execute([$email, $userId]);
    return (int) $query->fetchColumn() === 0;
}

function cancel_email_change(PDO $pdo, int $userId, string $token): void
{
    $query = $pdo->prepare('DELETE FROM email_changes WHERE user_id = ? AND token_hash = ? AND used_at IS NULL');
    $query->execute([$userId, hash('sha256', strtolower($token))]);
}
