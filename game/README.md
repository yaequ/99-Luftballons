# 99 Luftballons – Game_Test

Zum Spielen die Datei **index.html** doppelt anklicken.
Der Browser öffnet sie direkt. Ein Webserver, PHP oder Node.js ist dafür nicht nötig.

Den gesamten Ordner zusammenlassen. CSS, JavaScript und Bilder werden lokal geladen.
Die Spielseiten sind HTML-Dateien. Die vorhandene Spiellogik bleibt JavaScript.

Diese Kopie enthält Turmstufen, Verschmelzen, Umplatzieren und bestätigtes Entfernen.
Beim Darüberfahren werden Türme markiert und ihre Stufe und ihr Schaden angezeigt.
Kauf-Upgrade: Einen Stufe-1-Turm bauen, denselben Turm erneut auswählen und die Vorschau auf den vorhandenen Turm bewegen. Bei „Zu Stufe 2 verschmelzen“ klicken. Es wird einmal der normale Kaufpreis abgezogen. Die Bauauswahl endet danach.
Hover allein kostet nichts. Auf einer freien Baufläche wird weiterhin normal gebaut. Ein neuer Turm ist immer Stufe 1 und kann daher keinen Stufe-2-Turm aufwerten.
Platzierte Türme gleicher Art und Stufe lassen sich weiterhin aufeinanderziehen: Maustaste halten und bei „Loslassen zum Verschmelzen“ loslassen. So lassen sich zwei Stufe-2-Türme zu Stufe 3 vereinen.
Bei pausiertem Spiel zuerst fortsetzen.
Die originale Spielversion im Nachbarordner game wird dadurch nicht geändert.

Anmeldung, Konto, Bestenliste und Online-Ergebnisspeicherung benötigen den ursprünglichen Server und sind in dieser Testkopie deaktiviert.
Die im Ausgangsordner fehlenden Logo- und Goldbilder werden durch Text beziehungsweise ein Goldsymbol ersetzt.
Über das Menü lässt sich die Anleitung öffnen oder eine neue Partie starten.

## Nur für die Weiterentwicklung

- Quelldateien: game.js, modules/, index.html und style.css.
- Nach Änderungen an JavaScript: npm run build.
- Tests: npm test.
- index.html lädt das bereits erzeugte game.bundle.js. Zum Spielen ist kein Build nötig.
