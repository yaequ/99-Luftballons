# Design QA – 99 Luftballons

- UI reference: `C:\Users\kacpe\AppData\Local\Temp\codex-clipboard-e869a568-5f02-4d9d-9452-804bf2570a5f.png`
- Balloon source sheet: `C:\Users\kacpe\AppData\Local\Temp\codex-clipboard-3121f642-6398-4792-81e8-934b2e56f854.png`
- Integrated asset: `Balloons/balloons-spritesheet.png`
- Expanded implementation: `qa-balloon-interface.png`
- Collapsed implementation: `qa-interface-collapsed.png`
- Source/implementation comparison: `qa-balloon-comparison.png`
- Tested states: active match, player and opponent maps, expanded and collapsed controls, desktop and 390 × 844 mobile viewport

## Visual comparison

The supplied balloon sheet is used as the visual source for all four attack types. Red, blue, green, and yellow keep the source silhouette, highlight, pixel edges, and string. The dark sheet background is removed at runtime so the balloons sit cleanly on cards and map artwork. Rendering uses disabled smoothing to preserve pixel sharpness.

The interface still follows the earlier tower-defense reference: compact black HUD, full-width map, framed build pads, instructional callout, and dark lower selection dock. The new toggle collapses that dock completely while keeping map switching, income, HUD, and the restore button available.

## Iteration findings and fixes

- P2: On mobile, long HUD values could clip at the right edge. Fixed with shrinkable level text, tighter economy spacing, equal metric widths, and explicit alignment.
- P2: The permanent lower dock obscured a large portion of the map. Fixed with an animated desktop collapse and a fully removed mobile dock state.
- P2: Previous balloon controls did not match the provided art. Replaced with four portraits from the supplied sprite sheet and matching in-map sprites.
- P3: Disabled attack cards dim the sprite together with the card. This is intentional feedback and remains legible.

## Functional verification

- Quick match loads the playable map: passed.
- Red, blue, green, and yellow sprite portraits render in the attack panel: passed.
- Yellow balloon send appears on the opponent route and changes income from +10/s to +17/s: passed.
- Interface button toggles `aria-expanded`, its label, and the collapsed dock state: passed.
- Collapsed desktop dock has hidden visibility, zero opacity, and no pointer events: passed.
- Mobile 390 × 844 expands/collapses the interface without horizontal page overflow: passed.
- Mobile HUD remains fully readable after the narrow-width correction: passed.
- The page reloads and starts successfully after the final CSS/JS changes: passed.

## Remaining P3 polish

- A bundled, license-cleared pixel font could match the reference lettering more exactly.
- A later art pass could provide a transparent native sprite sheet and remove the need for runtime background cleanup.

final result: passed
