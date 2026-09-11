<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();
require __DIR__ . '/db.php';
require __DIR__ . '/portal.php';
require __DIR__ . '/account-security.php';
require __DIR__ . '/account-management.php';
require __DIR__ . '/mailer.php';

$userId = (int) $_SESSION['user_id'];
ensure_email_changes_table($pdo);
$query = $pdo->prepare('SELECT username, email, password_hash FROM users WHERE id = ? LIMIT 1');
$query->execute([$userId]);
$user = $query->fetch();
if (!$user) { destroy_session(); header('Location: login.php'); exit; }

$message = $_SESSION['settings_message'] ?? '';
unset($_SESSION['settings_message']);
$errors = [];
$activeSection = 'username';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $activeSection = is_string($_POST['action'] ?? null) ? $_POST['action'] : '';
    if (!valid_csrf($_POST)) {
        $errors[] = 'Die Anfrage ist abgelaufen. Bitte versuche es erneut.';
    } elseif ($activeSection === 'username') {
        $username = is_string($_POST['username'] ?? null) ? trim($_POST['username']) : '';
        if (strlen($username) < 3 || strlen($username) > 50) $errors[] = 'Der Benutzername muss zwischen 3 und 50 Zeichen lang sein.';
        elseif (!username_available($pdo, $username, $userId)) $errors[] = 'Dieser Benutzername ist bereits vergeben.';
        else {
            try {
                $query = $pdo->prepare('UPDATE users SET username = ? WHERE id = ?');
                $query->execute([$username, $userId]);
                $_SESSION['settings_message'] = 'Dein Benutzername wurde geändert.';
                header('Location: settings.php'); exit;
            } catch (PDOException $error) {
                $errors[] = 'Dieser Benutzername ist bereits vergeben.';
            }
        }
    } elseif ($activeSection === 'email') {
        $newEmail = is_string($_POST['email'] ?? null) ? strtolower(trim($_POST['email'])) : '';
        $password = is_string($_POST['current_password'] ?? null) ? $_POST['current_password'] : '';
        if (!filter_var($newEmail, FILTER_VALIDATE_EMAIL) || strlen($newEmail) > 255) $errors[] = 'Bitte gib eine gültige E-Mail-Adresse ein.';
        elseif (!password_verify($password, $user['password_hash'])) $errors[] = 'Das aktuelle Passwort ist nicht korrekt.';
        elseif (strcasecmp($newEmail, $user['email']) === 0) $errors[] = 'Das ist bereits deine aktuelle E-Mail-Adresse.';
        elseif (!email_available($pdo, $newEmail, $userId)) $errors[] = 'Diese E-Mail-Adresse wird bereits verwendet.';
        else {
            $token = issue_email_change($pdo, $userId, $newEmail);
            if ($token === null) $errors[] = 'Du kannst nur alle fünf Minuten eine neue Bestätigung anfordern.';
            else {
                $url = rtrim((string) $config['app_url'], '/') . '/confirm-email-change.php?token=' . urlencode($token);
                try {
                    send_app_mail($config, $newEmail, $user['username'], 'Neue E-Mail-Adresse bestätigen', mail_layout('Neue E-Mail-Adresse bestätigen', 'Bestätige die neue Adresse für dein Konto. Bis dahin bleibt deine bisherige E-Mail-Adresse aktiv. Der Link ist 60 Minuten gültig.', 'Neue E-Mail bestätigen', $url), "Neue E-Mail-Adresse bestätigen (60 Minuten gültig):\n$url");
                    $_SESSION['settings_message'] = 'Wir haben einen Bestätigungslink an die neue E-Mail-Adresse gesendet.';
                    header('Location: settings.php'); exit;
                } catch (Throwable $mailError) {
                    error_log('Email change mail failed: ' . get_class($mailError));
                    cancel_email_change($pdo, $userId, $token);
                    $errors[] = 'Die Bestätigungs-E-Mail konnte gerade nicht gesendet werden. Bitte versuche es später erneut.';
                }
            }
        }
    } elseif ($activeSection === 'password') {
        $currentPassword = is_string($_POST['current_password'] ?? null) ? $_POST['current_password'] : '';
        $newPassword = is_string($_POST['new_password'] ?? null) ? $_POST['new_password'] : '';
        $confirmation = is_string($_POST['password_confirmation'] ?? null) ? $_POST['password_confirmation'] : '';
        if (!password_verify($currentPassword, $user['password_hash'])) $errors[] = 'Das aktuelle Passwort ist nicht korrekt.';
        elseif (strlen($newPassword) < 8) $errors[] = 'Das neue Passwort muss mindestens 8 Zeichen lang sein.';
        elseif ($newPassword !== $confirmation) $errors[] = 'Die beiden neuen Passwörter stimmen nicht überein.';
        elseif (password_verify($newPassword, $user['password_hash'])) $errors[] = 'Das neue Passwort muss sich vom bisherigen Passwort unterscheiden.';
        else {
            $query = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $query->execute([password_hash($newPassword, PASSWORD_DEFAULT), $userId]);
            ensure_auth_tokens_table($pdo);
            $query = $pdo->prepare("UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND purpose = 'reset_password' AND used_at IS NULL");
            $query->execute([$userId]);
            session_regenerate_id(true);
            $_SESSION['settings_message'] = 'Dein Passwort wurde geändert.';
            header('Location: settings.php'); exit;
        }
    } elseif ($activeSection === 'delete') {
        $password = is_string($_POST['current_password'] ?? null) ? $_POST['current_password'] : '';
        $confirmation = is_string($_POST['delete_confirmation'] ?? null) ? trim($_POST['delete_confirmation']) : '';
        if (!password_verify($password, $user['password_hash'])) $errors[] = 'Das aktuelle Passwort ist nicht korrekt.';
        elseif ($confirmation !== 'LÖSCHEN') $errors[] = 'Bitte gib zur Bestätigung exakt LÖSCHEN ein.';
        else {
            try {
                $query = $pdo->prepare('DELETE FROM users WHERE id = ?');
                $query->execute([$userId]);
                if ($query->rowCount() !== 1) throw new RuntimeException('User deletion did not affect one row.');
                destroy_session();
                header('Location: index.php?account=deleted'); exit;
            } catch (Throwable $error) {
                error_log('Account deletion failed: ' . get_class($error));
                $errors[] = 'Der Account konnte gerade nicht gelöscht werden. Bitte versuche es später erneut.';
            }
        }
    } else {
        $errors[] = 'Unbekannte Aktion.';
    }
}
?>
<!DOCTYPE html><html lang="de"><head><?php portal_head('Kontoeinstellungen'); ?></head>
<body><?php require __DIR__ . '/site-header.php'; ?><main id="main-content" class="portal-shell settings-page">
    <div class="page-heading"><p class="eyebrow">Dein Konto</p><h1>Kontoeinstellungen</h1><p class="card-intro">Zugangsdaten verwalten oder dein Konto vollständig entfernen.</p><a class="secondary-link" href="account.php">← Zurück zum Account</a></div>
    <?php if ($message): ?><div class="message success" role="status"><p><?= escape((string) $message) ?></p></div><?php endif; ?>
    <?php if ($errors): ?><div class="message error" role="alert"><ul><?php foreach ($errors as $error): ?><li><?= escape($error) ?></li><?php endforeach; ?></ul></div><?php endif; ?>

    <div class="settings-grid">
        <section class="portal-panel"><p class="eyebrow">Öffentliches Profil</p><h2>Benutzername ändern</h2><form method="post" action="settings.php"><?= csrf_field() ?><input type="hidden" name="action" value="username"><label for="username">Benutzername</label><input id="username" name="username" type="text" minlength="3" maxlength="50" autocomplete="username" value="<?= escape($user['username']) ?>" required><button class="primary-button" type="submit">Benutzername speichern</button></form></section>
        <section class="portal-panel"><p class="eyebrow">Neue Adresse bestätigen</p><h2>E-Mail-Adresse ändern</h2><p>Aktuell: <strong><?= escape($user['email']) ?></strong></p><form method="post" action="settings.php"><?= csrf_field() ?><input type="hidden" name="action" value="email"><label for="email">Neue E-Mail-Adresse</label><input id="email" name="email" type="email" maxlength="255" autocomplete="email" required><label for="email-password">Aktuelles Passwort</label><input id="email-password" name="current_password" type="password" autocomplete="current-password" required><button class="primary-button" type="submit">Bestätigungslink senden</button></form></section>
        <section class="portal-panel"><p class="eyebrow">Zugang absichern</p><h2>Passwort ändern</h2><form method="post" action="settings.php"><?= csrf_field() ?><input type="hidden" name="action" value="password"><label for="password-current">Aktuelles Passwort</label><input id="password-current" name="current_password" type="password" autocomplete="current-password" required><label for="new-password">Neues Passwort</label><input id="new-password" name="new_password" type="password" minlength="8" autocomplete="new-password" required><label for="password-confirmation">Neues Passwort wiederholen</label><input id="password-confirmation" name="password_confirmation" type="password" minlength="8" autocomplete="new-password" required><button class="primary-button" type="submit">Passwort ändern</button></form></section>
        <section class="portal-panel danger-zone"><p class="eyebrow">Gefahrenbereich</p><h2>Account löschen</h2><p>Dadurch werden dein Account, deine Runden, Statistiken, Avatare und Abzeichen dauerhaft gelöscht.</p><form method="post" action="settings.php"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><label for="delete-password">Aktuelles Passwort</label><input id="delete-password" name="current_password" type="password" autocomplete="current-password" required><label for="delete-confirmation">Zur Bestätigung „LÖSCHEN“ eingeben</label><input id="delete-confirmation" name="delete_confirmation" type="text" autocomplete="off" required><button class="danger-button" type="submit">Account dauerhaft löschen</button></form></section>
    </div>
</main><?php require __DIR__ . '/site-footer.php'; ?></body></html>
