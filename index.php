<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require __DIR__ . '/portal.php';
$top = [];
$rankingUnavailable = false;
try {
    require __DIR__ . '/db.php';
    $top = rankings($pdo, 'fastest', 'all', null, 3)['entries'];
} catch (Throwable $error) {
    // The public introduction remains available during database outages.
    error_log('Landing leaderboard unavailable: ' . get_class($error));
    $rankingUnavailable = true;
}
$loggedIn = isset($_SESSION['user_id']);
?>
<!DOCTYPE html>
<html lang="de">
<head><?php portal_head('Verteidige deine Basis'); ?><meta name="description" content="99 Luftballons: kostenloses Tower-Defense-Duell gegen die KI. Baue Türme, sende Ballons und verteidige deine Basis in 30 Runden."></head>
<body>
<?php require __DIR__ . '/site-header.php'; ?>
<main id="main-content" class="portal-shell">
    <section class="portal-panel landing-hero">
        <div>
            <p class="eyebrow">Kleine Ballons. Großes Abenteuer.</p>
            <h1>Deine Basis.<br>Deine Strategie.</h1>
            <p class="card-intro">Ein Tower-Defense-Duell gegen die KI. Baue deine Verteidigung, schicke Ballons zum Gegner und halte deine Basis am Leben.</p>
            <div class="button-row">
                <a class="primary-link" href="<?= $loggedIn ? 'game.php' : 'register.php' ?>"><?= $loggedIn ? 'Spiel starten' : 'Jetzt mitspielen' ?> <span aria-hidden="true">→</span></a>
                <a class="secondary-link" href="<?= $loggedIn ? 'menu.php' : 'login.php' ?>"><?= $loggedIn ? 'Zum Basislager' : 'Anmelden' ?></a>
            </div>
            <p class="camp-footnote">Im Browser · Gegen die KI · 30 Runden</p>
        </div>
        <figure class="map-preview">
            <img src="game/assets/Maps/Grafik.webp" alt="Waldkarte aus dem Spiel mit Bauflächen, Wegen und Basis" width="1024" height="765">
            <figcaption><span class="map-caption-icon" aria-hidden="true">⌁</span><span><small>Entdecke die Spielwelt</small><strong>Ein Abenteuer zwischen Wald und Bergen</strong></span></figcaption>
        </figure>
    </section>
    <section class="portal-section" aria-labelledby="how-title">
        <p class="eyebrow">Schnell erklärt</p><h2 id="how-title">So funktioniert’s</h2>
        <div class="feature-grid">
            <article class="portal-panel"><span class="step-number">01</span><h3>Baue deine Türme</h3><p>Kaktus, Gebläse oder Lupe: Wähle deinen Turm und platziere ihn auf einer Baufläche.</p></article>
            <article class="portal-panel"><span class="step-number">02</span><h3>Schicke Ballons los</h3><p>Setze die KI unter Druck. Angriffe kosten Gold und erhöhen dein laufendes Einkommen.</p></article>
            <article class="portal-panel"><span class="step-number">03</span><h3>Verteidige deine Basis</h3><p>Besiege die KI oder überlebe alle 30 Runden. Jeder gespeicherte Sieg zählt.</p></article>
        </div>
        <a class="text-link" href="instructions.php">Zur vollständigen Spielanleitung →</a>
    </section>
    <section class="portal-panel portal-section" aria-labelledby="top-title">
        <div class="section-heading"><div><p class="eyebrow">Die schnellsten Sieger</p><h2 id="top-title">Ein Platz ganz oben.</h2></div><a class="secondary-link" href="leaderboard.php">Gesamte Bestenliste</a></div>
        <?php if ($rankingUnavailable): ?><p class="message">Die Bestenliste ist gerade nicht verfügbar. Versuche es später noch einmal.</p><?php else: podium($top); endif; ?>
    </section>
    <section class="portal-section" aria-labelledby="maps-title">
        <p class="eyebrow">Aus unserer Spielwelt</p><h2 id="maps-title">Vier Landschaften. Ein Ziel.</h2>
        <div class="map-gallery">
            <?php foreach (['Grafik.webp'=>'Waldweg', 'Grafik_2.webp'=>'Bergpass', 'image.webp'=>'Wüstendünen', 'image2.webp'=>'Frostpfad'] as $file=>$name): ?>
            <figure><img src="game/assets/Maps/<?= $file ?>" alt="<?= $name ?> – Kartenansicht aus dem Spiel" loading="lazy" width="960" height="720"><figcaption><?= $name ?></figcaption></figure>
            <?php endforeach; ?>
        </div>
    </section>
</main>
</body></html>
