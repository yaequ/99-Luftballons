<?php
$footerPage = basename($_SERVER['SCRIPT_NAME'] ?? '');
?>
<footer class="site-footer">
    <div class="site-footer-inner">
        <a class="footer-brand" href="index.php">
            <img class="footer-logo" src="assets/img/branding/logo.png" alt="99 Luftballons" width="1024" height="512" loading="lazy">
        </a>
        <nav aria-label="Rechtliche Informationen">
            <a href="imprint.php"<?= $footerPage === 'imprint.php' ? ' aria-current="page"' : '' ?>>Impressum</a>
            <a href="privacy.php"<?= $footerPage === 'privacy.php' ? ' aria-current="page"' : '' ?>>Datenschutz</a>
        </nav>
        <p>© <?= date('Y') ?> 99 Luftballons</p>
    </div>
</footer>
