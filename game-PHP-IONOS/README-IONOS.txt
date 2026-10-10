99 LUFTBALLONS - AKTUELLER SPIELSTAND ALS PHP-FASSUNG

EIGENSTAENDIG TESTEN
Den gesamten Ordner game-PHP-IONOS auf einen PHP-Webserver kopieren.
index.php im Browser ueber den Server aufrufen, nicht per Doppelklick.
Dieser Einstieg funktioniert ohne Anmeldung und speichert keine Ergebnisse.

HINWEIS ZUM BRANCH DEV-CLEAN
Dieser Branch enthaelt nur diesen Spielordner, kein Portal-Backend.
Fuer den eigenstaendigen Betrieb index.php verwenden.
portal.php setzt das separat vorhandene Backend voraus.

IN DAS BESTEHENDE PORTAL EINBINDEN
Den Ordner neben auth.php und save-match.php des bestehenden Portals ablegen.
portal.php aufrufen: nutzt require_login() aus ../auth.php.
Der Link fuer das KI-Spiel muss dann auf game-PHP-IONOS/portal.php zeigen.
Ergebnisse gehen an ../save-match.php mit result, duration_seconds und round_reached.
Das vorhandene Portal braucht seine konfigurierte Datenbank und Abhaengigkeiten.
Diese Dateien und Einstellungen werden nicht aus der Referenz kopiert.
index.php bleibt als eigenstaendige, oeffentliche Testseite erreichbar.
Die Referenz im ORDNER_ FUER_BSP_CODE bleibt unveraendert.

SPIELSTAND
Aktuelle HTML-Oberflaeche, Bilder, Starter-Tuerme, Upgrades und KI.
Aktuelles Gold-Balancing mit Versandbonus-Grenzen und Rundengold.
Gelbe Versandpakete enthalten maximal 5 Ballons.
Spiellogik und Animation laufen weiterhin in JavaScript im Browser.
PHP liefert die Seiten und verbindet den Portal-Einstieg mit der Anmeldung.

ENTWICKLUNG UND PRUEFUNG
game.js und modules/ sind die Quellen; node build.mjs erzeugt game.bundle.js.
Auf IONOS ist kein Node und kein Build erforderlich.
Assets/CSS/Module sind mit dem HTML-Stand abgeglichen.
Die vorhandenen HTML-Tests pruefen die gemeinsame Spiellogik.
PHP-Ausfuehrung und Speichern im echten Portal sind noch separat zu pruefen.
Git-Upload auf Dev-Clean ist ausdruecklich autorisiert. Veroeffentlichung auf IONOS erfolgt separat.
