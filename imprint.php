<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require __DIR__ . '/portal.php';
?>
<!DOCTYPE html><html lang="de">
<head><?php portal_head('Impressum'); ?><meta name="robots" content="noindex"></head>
<body><?php require __DIR__ . '/site-header.php'; ?>
<main id="main-content" class="portal-shell legal-page">
    <div class="page-heading"><p class="eyebrow">Kontakt &amp; Verantwortung</p><h1>Impressum</h1><p class="card-intro">Angaben zum Betreiber dieses Webprojekts.</p></div>

    <aside class="placeholder-notice" role="note">
        <strong>Vorlage mit Beispieldaten</strong>
        <p>Die gelb markierten Angaben müssen vor einer echten Veröffentlichung durch die korrekten Betreiber- und Kontaktdaten ersetzt werden.</p>
    </aside>

    <div class="legal-grid">
        <section class="portal-panel">
            <p class="eyebrow">Anbieter</p><h2>Angaben gemäß § 5 DDG</h2>
            <address>
                <mark>Max Mustermann</mark><br>
                <mark>Musterstraße 12</mark><br>
                <mark>12345 Musterstadt</mark><br>
                Deutschland
            </address>
        </section>
        <section class="portal-panel">
            <p class="eyebrow">Direkter Kontakt</p><h2>So erreichst du uns</h2>
            <address>
                E-Mail: <a href="mailto:max.mustermann@example.com"><mark>max.mustermann@example.com</mark></a><br>
                Telefon: <a href="tel:+491234567890"><mark>+49 123 4567890</mark></a>
            </address>
        </section>
    </div>

    <section class="portal-panel portal-section legal-copy">
        <h2>Hinweis zum Projekt</h2>
        <p>„99 Luftballons“ ist ein nicht kommerzielles Webprojekt im Rahmen eines Hochschulmoduls. Es besteht keine Verbindung zu Künstlern, Plattenfirmen oder anderen Rechteinhabern mit ähnlichen Namen.</p>
        <h2>Verantwortung für Inhalte</h2>
        <p>Die Inhalte dieser Website wurden sorgfältig erstellt. Hinweise auf fehlerhafte oder problematische Inhalte können über die oben genannte Kontaktadresse gemeldet werden.</p>
        <h2>Urheberrecht</h2>
        <p>Die auf dieser Website erstellten Inhalte und Werke unterliegen dem geltenden Urheberrecht. Eine Verwendung außerhalb der gesetzlichen Grenzen bedarf der Zustimmung der jeweiligen Rechteinhaber.</p>
    </section>
</main>
<?php require __DIR__ . '/site-footer.php'; ?>
</body></html>
