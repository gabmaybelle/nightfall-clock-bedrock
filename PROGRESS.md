# Progress

## Done

- **Session 1 (2026-11-14):** the behaviour and resource packs; the clock line ("Day 4 · 2:35 PM"),
  gold from 6:00 PM until dark with the countdown, "The sun's getting real low" for 8 s when dusk
  arrives in play (not after `/time set` or sleeping), "Storm's rolling in" for 5 s when thunder
  starts (the newest message wins), and the Overworld's time in the Nether and the End. The line is
  drawn in its own HUD label above the hotbar (title text caught by JSON UI); labels for the four
  corners are there for the position setting. The self-test passes 7 of 7 on Bedrock Dedicated
  Server 1.26.63 with no warnings.
- Measured on Bedrock: sky light falls to 7 (monsters can spawn) between ticks 13000 and 13250, so
  the Java edition's dark tick (about 13178) holds. The day number changes at 6:00 AM, as on Java.

## Next

- Session 2: the settings form (`/nightfall_clock:settings`: clock, dusk warning, countdown, storm
  warning, Overworld time, position, 12- or 24-hour), saved per player.
- Seen on Gabby's phone (2026-11-14), all as expected: the line above the hotbar (on phones -30, just clear of the item-name line, and -46 on PC, where the hearts sit above the hotbar: Gabby, 2026-11-14), dusk, the storm,
  the Nether line, and Pocket List's corner list updating beside the clock. Bedrock's font has no
  middle dot: "·" draws as a small dash with a wide gap before it ("Day 2  - 11:57 AM").

## Known

- Thunder is known only from the weather change event (the stable API has no "is it thundering"
  reading); the last change is kept in the world, so a reload remembers it.
