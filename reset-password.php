<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require __DIR__ . '/db.php';
require __DIR__ . '/portal.php';
require __DIR__ . '/account-security.php';
$token = $_SERVER['REQUEST_METHOD'] === 'POST' ? ($_POST['token'] ?? '') : ($_GET['token'] ?? '');
$token = is_string($token) ? strtolower(trim($token)) : '';
$validToken = auth_token_user($pdo, $token, 'reset_password') !== null;
$errors = [];
$completed = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';
    $confirmation = is_string($_POST['password_confirmation'] ?? null) ? $_POST['password_confirmation'] : '';
    if (!valid_csrf($_POST)) $errors[] = 'Die Anfrage ist abgelaufen. Bitte versuche es erneut.';
    if (strlen($password) < 8) $errors[] = 'Das Passwort muss mindestens 8 Zeichen lang sein.';
    if ($password !== $confirmation) $errors[] = 'Die beiden Passwörter stimmen nicht überein.';
    if (!$validToken) $errors[] = 'Der Reset-Link ist ungültig oder abgelaufen.';
    if ($errors === []) {
        $completed = consume_password_reset($pdo, $token, password_hash($password, PASSWORD_DEFAULT));
        if (!$completed) $errors[] = 'Der Reset-Link wurde bereits verwendet oder ist abgelaufen.';
    }
}
?>
<!DOCTYPE html><html lang="de"><head><?php portal_head('Neues Passwort'); ?></head>
<body class="auth-page"><?php require __DIR__ . '/site-header.php'; ?>
<main id="main-content" class="auth-card"><p class="eyebrow">Neue Zugangsdaten</p><h1>Neues Passwort.</h1>
<?php if ($completed): ?><div class="message success"><p>Dein Passwort wurde geändert. Du kannst dich jetzt damit anmelden.</p></div><a class="primary-link" href="login.php">Zum Login</a>
<?php elseif (!$validToken && $_SERVER['REQUEST_METHOD'] !== 'POST'): ?><div class="message error"><p>Dieser Reset-Link ist ungültig, abgelaufen oder wurde bereits benutzt.</p></div><a class="primary-link" href="forgot-password.php">Neuen Link anfordern</a>
<?php else: ?><p class="card-intro">Wähle ein neues Passwort mit mindestens acht Zeichen.</p>
<?php if ($errors): ?><div class="message error" role="alert"><ul><?php foreach ($errors as $error): ?><li><?= escape($error) ?></li><?php endforeach; ?></ul></div><?php endif; ?>
<form method="post" action="reset-password.php"><?= csrf_field() ?><input type="hidden" name="token" value="<?= escape($token) ?>"><label for="password">Neues Passwort</label><div class="password-field"><input id="password" name="password" type="password" minlength="8" autocomplete="new-password" required><button class="password-toggle" type="button" data-password-target="password" aria-label="Passwort anzeigen">👁</button></div><label for="password_confirmation">Passwort wiederholen</label><div class="password-field"><input id="password_confirmation" name="password_confirmation" type="password" minlength="8" autocomplete="new-password" required><button class="password-toggle" type="button" data-password-target="password_confirmation" aria-label="Passwort anzeigen">👁</button></div><button class="primary-button" type="submit">Passwort speichern</button></form><?php endif; ?>
</main><script src="password-toggle.js" defer></script><?php require __DIR__ . '/site-footer.php'; ?></body></html>
