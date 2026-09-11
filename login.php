<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require __DIR__ . '/db.php';

if (isset($_SESSION['user_id'])) {
    header('Location: menu.php');
    exit;
}

$error = '';
$identifier = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $identifier = trim($_POST['identifier'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($identifier === '' || $password === '') {
        $error = 'Bitte fülle alle Felder aus.';
    } else {
        $statement = $pdo->prepare(
            'SELECT id, username, password_hash, email_verified_at
             FROM users
             WHERE username = ? OR email = ?
             LIMIT 1'
        );
        $statement->execute([$identifier, strtolower($identifier)]);
        $user = $statement->fetch();

        if ($user === false || !password_verify($password, $user['password_hash'])) {
            $error = 'Benutzername/E-Mail oder Passwort ist falsch.';
        } elseif ($user['email_verified_at'] === null) {
            $error = 'Bitte bestätige zuerst deine E-Mail-Adresse.';
        } else {
            session_regenerate_id(true);
            $_SESSION['user_id'] = (int) $user['id'];

            header('Location: menu.php');
            exit;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login – 99 Luftballons</title>
    <link rel="stylesheet" href="style.css?v=portal-1">
    <script src="password-toggle.js" defer></script>
    <script src="theme.js?v=camp-1"></script>
</head>
<body class="auth-page">
    <?php require __DIR__ . '/site-header.php'; ?>
    <main id="main-content" class="auth-card">
        <p class="eyebrow">Willkommen zurück</p>
        <h1>Bereit für eine Runde?</h1>
        <p class="card-intro">Melde dich an. Dein Basislager wartet.</p>

        <?php if ($error !== ''): ?>
            <div class="message error" role="alert">
                <p><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p>
            </div>
        <?php endif; ?>

        <form method="post" action="login.php">
            <label for="identifier">Benutzername oder E-Mail-Adresse</label>
            <input
                id="identifier"
                name="identifier"
                type="text"
                autocomplete="username"
                value="<?= htmlspecialchars($identifier, ENT_QUOTES, 'UTF-8') ?>"
                required
            >

            <label for="password">Passwort</label>
            <div class="password-field">
                <input id="password" name="password" type="password" autocomplete="current-password" required>
                <button class="password-toggle" type="button" data-password-target="password" aria-label="Passwort anzeigen">👁</button>
            </div>

            <button class="primary-button" type="submit">Einloggen</button>
        </form>

        <p class="auth-link">Noch kein Account? <a href="register.php">Jetzt registrieren</a></p>
    </main>
</body>
</html>
