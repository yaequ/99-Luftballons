<?php
declare(strict_types=1);
require dirname(__DIR__) . '/account-security.php';
require dirname(__DIR__) . '/account-management.php';

function management_check(bool $ok, string $message): void
{
    if (!$ok) throw new RuntimeException($message);
    echo "OK: $message\n";
}

$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('PRAGMA foreign_keys = ON');
$pdo->exec('CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    email_verified_at TEXT
)');
$pdo->exec("INSERT INTO users VALUES
    (1, 'PlayerOne', 'one@example.test', 'hash', '2026-01-01 00:00:00'),
    (2, 'PlayerTwo', 'two@example.test', 'hash', '2026-01-01 00:00:00')");

management_check(username_available($pdo, 'NewName', 1), 'A free username is accepted');
management_check(!username_available($pdo, 'playertwo', 1), 'Username checks are case-insensitive');
management_check(email_available($pdo, 'new@example.test', 1), 'A free email address is accepted');
management_check(!email_available($pdo, 'TWO@example.test', 1), 'Email checks are case-insensitive');

$token = issue_email_change($pdo, 1, 'new@example.test', 3600);
management_check(is_string($token) && strlen($token) === 64, 'A secure email-change token is issued');
$stored = (string) $pdo->query('SELECT token_hash FROM email_changes')->fetchColumn();
management_check($stored !== $token && hash_equals($stored, hash('sha256', $token)), 'Only the email-change token hash is stored');
management_check(issue_email_change($pdo, 1, 'other@example.test', 3600, 300) === null, 'Email-change requests are rate limited');
management_check(consume_email_change($pdo, $token) === 1, 'A valid token confirms the new address');
management_check($pdo->query('SELECT email FROM users WHERE id = 1')->fetchColumn() === 'new@example.test', 'The new address becomes active after confirmation');
management_check(consume_email_change($pdo, $token) === null, 'An email-change token cannot be reused');
management_check(consume_email_change($pdo, 'invalid') === null, 'Malformed email-change tokens are rejected');

$expired = issue_email_change($pdo, 1, 'expired@example.test', 60, 0);
$query = $pdo->prepare("UPDATE email_changes SET expires_at = '2000-01-01 00:00:00' WHERE token_hash = ?");
$query->execute([hash('sha256', (string) $expired)]);
management_check(consume_email_change($pdo, (string) $expired) === null, 'Expired email-change tokens are rejected');

$cancelled = issue_email_change($pdo, 1, 'cancelled@example.test', 3600, 0);
cancel_email_change($pdo, 1, (string) $cancelled);
management_check(consume_email_change($pdo, (string) $cancelled) === null, 'A token is removed when mail delivery fails');

$pdo->exec('DELETE FROM users WHERE id = 1');
management_check((int) $pdo->query('SELECT COUNT(*) FROM email_changes WHERE user_id = 1')->fetchColumn() === 0, 'Pending email changes are deleted with the account');
