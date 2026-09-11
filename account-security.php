<?php

declare(strict_types=1);

const AUTH_TOKEN_PURPOSES = ['verify_email', 'reset_password'];

function ensure_auth_tokens_table(PDO $pdo): void
{
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec('CREATE TABLE IF NOT EXISTS auth_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            purpose TEXT NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            used_at TEXT DEFAULT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )');
        return;
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS auth_tokens (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        purpose ENUM('verify_email', 'reset_password') NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_auth_tokens_lookup (purpose, token_hash, used_at, expires_at),
        INDEX idx_auth_tokens_rate (user_id, purpose, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function database_now(PDO $pdo): DateTimeImmutable
{
    return new DateTimeImmutable((string) $pdo->query('SELECT CURRENT_TIMESTAMP')->fetchColumn());
}

function issue_auth_token(PDO $pdo, int $userId, string $purpose, int $ttlSeconds, int $minimumInterval = 0): ?string
{
    if (!in_array($purpose, AUTH_TOKEN_PURPOSES, true)) {
        throw new InvalidArgumentException('Unbekannter Token-Zweck.');
    }

    ensure_auth_tokens_table($pdo);
    $now = database_now($pdo);
    if ($minimumInterval > 0) {
        $query = $pdo->prepare('SELECT created_at FROM auth_tokens WHERE user_id = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1');
        $query->execute([$userId, $purpose]);
        $lastCreated = $query->fetchColumn();
        if ($lastCreated !== false && new DateTimeImmutable((string) $lastCreated) > $now->modify("-$minimumInterval seconds")) {
            return null;
        }
    }

    $token = bin2hex(random_bytes(32));
    $hash = hash('sha256', $token);
    $expiresAt = $now->modify('+' . max(60, $ttlSeconds) . ' seconds')->format('Y-m-d H:i:s');
    $pdo->beginTransaction();
    try {
        $query = $pdo->prepare('UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND purpose = ? AND used_at IS NULL');
        $query->execute([$userId, $purpose]);
        $query = $pdo->prepare('INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, ?)');
        $query->execute([$userId, $purpose, $hash, $expiresAt]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    return $token;
}

function auth_token_user(PDO $pdo, string $token, string $purpose): ?int
{
    if (!in_array($purpose, AUTH_TOKEN_PURPOSES, true) || strlen($token) !== 64 || !ctype_xdigit($token)) return null;
    ensure_auth_tokens_table($pdo);
    $query = $pdo->prepare('SELECT user_id FROM auth_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP LIMIT 1');
    $query->execute([hash('sha256', strtolower($token)), $purpose]);
    $userId = $query->fetchColumn();
    return $userId === false ? null : (int) $userId;
}

function consume_email_verification(PDO $pdo, string $token): bool
{
    $userId = auth_token_user($pdo, $token, 'verify_email');
    if ($userId === null) return false;
    $hash = hash('sha256', strtolower($token));
    $pdo->beginTransaction();
    try {
        $query = $pdo->prepare("UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND purpose = 'verify_email' AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP");
        $query->execute([$hash]);
        if ($query->rowCount() !== 1) {
            $pdo->rollBack();
            return false;
        }
        $query = $pdo->prepare('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP, verification_token = NULL WHERE id = ?');
        $query->execute([$userId]);
        $pdo->commit();
        return true;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function consume_password_reset(PDO $pdo, string $token, string $passwordHash): bool
{
    $userId = auth_token_user($pdo, $token, 'reset_password');
    if ($userId === null) return false;
    $hash = hash('sha256', strtolower($token));
    $pdo->beginTransaction();
    try {
        $query = $pdo->prepare("UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND purpose = 'reset_password' AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP");
        $query->execute([$hash]);
        if ($query->rowCount() !== 1) {
            $pdo->rollBack();
            return false;
        }
        $query = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $query->execute([$passwordHash, $userId]);
        $query = $pdo->prepare("UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND purpose = 'reset_password' AND used_at IS NULL");
        $query->execute([$userId]);
        $pdo->commit();
        return true;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function csrf_token(): string
{
    if (!isset($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf_token" value="' . htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') . '">';
}

function valid_csrf(array $input): bool
{
    $submitted = $input['csrf_token'] ?? null;
    return is_string($submitted) && isset($_SESSION['csrf_token']) && is_string($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $submitted);
}
