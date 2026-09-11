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
    if (!valid_csrf($_POST)) $error = 'Die Anfrage ist abgelaufen. Bitte versuche es erneut.';
    elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) $error = 'Bitte gib eine gültige E-Mail-Adresse ein.';
    else {
        $submitted = true;
        $query = $pdo->prepare('SELECT id, username, email FROM users WHERE email = ? AND email_verified_at IS NULL LIMIT 1');
        $query->execute([$email]);
        $user = $query->fetch();
        if ($user) {
            try {
                $token = issue_auth_token($pdo, (int) $user['id'], 'verify_email', 86400, 300);
                if ($token !== null) {
                    $url = rtrim((string) $config['app_url'], '/') . '/verify-email.php?token=' . urlencode($token);
                    send_app_mail($config, $user['email'], $user['username'], 'E-Mail-Adresse bestätigen', mail_layout('E-Mail-Adresse bestätigen', 'Bestätige deine E-Mail-Adresse, um dein Basislager freizuschalten. Der Link ist 24 Stunden gültig.', 'E-Mail bestätigen', $url), "E-Mail-Adresse bestätigen (24 Stunden gültig):\n$url");
                }
            } catch (Throwable $mailError) {
                error_log('Verification resend failed: ' . get_class($mailError));
            }
        }
    }
}
?>
<!DOCTYPE html><html lang="de"><head><?php portal_head('Bestätigung erneut senden'); ?></head>
<body class="auth-page"><?php require __DIR__ . '/site-header.php'; ?><main id="main-content" class="auth-card"><p class="eyebrow">Noch nicht angekommen?</p><h1>Bestätigung erneut senden.</h1>
<?php if ($submitted): ?><div class="message success"><p>Falls ein unbestätigtes Konto zu dieser Adresse existiert, wurde eine neue E-Mail versendet. Bitte prüfe auch den Spam-Ordner.</p></div><a class="primary-link" href="login.php">Zum Login</a>
<?php else: ?><p class="card-intro">Du kannst höchstens alle fünf Minuten einen neuen Link anfordern.</p><?php if ($error): ?><div class="message error" role="alert"><p><?= escape($error) ?></p></div><?php endif; ?><form method="post" action="resend-verification.php"><?= csrf_field() ?><label for="email">E-Mail-Adresse</label><input id="email" name="email" type="email" maxlength="255" autocomplete="email" value="<?= escape($email) ?>" required><button class="primary-button" type="submit">Bestätigung senden</button></form><?php endif; ?>
</main><?php require __DIR__ . '/site-footer.php'; ?></body></html>
