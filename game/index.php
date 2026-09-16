<?php

declare(strict_types=1);

require __DIR__ . '/../auth.php';
require_login();
?>
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#dff2f8">
  <title>99 Luftballons – KI-Duell</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="style.css?v=game-ui-polish-2">
</head>
<body>
  <div id="game-app">
    <section id="screen-lobby" class="screen active" aria-labelledby="game-title">
      <div class="lobby-backdrop" aria-hidden="true"></div>
      <div class="lobby-shell pixel-frame">
        <p class="eyebrow">Tower Defense · KI-Duell</p>
        <h1 id="game-title">99 LUFTBALLONS</h1>
        <p class="lobby-copy">Spiel wird geladen …</p>
        <p id="lobby-status" class="status-message" aria-live="polite">Grafiken werden geladen.</p>
      </div>
    </section>

    <section id="screen-game" class="screen" aria-label="Laufendes KI-Duell">
      <div class="game-frame">
        <div class="game-topbar">
          <details class="home-menu pixel-frame" id="game-menu">
            <summary aria-label="Spielmenü öffnen"><span aria-hidden="true">☰</span> Menü</summary>
            <div class="home-menu__buttons">
              <a class="pixel-btn" href="../index.php">Startseite</a>
              <a class="pixel-btn" href="../menu.php">Basislager</a>
              <a class="pixel-btn" href="../leaderboard.php">Bestenliste</a>
              <a class="pixel-btn" href="../instructions.php">Anleitung</a>
              <a class="pixel-btn" href="../account.php">Account</a>
            </div>
          </details>
          <a class="game-brand" href="../index.php" aria-label="99 Luftballons – Startseite"><img src="../assets/img/branding/logo.png" alt="99 Luftballons" width="1024" height="512"></a>
          <div class="topbar-actions">
            <div class="hud__time"><span>Zeit</span><strong id="match-timer">00:00</strong></div>
            <button id="btn-toggle-controls" class="view-btn control-toggle" type="button" aria-expanded="true" aria-controls="game-controls">Interface ausblenden</button>
          </div>
        </div>

        <header id="game-hud" class="hud">
          <section class="combatant-card combatant-card--player" aria-label="Dein Spielstand">
            <p>Deine Basis</p>
            <div class="combatant-metrics">
              <span class="hud__metric hud__metric--gold"><span>Gold</span><strong id="p1-gold">100</strong></span>
              <span class="hud__metric"><span>Einkommen</span><strong id="p1-income">+10/s</strong></span>
            </div>
          </section>

          <section class="round-focus" aria-label="Rundeninformationen">
            <div class="round-focus__title"><span>Runde</span><strong id="wave-counter">0/30</strong><small id="round-state">Bereit</small></div>
            <div class="round-focus__details">
              <div class="round-summary"><span>Ballons verbleibend</span><strong id="remaining-enemies">0</strong></div>
              <div class="round-summary round-summary--wide"><span>Nächste Runde</span><strong id="next-wave-preview">100 rote Ballons</strong><small id="round-countdown">Warte auf Start</small></div>
            </div>
          </section>

          <section class="combatant-card combatant-card--enemy" aria-label="Spielstand der KI">
            <p>KI-Basis</p>
            <div class="combatant-metrics combatant-metrics--enemy">
              <span class="hud__metric hud__metric--gold"><span>Gold</span><strong id="p2-gold">100</strong></span>
            </div>
          </section>
        </header>

        <main class="maps-grid" id="maps-grid">
          <section class="map-panel map-panel--player" aria-labelledby="player-map-title">
            <header class="map-panel__header"><div><span>Deine Karte</span><strong id="player-map-title">Frostpfad</strong></div><span class="map-panel__status">Verteidigen</span></header>
            <div class="map-stage" id="player-map-stage">
              <canvas id="canvas-player" class="game-canvas" width="960" height="720" tabindex="0" aria-label="Deine Verteidigungskarte. Turm wählen, mit Pfeiltasten Bauposition bewegen und mit Enter platzieren." aria-describedby="keyboard-help"></canvas>
              <div class="sr-only" id="map-tip" aria-live="polite"><span class="map-tip__step">1</span><span>Turm wählen und auf einer dunklen Baufläche platzieren.</span></div>
            </div>
            <footer class="map-health map-health--player">
              <div class="map-health__label"><span>Deine Lebenspunkte</span><strong id="p1-hp">99 / 99</strong></div>
              <div class="health-meter" id="p1-health-meter" role="progressbar" aria-label="Deine Lebenspunkte" aria-valuemin="0" aria-valuemax="99" aria-valuenow="99"><span id="p1-health-fill" class="health-meter__fill"></span></div>
            </footer>
          </section>
          <section class="map-panel map-panel--enemy" aria-labelledby="enemy-map-title">
            <header class="map-panel__header"><div><span>KI-Karte</span><strong id="enemy-map-title">Waldweg</strong></div><span class="map-panel__readonly">Angreifen</span></header>
            <div class="map-stage"><canvas id="canvas-enemy" class="game-canvas" width="960" height="720" aria-label="Verteidigungskarte der KI"></canvas></div>
            <footer class="map-health map-health--enemy">
              <div class="map-health__label"><span>KI-Lebenspunkte</span><strong id="p2-hp">99 / 99</strong></div>
              <div class="health-meter" id="p2-health-meter" role="progressbar" aria-label="Lebenspunkte der KI" aria-valuemin="0" aria-valuemax="99" aria-valuenow="99"><span id="p2-health-fill" class="health-meter__fill"></span></div>
            </footer>
          </section>
          <p id="keyboard-help" class="sr-only">Nach der Turmauswahl bewegt man den Baucursor mit den Pfeiltasten. Enter platziert den Turm, Escape bricht ab.</p>
        </main>

        <section id="game-controls" class="action-zone" aria-label="Spielaktionen">
          <div class="round-toolbar" aria-label="Rundensteuerung">
            <label class="auto-start-control"><input id="input-auto-start" type="checkbox" checked><span>Auto-Start</span></label>
            <button id="btn-start-round" class="pixel-btn pixel-btn--round" type="button">Spiel starten</button>
            <button class="pixel-btn round-pause-button" id="btn-pause" type="button" disabled aria-pressed="false">Pausieren</button>
            <span id="pause-status" class="sr-only" role="status"></span>
          </div>

          <footer class="control-dock">
            <section class="control-panel" aria-labelledby="tower-panel-title">
            <div class="panel-heading"><div><span class="panel-kicker">Verteidigung</span><h2 id="tower-panel-title">Turm auswählen</h2></div><span class="panel-hint">Danach Baufläche anklicken oder Tastatur verwenden</span></div>
            <div class="action-grid action-grid--towers">
              <button class="action-card build-btn" data-tower="cactus" type="button" aria-pressed="false"><canvas class="action-card__portrait" data-portrait="cactus" width="92" height="72" aria-hidden="true"></canvas><span class="action-card__name">Kaktus</span><span class="action-card__meta">Schneller Schaden</span><span class="action-card__cost">25 G</span></button>
              <button class="action-card build-btn" data-tower="fan" type="button" aria-pressed="false"><canvas class="action-card__portrait" data-portrait="fan" width="92" height="72" aria-hidden="true"></canvas><span class="action-card__name">Gebläse</span><span class="action-card__meta">Kurze Abklingzeit</span><span class="action-card__cost">45 G</span></button>
              <button class="action-card build-btn" data-tower="lens" type="button" aria-pressed="false"><canvas class="action-card__portrait" data-portrait="lens" width="92" height="72" aria-hidden="true"></canvas><span class="action-card__name">Lupe</span><span class="action-card__meta">Hoher Schaden</span><span class="action-card__cost">70 G</span></button>
            </div>
            </section>
            <section class="control-panel control-panel--attacks" aria-labelledby="attack-panel-title">
            <div class="panel-heading"><div><span class="panel-kicker">Angriff</span><h2 id="attack-panel-title">Ballons senden</h2></div></div>
            <div class="action-grid action-grid--balloons">
              <button class="balloon-card send-btn balloon-card--red" data-balloon="red" type="button"><canvas class="balloon-card__portrait" data-balloon-portrait="red" width="64" height="64" aria-hidden="true"></canvas><span><strong>Rot</strong><small>10 G · +1/s</small></span></button>
              <button class="balloon-card send-btn balloon-card--blue" data-balloon="blue" type="button"><canvas class="balloon-card__portrait" data-balloon-portrait="blue" width="64" height="64" aria-hidden="true"></canvas><span><strong>Blau</strong><small>25 G · +2/s</small></span></button>
              <button class="balloon-card send-btn balloon-card--green" data-balloon="green" type="button"><canvas class="balloon-card__portrait" data-balloon-portrait="green" width="64" height="64" aria-hidden="true"></canvas><span><strong>Grün</strong><small>45 G · +4/s</small></span></button>
              <button class="balloon-card send-btn balloon-card--yellow" data-balloon="yellow" type="button"><canvas class="balloon-card__portrait" data-balloon-portrait="yellow" width="64" height="64" aria-hidden="true"></canvas><span><strong>Gelb</strong><small>70 G · +7/s</small></span></button>
            </div>
            </section>
          </footer>
        </section>
      </div>
    </section>

    <div id="modal-gameover" class="modal" role="dialog" aria-modal="true" aria-labelledby="gameover-title"><div class="modal-content pixel-frame"><p class="eyebrow">Match beendet</p><h2 id="gameover-title">Sieg!</h2><p id="gameover-message"></p><button id="btn-return-lobby" class="pixel-btn pixel-btn--primary" type="button">Zum Basislager</button></div></div>
    <div id="modal-load-error" class="modal" role="dialog" aria-modal="true" aria-labelledby="load-error-title"><div class="modal-content pixel-frame"><p class="eyebrow">Ladefehler</p><h2 id="load-error-title">Asset fehlt</h2><p id="load-error-message"></p><div class="modal-actions"><button id="btn-retry-load" class="pixel-btn pixel-btn--primary" type="button">Erneut versuchen</button><button id="btn-cancel-load" class="pixel-btn" type="button">Zum Basislager</button></div></div></div>
  </div>
  <div id="game-toast" class="game-toast" role="status" aria-live="polite" hidden></div>
  <script src="game.bundle.js?v=game-ui-complete-1"></script>
</body>
</html>
