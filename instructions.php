<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require __DIR__ . '/portal.php';
?>
<!DOCTYPE html><html lang="de">
<head><?php portal_head('Spielanleitung'); ?></head>
<body><?php require __DIR__ . '/site-header.php'; ?>
<main id="main-content" class="portal-shell">
    <div class="page-heading"><p class="eyebrow">Dein erster Einsatz</p><h1>So hältst du die Basis.</h1><p class="card-intro">Bauen, verteidigen, angreifen: dein Einstieg in 99 Luftballons.</p></div>
    <nav class="filter-pills guide-nav" aria-label="Abschnitte der Spielanleitung"><a href="#goal">Ziel</a><a href="#towers">Türme</a><a href="#balloons">Ballons</a><a href="#controls">Steuerung</a></nav>
    <section class="portal-panel" id="goal">
        <p class="eyebrow">Du gegen die KI</p><h2>Jede Basis zählt.</h2>
        <p>Du verteidigst deine eigene Karte, während die KI auf ihrer Karte baut. Ballons folgen den Wegen. Erreichen sie deine Basis, verlierst du Lebenspunkte. Mit Gold kaufst du Türme und schickst zusätzliche Ballons zum Gegner.</p>
        <div class="feature-grid">
            <article><span class="step-number">01</span><h3>Vorbereiten</h3><p>Wähle einen Turm und platziere ihn auf einer dunklen Baufläche. Starte danach mit „Spiel starten“ die erste Runde.</p></article>
            <article><span class="step-number">02</span><h3>Durchhalten</h3><p>Es gibt 30 Runden. Mit Auto-Start beginnt die nächste Runde nach der Rundenpause automatisch; andernfalls startest du sie selbst.</p></article>
            <article><span class="step-number">03</span><h3>Gewinnen</h3><p>Du gewinnst, wenn die KI keine Lebenspunkte mehr hat oder du alle 30 Runden überlebst. Erreicht deine Basis 0 HP, verlierst du.</p></article>
        </div>
    </section>
    <section class="portal-panel portal-section" id="towers">
        <p class="eyebrow">Deine Verteidigung</p><h2>Drei Türme, drei Stärken.</h2>
        <div class="feature-grid">
            <article><span class="tower-price">25 Gold</span><h3>Kaktus</h3><p>Günstiger Einstieg für deine Verteidigung. Geringer Schaden, kurze Reichweite.</p></article>
            <article><span class="tower-price">45 Gold</span><h3>Gebläse</h3><p>Greift besonders häufig an und hat mehr Reichweite als der Kaktus.</p></article>
            <article><span class="tower-price">70 Gold</span><h3>Lupe</h3><p>Hoher Schaden und die größte Reichweite. Dafür mehr Zeit zwischen den Angriffen.</p></article>
        </div>
        <p>Türme lassen sich auf den vorgesehenen Bauflächen platzieren. Achte darauf, dass ihr Radius den Weg abdeckt und du genug Gold übrig hast.</p>
    </section>
    <section class="portal-panel portal-section" id="balloons">
        <p class="eyebrow">Dein Angriff</p><h2>Mehr als nur bunte Ballons.</h2>
        <p>Mit jedem Angriff schickst du eine Gruppe von 10 Ballons. Der Kauf erhöht zugleich dein Einkommen pro Sekunde. Die Farben unterscheiden sich in Widerstandskraft und Geschwindigkeit.</p>
        <div class="leaderboard-table-wrapper"><table class="leaderboard-table">
            <caption class="table-caption">Angriffskosten und Einkommen pro gekauftem Paket</caption>
            <thead><tr><th scope="col">Ballon</th><th scope="col">Kosten</th><th scope="col">Einkommen</th><th scope="col">Eigenschaft</th></tr></thead>
            <tbody>
                <tr><th scope="row"><span class="balloon-dot red"></span> Rot</th><td>10 Gold</td><td>+1/s</td><td>1 HP · günstiger Angriff</td></tr>
                <tr><th scope="row"><span class="balloon-dot blue"></span> Blau</th><td>25 Gold</td><td>+2/s</td><td>2 HP · am schnellsten</td></tr>
                <tr><th scope="row"><span class="balloon-dot green"></span> Grün</th><td>45 Gold</td><td>+4/s</td><td>4 HP · widerstandsfähiger</td></tr>
                <tr><th scope="row"><span class="balloon-dot yellow"></span> Gelb</th><td>70 Gold</td><td>+7/s</td><td>7 HP · langsam, aber robust</td></tr>
            </tbody>
        </table></div>
        <p><strong>Die Bosse:</strong> In Runde 29 kommt ein Boss, in Runde 30 kommen zwei. Jeder hat 150 HP und verursacht 25 Basisschaden, wenn er durchkommt. Bosse kannst du nicht selbst kaufen.</p>
    </section>
    <section class="portal-panel portal-section" id="controls">
        <p class="eyebrow">Alles im Griff</p><h2>Maus und Tastatur.</h2>
        <dl class="controls-list">
            <dt>Maus / Touch</dt><dd>Turm auswählen, anschließend eine passende Bauposition auf deiner Karte anklicken oder antippen.</dd>
            <dt><kbd>Tab</kbd></dt><dd>Zwischen Schaltflächen und deiner Karte wechseln. Wähle einen Turm und fokussiere die Karte.</dd>
            <dt><kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd></dt><dd>Den Baucursor auf der fokussierten Karte bewegen.</dd>
            <dt><kbd>Enter</kbd> / <kbd>Escape</kbd></dt><dd>Den ausgewählten Turm platzieren / die Auswahl abbrechen.</dd>
            <dt>Pausieren</dt><dd>Mit der Schaltfläche über dem Spiel pausieren und anschließend fortsetzen.</dd>
            <dt>Interface ausblenden</dt><dd>Die Bedienflächen einklappen, um mehr Platz für die Karten zu haben.</dd>
        </dl>
        <p>Auf einem größeren Bildschirm kannst du beide Karten besonders gut im Blick behalten.</p>
        <div class="button-row"><a class="primary-link" href="<?= isset($_SESSION['user_id']) ? 'game.php' : 'register.php' ?>">Los geht’s →</a><a class="secondary-link" href="index.php">Zur Startseite</a></div>
    </section>
</main><?php require __DIR__ . '/site-footer.php'; ?></body></html>
