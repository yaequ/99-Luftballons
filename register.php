<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require __DIR__ . '/db.php';

if (isset($_SESSION['user_id'])) {
    header('Location: menu.php');
    exit;
}

$errors = [];
$username = '';
$email = '';
$verificationLink = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $email = strtolower(trim($_POST['email'] ?? ''));
    $password = $_POST['password'] ?? '';
    $passwordConfirmation = $_POST['password_confirmation'] ?? '';

    if ($username === '') {
        $errors[] = 'Bitte gib einen Benutzernamen ein.';
    } elseif (strlen($username) < 3 || strlen($username) > 50) {
        $errors[] = 'Der Benutzername muss zwischen 3 und 50 Zeichen lang sein.';
    }

    if ($email === '') {
        $errors[] = 'Bitte gib eine E-Mail-Adresse ein.';
    } elseif (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $errors[] = 'Bitte gib eine gültige E-Mail-Adresse ein.';
    } elseif (strlen($email) > 255) {
        $errors[] = 'Die E-Mail-Adresse ist zu lang.';
    }

    if ($password === '') {
        $errors[] = 'Bitte gib ein Passwort ein.';
    } elseif (strlen($password) < 8) {
        $errors[] = 'Das Passwort muss mindestens 8 Zeichen lang sein.';
    }

    if ($password !== $passwordConfirmation) {
        $errors[] = 'Die beiden Passwörter stimmen nicht überein.';
    }

    if ($errors === []) {
        $statement = $pdo->prepare(
            'SELECT username, email FROM users WHERE username = ? OR email = ?'
        );
        $statement->execute([$username, $email]);
        $existingUsers = $statement->fetchAll();

        foreach ($existingUsers as $existingUser) {
            if (strcasecmp($existingUser['username'], $username) === 0) {
                $errors[] = 'Dieser Benutzername ist bereits vergeben.';
            }

            if (strcasecmp($existingUser['email'], $email) === 0) {
                $errors[] = 'Diese E-Mail-Adresse ist bereits registriert.';
            }
        }
    }

    if ($errors === []) {
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $verificationToken = bin2hex(random_bytes(32));

        try {
            $statement = $pdo->prepare(
                'INSERT INTO users
                    (username, email, password_hash, verification_token, email_verified_at)
                 VALUES (?, ?, ?, ?, NULL)'
            );
            $statement->execute([$username, $email, $passwordHash, $verificationToken]);

            $appUrl = rtrim($config['app_url'], '/');
            $verificationLink = $appUrl . '/verify-email.php?token=' . urlencode($verificationToken);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                $errors[] = 'Benutzername oder E-Mail-Adresse sind bereits vergeben.';
            } else {
                $errors[] = 'Der Account konnte nicht erstellt werden. Bitte versuche es erneut.';
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registrieren – 99 Luftballons</title>
    <link rel="stylesheet" href="style.css">
    <script src="password-toggle.js" defer></script>
</head>
<body class="auth-page">
    <main class="auth-card">
        <h1>Account erstellen</h1>

        <?php if ($verificationLink !== ''): ?>
            <div class="message success">
                <p>Dein Account wurde erstellt. Bestätige jetzt deine E-Mail-Adresse:</p>
                <p><a href="<?= htmlspecialchars($verificationLink, ENT_QUOTES, 'UTF-8') ?>">E-Mail-Adresse bestätigen</a></p>
                <p class="development-note">Dieser Link wird nur für den Entwicklungsstand direkt angezeigt.</p>
            </div>
        <?php else: ?>
            <?php if ($errors !== []): ?>
                <div class="message error" role="alert">
                    <ul>
                        <?php foreach ($errors as $error): ?>
                            <li><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            <?php endif; ?>

            <form method="post" action="register.php">
                <label for="username">Benutzername</label>
                <input
                    id="username"
                    name="username"
                    type="text"
                    maxlength="50"
                    autocomplete="username"
                    value="<?= htmlspecialchars($username, ENT_QUOTES, 'UTF-8') ?>"
                    required
                >

                <label for="email">E-Mail-Adresse</label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    maxlength="255"
                    autocomplete="email"
                    value="<?= htmlspecialchars($email, ENT_QUOTES, 'UTF-8') ?>"
                    required
                >

                <label for="password">Passwort</label>
                <div class="password-field">
                    <input id="password" name="password" type="password" minlength="8" autocomplete="new-password" required>
                    <button class="password-toggle" type="button" data-password-target="password" aria-label="Passwort anzeigen">👁</button>
                </div>

                <label for="password_confirmation">Passwort wiederholen</label>
                <div class="password-field">
                    <input id="password_confirmation" name="password_confirmation" type="password" minlength="8" autocomplete="new-password" required>
                    <button class="password-toggle" type="button" data-password-target="password_confirmation" aria-label="Passwort anzeigen">👁</button>
                </div>

                <button class="primary-button" type="submit">Account erstellen</button>
            </form>

            <p class="auth-link">Bereits registriert? <a href="login.php">Zum Login</a></p>
        <?php endif; ?>
    </main>
</body>
</html>
