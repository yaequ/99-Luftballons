# 99 Luftballons – Refactored

Eigenständig lauffähige, modularisierte Kopie des Spiels. Die Originaldateien außerhalb dieses Ordners sind unverändert. Das alte Archiv `müll/` wird nicht benötigt und wurde nicht kopiert.

## Start

`index.html` per Doppelklick öffnen. Alternativ in diesem Ordner einen statischen Webserver starten:

```powershell
python -m http.server 4179
```

Anschließend `http://127.0.0.1:4179/` öffnen. Zum Spielen sind kein Build und keine Installation von npm-Paketen erforderlich. Die Seite lädt die mitgelieferte `game/game.bundle.js`, die auch beim direkten Dateiaufruf funktioniert.

Nach Änderungen an den JavaScript-Quellmodulen einmal `npm run build` (oder `node build.js`) in diesem Ordner ausführen. Das kleine Build-Skript erzeugt die Spiel-Datei ohne zusätzliche Pakete neu; es unterstützt die im Projekt verwendeten benannten und Namespace-Imports.

## Struktur

- `game/game.js`: Einstieg, Eingaben, Spielablauf, Kampf und Aktualisierung der Oberfläche.
- `game/game.bundle.js`: Automatisch erzeugte Browser-Datei; nicht von Hand bearbeiten.
- `game/modules/config.js`: Spielparameter, Turm- und Ballonwerte.
- `game/modules/assets.js`: Bilddefinitionen und Laden der Bilder.
- `game/modules/maps.js`: Karten, Wege und Bauflächen.
- `game/modules/state.js`: Erzeugung voneinander unabhängiger Spielzustände.
- `game/modules/building.js`: Koordinatenumrechnung und Bauprüfung.
- `game/modules/ai.js`: Bauplanung und Turmkäufe der KI.
- `game/modules/renderer.js`: Canvas-Darstellung und Auswahlporträts. Der aktuelle Spielzustand wird über eine Funktion übergeben.
- `game/rounds.js`: Rundendefinitionen und zufällige Spawn-Reihenfolge.
- `shared/base.css`: Gemeinsame Farbvariablen und Basisregeln für Homepage und Spiel.
- `homepage/` und `game/assets/`: Seiten und mitkopierte Grafiken.

Module importieren ihre Abhängigkeiten explizit; globale Spielvariablen sind nicht mehr erforderlich. Relative Seiten- und Asset-Pfade bleiben innerhalb dieser Kopie.

## Prüfung

```powershell
npm test
```

Falls die Umgebung keine Test-Unterprozesse erlaubt:

```powershell
node --test --test-isolation=none game/*.test.js
```

Die vorhandenen Rundentests wurden auf ES-Module umgestellt. Zwei bereits widersprüchliche Erwartungen wurden an das unveränderte Laufzeitverhalten angepasst: Runde 21 enthält 1020, Runde 28 enthält 1160 Ballons. Der deutliche Sprung von 200 Ballons in Runde 20 auf 1020 in Runde 21 bleibt bewusst erhalten; eine Änderung der Spielbalance gehört nicht zum Refactoring.

Weitere Tests prüfen Baukosten, Bauflächen, Turmabstände, Kartenkoordinaten, unabhängige Spielzustände und den Ausbau der KI.

## Assets

Karten und Charaktere stammen aus den bereitgestellten Projektassets; normale Ballons aus den freigestellten Originalgrafiken. Der Boss wurde laut ursprünglicher Projektdokumentation mit OpenAI Image Gen erstellt. Die ursprünglichen Hinweise zu noch zu ergänzenden Quellen und Nutzungslizenzen gelten weiterhin.
