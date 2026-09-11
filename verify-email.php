<?php

declare(strict_types=1);

require __DIR__ . '/db.php';

$verified = false;
$message = 'Der Bestätigungslink ist ungültig oder wurde bereits verwendet.';
$token = $_GET['token'] ?? '';

if (is_string($token) && strlen($token) === 64 && ctype_xdigit($token)) {
    $statement = $pdo->prepare(
        'UPDATE users
         SET email_verified_at = NOW(), verification_token = NULL
         WHERE verification_token = ? AND email_verified_at IS NULL'
    );
    $statement->execute([$token]);

    if ($statement->rowCount() === 1) {
        $verified = true;
        $message = 'Deine E-Mail-Adresse wurde erfolgreich bestätigt. Du kannst dich jetzt anmelden.';
    }
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E-Mail bestätigen – 99 Luftballons</title>
    <link rel="stylesheet" href="style.css?v=legal-1">
    <script src="theme.js?v=camp-1"></script>
</head>
<body class="auth-page">
    <?php require __DIR__ . '/site-header.php'; ?>
    <main id="main-content" class="auth-card">
        <div class="verification-icon <?= $verified ? 'is-success' : 'is-error' ?>" aria-hidden="true"><?= $verified ? '✓' : '!' ?></div>
        <p class="eyebrow">Fast startklar</p>
        <h1>E-Mail bestätigen</h1>
        <div class="message <?= $verified ? 'success' : 'error' ?>">
            <p><?= htmlspecialchars($message, ENT_QUOTES, 'UTF-8') ?></p>
        </div>
        <a class="primary-link" href="login.php">Zum Login</a>
    </main>
    <?php require __DIR__ . '/site-footer.php'; ?>
</body>
</html>
