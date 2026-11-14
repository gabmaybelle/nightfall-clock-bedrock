# Nightfall Clock for Bedrock

A clock that tells you what tonight brings. The day and time sit just above your hotbar, and at 6 PM it tells you "The sun's getting real low", then counts down to dark in real seconds. It warns you when a storm lets monsters out by day, and in the Nether and the End it shows the Overworld's time, so night never catches you far from home.

This is the Bedrock Edition of the [Nightfall Clock](https://github.com/gabmaybelle/nightfall-clock) mod for Java, by the same maker.

## What you see

- "Day 4 · 2:35 PM" just above your hotbar. It turns gold at 6:00 PM and stays gold until night falls.
- At 6:00 PM the line reads "The sun's getting real low" for a few seconds, then counts down to dark: "Day 4 · 6:42 PM · dark in 24s". It counts to the moment it's dark enough for monsters to spawn outside.
- When thunder starts, the line reads "Storm's rolling in" for a few seconds.
- In the Nether and the End: "Overworld: Day 4 · 9:12 PM".

## Building

`npm install`, then `npm run build`: the add-on is `dist/NightfallClock-<version>.mcaddon`. `node tools/bds-check.js <server folder> --zip <bedrock-server zip>` runs the self-test on Bedrock Dedicated Server.

Made by Gabby. MIT.
