<?php

declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();

?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spielmodus wählen – 99 Luftballons</title>
    <link rel="stylesheet" href="style.css?v=multiplayer-lobby-1">
    <script src="theme.js?v=camp-1"></script>
</head>
<body>
    <?php require __DIR__ . '/site-header.php'; ?>
    <main id="main-content" class="portal-shell game-mode-shell">
        <header class="page-heading">
            <p class="eyebrow">Bereit für eine Runde?</p>
            <h1>Wähle deinen Spielmodus</h1>
            <p class="card-intro">Trainiere gegen die KI oder suche einen echten Gegner.</p>
        </header>
        <div class="game-mode-grid">
            <article class="game-mode-card game-mode-card--ai">
                <span class="game-mode-badge">Sofort spielbereit</span>
                <div class="game-mode-icon" aria-hidden="true">⚙</div>
                <p class="eyebrow">Einzelspieler</p>
                <h2>Gegen die KI</h2>
                <p>Verteidige deine Basis gegen den Computer und verbessere deine persönliche Bestzeit.</p>
                <ul class="game-mode-features">
                    <li>Direkter Spielstart</li>
                    <li>30 zunehmend schwere Runden</li>
                    <li>Ergebnisse für Statistiken und Bestenliste</li>
                </ul>
                <a class="primary-link" href="game/index.php">KI-Duell starten <span aria-hidden="true">→</span></a>
            </article>
            <article class="game-mode-card game-mode-card--online">
                <span class="game-mode-badge game-mode-badge--online">Neue Online-Lobby</span>
                <div class="game-mode-icon" aria-hidden="true">⚔</div>
                <p class="eyebrow">Mehrspieler</p>
                <h2>Online-Duell</h2>
                <p>Tritt der Warteschlange bei und lass dir automatisch einen anderen Ballonjäger zuweisen.</p>
                <ul class="game-mode-features">
                    <li>Automatische Gegnersuche</li>
                    <li>Faire zufällige Seitenverteilung</li>
                    <li>Live-Duell folgt im nächsten Ausbaupaket</li>
                </ul>
                <a class="primary-link primary-link--blue" href="multiplayer.php">Gegner suchen <span aria-hidden="true">→</span></a>
            </article>
        </div>
        <div class="mode-back-link"><a class="secondary-link" href="menu.php">Zurück zum Basislager</a></div>
    </main>
    <?php require __DIR__ . '/site-footer.php'; ?>
</body>
</html>
