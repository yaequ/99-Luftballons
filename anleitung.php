<?php
declare(strict_types=1);
header('Content-Type: text/html; charset=UTF-8');
$portalMode = defined('GAME_PORTAL_MODE') && GAME_PORTAL_MODE === true;
?>
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>99 Luftballons – Spielanleitung</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="modal-content pixel-frame" style="margin: 32px auto; width: min(680px, calc(100% - 24px)); text-align: left;">
    <h1>99 Luftballons</h1>
    <p>Diese PHP-Version wird über einen Webserver geöffnet. Das Spiel läuft mit JavaScript im Browser.</p>
    <ol>
      <li>Klicke auf „Spiel starten“.</li>
      <li>Wähle Kaktus, Gebläse oder Lupe. Klicke danach auf eine dunkle Baufläche deiner Karte.</li>
      <li>Ziehe einen eigenen Turm auf einen freien Bauplatz, um ihn kostenlos zu verschieben.</li>
      <li>Wähle für ein Kauf-Upgrade erneut denselben Turm in der Turmauswahl. Bewege seine Bauvorschau über den vorhandenen Stufe-1-Turm. Bei „Zu Stufe 2 verschmelzen“ klicke auf das Ziel. Der normale Kaufpreis wird einmal abgezogen. Es bleibt genau ein Stufe-2-Turm stehen und die Bauauswahl endet.</li>
      <li>Beim Darüberfahren wird nichts gekauft oder verändert. Du kannst die Vorschau zurück auf eine freie Baufläche bewegen und dort normal bauen. Neue Türme aus der Auswahl sind immer Stufe 1.</li>
      <li>Du kannst auch zwei bereits platzierte Türme desselben Typs und derselben Stufe aufeinanderziehen. Stufe 1 + 1 ergibt Stufe 2. Stufe 2 + 2 ergibt Stufe 3. Diese Verschmelzung kostet kein zusätzliches Gold.</li>
      <li>Beim Darüberfahren siehst du Turmtyp, Stufe und Schaden. Der Mauszeiger wird zur Greifhand.</li>
      <li>Beim Ziehen zeigen grüne Markierungen passende Ziele. Sobald „Loslassen zum Verschmelzen“ erscheint, lässt du die Maustaste los. Erst dann verschmelzen die Türme.</li>
      <li>Ungültige Drops verändern nichts. Während einer Pause musst du zuerst das Spiel fortsetzen.</li>
      <li>Klicke einen Turm an und wähle „Turm entfernen“. Erst „Ja, entfernen“ löscht den Turm.</li>
    </ol>
    <p>Stufe 1 verursacht den Basisschaden. Stufe 2 verursacht das 1,5-Fache. Stufe 3 verursacht das 2,5-Fache. Reichweite und Angriffstempo bleiben gleich.</p>
    <p>Nach der Turmauswahl kannst du auch Pfeiltasten und Enter zum Bauen nutzen. Escape bricht die Auswahl oder das Ziehen ab. Mit „I“ blendest du das Interface ein oder aus.</p>
    <p>Beide Seiten erhalten 5 Gold pro Sekunde und 2 Gold pro zerstörtem Ballon. Ballonkäufe erhöhen dein Einkommen um 0,1 (Rot), 0,2 (Blau), 0,3 (Grün) oder 0,5 (Gelb) Gold pro Sekunde. Pro Runde kannst du höchstens 0,5 zusätzliches Einkommen erhalten; insgesamt höchstens 5 zusätzliches Einkommen. Weitere Ballonkäufe bleiben zum normalen Preis möglich. Gelbe Ballons werden in Paketen mit höchstens 5 Ballons versendet; die anderen Farben erreichen weiterhin bis zu 10 pro Paket. Die Anzeige am Ballon zeigt den noch erhältlichen Bonus. Zu Beginn von Runde 20 erhalten beide Seiten einmalig 15.000 Gold.</p>
    <p>Über den geschützten Portal-Einstieg können Ergebnisse mit dem bestehenden Portal gespeichert werden. Die eigenständige Spielseite speichert keine Online-Ergebnisse.</p>
    <a class="pixel-btn pixel-btn--primary" href="index.php">Spiel öffnen</a>
  </main>
</body>
</html>
