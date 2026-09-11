<?php
// Shared presentation only: no session or database changes here.
require_once __DIR__ . '/avatars.php';
$headerLoggedIn = isset($_SESSION['user_id']);
$headerPage = basename($_SERVER['SCRIPT_NAME'] ?? '');
$headerLinks = $headerLoggedIn
    ? ['menu.php' => 'Basislager', 'instructions.php' => 'Anleitung', 'leaderboard.php' => 'Bestenliste', 'history.php' => 'Meine Runden']
    : ['instructions.php' => 'Anleitung', 'leaderboard.php' => 'Bestenliste', 'login.php' => 'Anmelden', 'register.php' => 'Mitspielen'];
?>
<a class="skip-link" href="#main-content">Zum Inhalt</a>
<header class="site-header">
    <a class="brand" href="index.php" aria-label="99 Luftballons – Startseite">
        <img class="brand-logo" src="assets/img/branding/logo.png" alt="99 Luftballons" width="1024" height="512">
    </a>
    <nav aria-label="Hauptnavigation">
        <?php foreach ($headerLinks as $href => $label): ?>
            <a href="<?= $href ?>"<?= $headerPage === $href ? ' aria-current="page"' : '' ?>><?= $label ?></a>
        <?php endforeach; ?>
        <?php if ($headerLoggedIn): ?>
            <a href="logout.php">Logout</a>
        <?php endif; ?>
        <button class="theme-toggle" type="button" aria-label="Dunkles Design aktivieren" aria-pressed="false" hidden>
            <svg class="theme-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
            <svg class="theme-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A9 9 0 0 1 8.5 4a9 9 0 1 0 11.5 11.5Z"/></svg>
        </button>
        <?php if ($headerLoggedIn): $headerAvatar = avatar_data($_SESSION['avatar_code'] ?? 'forest_guardian'); ?>
            <?php $headerAccountCurrent = in_array($headerPage, ['account.php', 'settings.php'], true); ?>
            <a class="header-avatar<?= $headerAccountCurrent ? ' is-current' : '' ?>" href="account.php" aria-label="Account – Avatar <?= htmlspecialchars($headerAvatar['name'], ENT_QUOTES, 'UTF-8') ?>"<?= $headerAccountCurrent ? ' aria-current="page"' : '' ?>><img src="<?= htmlspecialchars($headerAvatar['image'], ENT_QUOTES, 'UTF-8') ?>" alt="" width="512" height="512"></a>
        <?php endif; ?>
    </nav>
</header>
