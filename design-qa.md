# Design QA – 30-Runden-KI-Duell

## Referenzen

- Designkonzept: `C:\Users\k.drozd\.codex\generated_images\01a06b8a-54f0-7463-83d9-fd0a46c88d94\exec-ced221e8-d8b2-4f41-9e11-3c4c75ffca49.png`
- Desktopprüfung: `C:\Users\k.drozd\.codex\visualizations\2026\09\04\01a06b8a-54f0-7463-83d9-fd0a46c88d94\99-luftballons-desktop.png`
- Mobilprüfung: `C:\Users\k.drozd\.codex\visualizations\2026\09\04\01a06b8a-54f0-7463-83d9-fd0a46c88d94\99-luftballons-mobile.png`
- Bossprüfung: `C:\Users\k.drozd\.codex\visualizations\2026\09\04\01a06b8a-54f0-7463-83d9-fd0a46c88d94\99-luftballons-boss.png`
- KI-Turmfelder: `C:\Users\k.drozd\.codex\visualizations\2026\09\04\01a06b8a-54f0-7463-83d9-fd0a46c88d94\99-luftballons-ai-fields.png`

## Ergebnis

- Desktop 1440 × 900: beide Karten nebeneinander, je 680 × 510 Pixel.
- Mobil 390 × 844: beide Karten untereinander, je 374 × 280,5 Pixel.
- Kein horizontaler Überlauf und keine relevanten Konsolenfehler.
- Lobby enthält keine Raum- oder Mehrspielersteuerung.
- Kaktus, Gebläse und Lupe bleiben als vorhandene Charakter-Türme erhalten.
- Tastaturauswahl und Platzierung mit Enter funktionieren.
- Runde 1 startet mit 100 roten Ballons; Runde 30 enthält zwei Bosse.
- Sieg nach Abschluss von Runde 30 und Ladefehlerdialog für fehlende Pflichtassets funktionieren.
- KI kauft in Runde 1 drei Kaktustürme für 75 Gold und erreicht in Runde 5/10/15/19/20 insgesamt 7/18/27/34/42 Türme auf 2/4/6/7/8 vollständig belegten Feldern.
- Kleine Felder enthalten 3–6, große Felder 5–8 Türme; alle 42 Positionen sind gültig und eindeutig.

## Konzeptvergleich

- Beibehalten: dunkle Pixeloberfläche, Mint-/Cyan-/Gold-Akzente und harte Rahmen.
- Beibehalten: kompaktes HUD, zwei gleichwertige Karten und Steuerdock unter den Karten.
- Bewusste Abweichung: vorhandene Karten- und Charakterassets ersetzen die illustrativen Konzeptplatzhalter.
- Bewusste Abweichung: bestehende Turmnamen und Preise bleiben unverändert.
