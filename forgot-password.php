<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require __DIR__ . '/db.php';
require __DIR__ . '/portal.php';
require __DIR__ . '/account-security.php';
require __DIR__ . '/mailer.php';
if (isset($_SESSION['user_id'])) { header('Location: account.php'); exit; }
$email = '';
$submitted = false;
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = is_string($_POST['email'] ?? null) ? strtolower(trim($_POST['email'])) : '';
    if (!valid_csrf($_POST)) {
        $error = 'Die Anfrage ist abgelaufen. Bitte versuche es erneut.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Bitte gib eine gültige E-Mail-Adresse ein.';
    } else {
        $submitted = true;
        $query = $pdo->prepare('SELECT id, username, email FROM users WHERE email = ? LIMIT 1');
        $query->execute([$email]);
        $user = $query->fetch();
        if ($user) {
            try {
                $token = issue_auth_token($pdo, (int) $user['id'], 'reset_password', 3600, 300);
                if ($token !== null) {
                    $url = rtrim((string) $config['app_url'], '/') . '/reset-password.php?token=' . urlencode($token);
                    send_app_mail($config, $user['email'], $user['username'], 'Passwort zurücksetzen', mail_layout('Neues Passwort anlegen', 'Über diesen Link kannst du innerhalb der nächsten 60 Minuten ein neues Passwort festlegen.', 'Passwort zurücksetzen', $url), "Passwort zurücksetzen (60 Minuten gültig):\n$url");
                }
            } catch (Throwable $mailError) {
                error_log('Password reset mail failed: ' . get_class($mailError));
            }
        }
    }
}
?>
<!DOCTYPE html><html lang="de"><head><?php portal_head('Passwort vergessen'); ?></head>
<body class="auth-page"><?php require __DIR__ . '/site-header.php'; ?>
<main id="main-content" class="auth-card"><p class="eyebrow">Zurück ins Basislager</p><h1>Passwort vergessen?</h1>
<?php if ($submitted): ?><div class="message success"><p>Falls ein Konto zu dieser Adresse existiert, haben wir einen Link zum Zurücksetzen gesendet. Bitte prüfe auch den Spam-Ordner.</p></div><a class="primary-link" href="login.php">Zurück zum Login</a>
<?php else: ?><p class="card-intro">Gib deine registrierte E-Mail-Adresse ein. Der Link ist 60 Minuten gültig und nur einmal verwendbar.</p>
<?php if ($error): ?><div class="message error" role="alert"><p><?= escape($error) ?></p></div><?php endif; ?>
<form method="post" action="forgot-password.php"><?= csrf_field() ?><label for="email">E-Mail-Adresse</label><input id="email" name="email" type="email" maxlength="255" autocomplete="email" value="<?= escape($email) ?>" required><button class="primary-button" type="submit">Reset-Link senden</button></form><?php endif; ?>
</main><?php require __DIR__ . '/site-footer.php'; ?></body></html>
