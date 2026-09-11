<?php
// Shared presentation only: no session or database changes here.
$headerLoggedIn = isset($_SESSION['user_id']);
$headerPage = basename($_SERVER['SCRIPT_NAME'] ?? '');
$headerLinks = $headerLoggedIn
    ? ['menu.php' => 'Basislager', 'instructions.php' => 'Anleitung', 'leaderboard.php' => 'Bestenliste', 'history.php' => 'Meine Runden', 'account.php' => 'Account', 'logout.php' => 'Logout']
    : ['instructions.php' => 'Anleitung', 'leaderboard.php' => 'Bestenliste', 'login.php' => 'Anmelden', 'register.php' => 'Mitspielen'];
?>
<a class="skip-link" href="#main-content">Zum Inhalt</a>
<header class="site-header">
    <a class="brand" href="index.php" aria-label="99 Luftballons – Startseite">
        <span class="brand-balloons" aria-hidden="true"><i></i><i></i><i></i></span>
        <span><strong>99 Luftballons</strong><small>Ein kleines Stück Abenteuer.</small></span>
    </a>
    <nav aria-label="Hauptnavigation">
        <?php foreach ($headerLinks as $href => $label): ?>
            <a href="<?= $href ?>"<?= $headerPage === $href ? ' aria-current="page"' : '' ?>><?= $label ?></a>
        <?php endforeach; ?>
        <button class="theme-toggle" type="button" aria-label="Dunkles Design aktivieren" aria-pressed="false" hidden>
            <svg class="theme-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
            <svg class="theme-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A9 9 0 0 1 8.5 4a9 9 0 1 0 11.5 11.5Z"/></svg>
        </button>
    </nav>
</header>
