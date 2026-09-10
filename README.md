# 99 Luftballons

Ein lokales Pixel-Tower-Defense-Spiel für eine Person gegen eine KI. Beide Karten werden gleichzeitig simuliert und auf Desktop nebeneinander angezeigt.

## Start

Das Projekt benötigt keinen Build-Schritt. Im Projektordner einen lokalen Webserver starten und anschließend die Startseite öffnen:

```powershell
python -m http.server 4179
```

Adresse: `http://127.0.0.1:4179/`

## Spielziel

- Überlebe alle 30 Angriffsrunden der KI oder reduziere ihre 99 Leben vorher auf null.
- Runde 1 beginnt manuell. Mit aktiviertem Auto-Start beginnt die nächste Runde nach fünf Sekunden.
- Runde 29 enthält einen Boss, Runde 30 zwei Bosse.
- Runden 1-20: Rundennummer x 10 Ballons (10 bis 200). Runde 21: 1020 Ballons; danach pro Runde 20 mehr, bis 1160 in Runde 28. Die Spawn-Reihenfolge wird gemischt.
- Der Boss verursacht 25 Lebensschaden; normale Ballons verursachen einen Lebensschaden.

## Steuerung

- Oben links öffnet „Menü“ das Dropdown der Homepage; „back to menu“ beendet die aktuelle Partie und kehrt zur Homepage zurück.
- „Pausieren“ hält Zeit, Einkommen, Ballons, Türme, KI und Rundenwechsel an. „Fortsetzen“ setzt dieselbe Partie ohne Nachholen der Pausenzeit fort. Bauen und Ballonsenden sind während der Pause gesperrt.
- Turmkarte anklicken und danach eine dunkle Baufläche auf der Spielerkarte auswählen.
- Tastatur: Turm wählen, Baucursor mit den Pfeiltasten bewegen, mit `Enter` platzieren und mit `Escape` abbrechen.
- `I` blendet das Steuerinterface ein oder aus.
- Über die Ballonkarten werden Angriffe gegen die KI gekauft. Käufe erhöhen das regelmäßige Einkommen.

Die bestehenden Charaktere **Kaktus**, **Gebläse** und **Lupe** sind die drei Türme. Die KI kauft dieselben Türme mit ihrer eigenen Wirtschaft. Sie besetzt ihre acht Baufelder schrittweise und hat spätestens mit dem Start von Runde 20 alle Felder belegt. Kleine Felder tragen jeweils 3–6, große Felder 5–8 Türme.

## Technik und Browser

- Vanilla HTML, CSS und JavaScript; kein Backend und keine Mehrspielerfunktion.
- Empfohlen: aktuelle Versionen von Chrome, Edge oder Firefox.
- Desktop zeigt beide Karten nebeneinander; unter 900 px Breite stehen sie untereinander.
- `game/rounds.js` enthält die testbare Rundendefinition. Test: `node game/rounds.test.js`.

## Assets und Lizenzen

- Karten und Charaktergrafiken stammen aus den im Studienprojekt bereitgestellten Projektassets.
- Die normalen Ballons verwenden freigestellte Einzelbilder unter `game/assets/Balloons/transparent/` in den Farbordnern `red`, `blue`, `green` und `yellow`. Die Ausgangsgrafiken liegen neben der Kopie in `../nicht_gebraucht/Balloons/`.
- Hintergrund und Rasterlinien sind bereits im Alphakanal der Spielassets entfernt. Das Spiel liest keine Canvas-Pixel aus und benötigt hierfür keine CORS-Freigabe des Bildservers. Die Originaldateien bleiben erhalten. Spiel und Auswahlkarten verwenden dieselben Designs; die Platzanimation nutzt pro Farbe alle nummerierten Phasen (7 für Rot/Blau/Grün, 6 für Gelb) bei gleichbleibendem Maßstab.
- Beim Aktualisieren des Hostings den gesamten Inhalt dieses Ordners gemeinsam hochladen, einschliesslich aller Scripts und Assets.
- `game/assets/Balloons/boss-balloon.png` wurde für dieses Projekt mit OpenAI Image Gen erzeugt.
- Vor einer Veröffentlichung müssen Urheber, konkrete Quellen und Nutzungslizenzen der bereitgestellten Ausgangsassets ergänzt und geprüft werden.

## Ordnerstruktur

```text
index.html             Einstieg: leitet zur Homepage weiter
homepage/
  index.html           Homepage mit Link zum Spiel
  style.css            Gestaltung der Homepage
game/
  index.html           Spielseite mit Ladeanzeige
  style.css            Gestaltung des Spiels
  config.js            Bildpfade, Spielwerte und Karten
  rendering.js         Canvas-Darstellung und Grafikvorschauen
  game.js              Spielzustand, Eingaben, Pause, KI und Kampf
  rounds.js            Rundendefinitionen
  rounds.test.js       Bestehende Rundentests
  assets/
    Maps/
    Charaktere/
    Balloons/
```

Homepage und Spiel sind eigenständige HTML-Seiten. Die Homepage lädt keine
Spiellogik. Der Spielen-Link öffnet `game/`; nach Spielende oder einem
abgebrochenen Ladevorgang führt der Zurück-Button zu `homepage/`.
Die Homepage nutzt eine Karte aus den Spielassets als Hintergrund.

Für statisches Hosting den Inhalt dieses Projektordners mit unveränderter
Unterordnerstruktur in das Zielverzeichnis der Domain hochladen. Login,
Datenbank und Highscores sind noch nicht angebunden.

Auf der Homepage öffnet „Zum Spiel“ zunächst die Spielansicht. Zeit, Einkommen
und Angriffe beginnen erst beim Klick auf „Spiel starten“, der Runde 1 startet.

## Bereinigte Kopie

Aktuelle 30-Runden-Version mit Pause/Fortsetzen, Spielmenue und transparenten Ballons. Den Webserver in diesem Ordner starten. Originaldateien und Git-Index bleiben unveraendert. Alte Version, Ausgangsgrafiken, ZIP-Archiv und historisches Design-Protokoll sind unter `../nicht_gebraucht/` dokumentiert.

Lesereihenfolge: Homepage-HTML/CSS, Spiel-HTML, `game/config.js`, `game/rounds.js`, `game/game.js`, `game/rendering.js`. Die klassischen Scripts teilen globale Definitionen; ihre Reihenfolge im HTML ist wichtig.

Spielbalance und Rundenzahlen bleiben unveraendert. Tests und Beschreibung wurden an die bestehende Berechnung angepasst. Der Sprung von 200 auf 1020 Ballons bleibt erhalten. Login und Highscore sind Platzhalter.
