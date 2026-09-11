<?php
declare(strict_types=1);
require dirname(__DIR__) . '/account-security.php';

function auth_check(bool $ok, string $message): void {
    if (!$ok) throw new RuntimeException($message);
    echo "OK: $message\n";
}

$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, password_hash TEXT, verification_token TEXT, email_verified_at TEXT)');
$pdo->exec("INSERT INTO users VALUES (1, 'Player', 'player@example.test', 'old-hash', NULL, NULL)");

$verification = issue_auth_token($pdo, 1, 'verify_email', 3600);
auth_check(is_string($verification) && strlen($verification) === 64, 'A cryptographically random verification token is issued');
$stored = (string) $pdo->query("SELECT token_hash FROM auth_tokens WHERE purpose = 'verify_email'")->fetchColumn();
auth_check($stored !== $verification && hash_equals($stored, hash('sha256', $verification)), 'Only the token hash is stored');
auth_check(auth_token_user($pdo, $verification, 'verify_email') === 1, 'Valid verification token resolves to its user');
auth_check(consume_email_verification($pdo, $verification), 'Verification token can be consumed once');
auth_check(!consume_email_verification($pdo, $verification), 'Verification token cannot be reused');
auth_check($pdo->query('SELECT email_verified_at FROM users WHERE id = 1')->fetchColumn() !== null, 'Email is marked as verified');

$reset = issue_auth_token($pdo, 1, 'reset_password', 3600);
$newHash = password_hash('new-password', PASSWORD_DEFAULT);
auth_check(consume_password_reset($pdo, (string) $reset, $newHash), 'Password reset token changes the password');
auth_check(password_verify('new-password', (string) $pdo->query('SELECT password_hash FROM users WHERE id = 1')->fetchColumn()), 'New password is stored as a secure hash');
auth_check(!consume_password_reset($pdo, (string) $reset, password_hash('other-password', PASSWORD_DEFAULT)), 'Password reset token cannot be reused');

$limited = issue_auth_token($pdo, 1, 'reset_password', 3600, 300);
auth_check($limited === null, 'Token requests are rate limited');
$expiring = issue_auth_token($pdo, 1, 'verify_email', 60);
$pdo->exec("UPDATE auth_tokens SET expires_at = '2000-01-01 00:00:00' WHERE token_hash = '" . hash('sha256', (string) $expiring) . "'");
auth_check(auth_token_user($pdo, (string) $expiring, 'verify_email') === null, 'Expired tokens are rejected');
auth_check(auth_token_user($pdo, 'not-a-token', 'verify_email') === null, 'Malformed tokens are rejected');

$_SESSION = [];
$csrf = csrf_token();
auth_check(valid_csrf(['csrf_token'=>$csrf]), 'Matching CSRF token is accepted');
auth_check(!valid_csrf(['csrf_token'=>'wrong']), 'Incorrect CSRF token is rejected');
