<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require __DIR__ . '/db.php';
require __DIR__ . '/portal.php';
require __DIR__ . '/account-security.php';
require __DIR__ . '/account-management.php';
$token = $_GET['token'] ?? '';
$changed = false;
if (is_string($token)) {
    try {
        $changedUserId = consume_email_change($pdo, strtolower(trim($token)));
        $changed = $changedUserId !== null;
    } catch (PDOException $error) {
        error_log('Email change confirmation failed: ' . $error->getCode());
    }
}
?>
<!DOCTYPE html><html lang="de"><head><?php portal_head('E-Mail-Wechsel bestätigen'); ?></head>
<body class="auth-page"><?php require __DIR__ . '/site-header.php'; ?><main id="main-content" class="auth-card">
    <div class="verification-icon <?= $changed ? 'is-success' : 'is-error' ?>" aria-hidden="true"><?= $changed ? '✓' : '!' ?></div>
    <p class="eyebrow">Kontoeinstellungen</p><h1>E-Mail-Adresse ändern</h1>
    <div class="message <?= $changed ? 'success' : 'error' ?>"><p><?= $changed ? 'Deine neue E-Mail-Adresse wurde bestätigt und ist ab sofort aktiv.' : 'Der Bestätigungslink ist ungültig, abgelaufen oder die Adresse wird bereits verwendet.' ?></p></div>
    <a class="primary-link" href="<?= isset($_SESSION['user_id']) ? 'settings.php' : 'login.php' ?>"><?= isset($_SESSION['user_id']) ? 'Zu den Einstellungen' : 'Zum Login' ?></a>
</main><?php require __DIR__ . '/site-footer.php'; ?></body></html>
