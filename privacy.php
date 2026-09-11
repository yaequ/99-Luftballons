<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require __DIR__ . '/portal.php';
?>
<!DOCTYPE html><html lang="de">
<head><?php portal_head('Datenschutz'); ?><meta name="robots" content="noindex"></head>
<body><?php require __DIR__ . '/site-header.php'; ?>
<main id="main-content" class="portal-shell legal-page">
    <div class="page-heading"><p class="eyebrow">Deine Daten im Blick</p><h1>Datenschutz</h1><p class="card-intro">Kurz und verständlich: welche Daten dieses Webprojekt verarbeitet und warum.</p></div>

    <section class="portal-panel legal-copy">
        <h2>1. Verantwortliche Person</h2>
        <address><mark>Max Mustermann</mark> · <mark>Musterstraße 12, 12345 Musterstadt</mark><br>E-Mail: <a href="mailto:max.mustermann@example.com"><mark>max.mustermann@example.com</mark></a></address>

        <h2>2. Hosting und Serverprotokolle</h2>
        <p>Die Website wird bei IONOS gehostet. Beim Aufruf können technisch erforderliche Daten wie IP-Adresse, Zeitpunkt, angeforderte Seite, übertragene Datenmenge, Browser und Betriebssystem in Serverprotokollen verarbeitet werden. Dies dient dem sicheren und störungsfreien Betrieb der Website. Rechtsgrundlage ist das berechtigte Interesse an Sicherheit und Funktionsfähigkeit gemäß Art. 6 Abs. 1 lit. f DSGVO. Die konkrete Speicherdauer richtet sich nach der Konfiguration des Hosting-Anbieters und muss vom Betreiber geprüft werden.</p>

        <h2>3. Registrierung und Benutzerkonto</h2>
        <p>Bei der Registrierung werden Benutzername, E-Mail-Adresse, ein sicherer Hash des Passworts, der Status der E-Mail-Bestätigung, der gewählte Profilavatar und der Zeitpunkt der Kontoerstellung gespeichert. Für E-Mail-Bestätigungen und das Zurücksetzen eines Passworts werden zeitlich begrenzte, gehashte Einmal-Tokens verarbeitet. Transaktions-E-Mails werden über den SMTP-Dienst von IONOS versendet. Diese Daten werden benötigt, um das Benutzerkonto und die Anmeldung bereitzustellen. Das eingegebene Passwort wird nicht im Klartext gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.</p>

        <h2>4. Spielergebnisse</h2>
        <p>Für Statistiken, Spielverlauf und Bestenliste werden Ergebnis, Spieldauer, erreichte Runde und Zeitpunkt einer Partie mit dem Benutzerkonto verknüpft. In der öffentlichen Bestenliste erscheinen Benutzername, Anzahl der Siege und Bestzeit. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.</p>

        <h2>5. Session und Designwahl</h2>
        <p>Für die Anmeldung verwendet die Website ein technisch notwendiges Session-Cookie. Es ist mit <code>HttpOnly</code> und <code>SameSite=Lax</code> abgesichert und wird bei verschlüsseltem Zugriff nur über HTTPS übertragen. Die Auswahl zwischen hellem und dunklem Design wird ausschließlich lokal im Browser gespeichert. Es werden keine Analyse- oder Werbe-Cookies eingesetzt.</p>

        <h2>6. Speicherdauer</h2>
        <p>Kontodaten und zugehörige Spielergebnisse bleiben grundsätzlich gespeichert, solange das Benutzerkonto besteht. Nicht mehr benötigte Daten werden gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Die tatsächlichen Löschabläufe müssen vor dem Produktivbetrieb festgelegt und dokumentiert werden.</p>

        <h2>7. Empfänger und Übermittlung</h2>
        <p>Technische Daten können im Rahmen des Hostings durch IONOS verarbeitet werden. Eine Übermittlung zu Werbe- oder Analysezwecken findet über diese Website nicht statt. Ob und welche Unterauftragnehmer der Hosting-Anbieter einsetzt, ist anhand des abgeschlossenen Hosting-Vertrags zu ergänzen.</p>

        <h2>8. Deine Rechte</h2>
        <p>Betroffene Personen haben – abhängig von den gesetzlichen Voraussetzungen – insbesondere Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Außerdem besteht ein Beschwerderecht bei einer zuständigen Datenschutzaufsichtsbehörde.</p>

        <h2>9. Sicherheit und Aktualität</h2>
        <p>Die Website nutzt HTTPS und angemessene technische Schutzmaßnahmen. Diese Datenschutzerklärung entspricht dem derzeitigen Stand des Webprojekts. Werden neue Funktionen oder externe Dienste ergänzt, muss sie entsprechend aktualisiert werden.</p>
    </section>
</main>
<?php require __DIR__ . '/site-footer.php'; ?>
</body></html>
