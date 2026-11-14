// Nightfall Clock for Bedrock: the day and time on each player's screen ("Day 4 · 2:35 PM"), gold
// from 6:00 PM until dark with a countdown, "The sun's getting real low" when dusk arrives and
// "Storm's rolling in" when thunder starts, and the Overworld's time in the Nether and the End.
// The rules are in clock.ts, the drawing in hud.ts. Nothing runs every tick: one pass every 10.
import { system, world, WeatherType } from "@minecraft/server";
import { AQUA, DUSK, DuskWatch, GOLD, STORM, WHITE, gold, line, minuteOfDay, secondsToDark } from "./clock.js";
import { Place, draw } from "./hud.js";

export const VERSION = "0.1.0";
const PASS_TICKS = 10;
const DUSK_TICKS = 8 * 20, STORM_TICKS = 5 * 20;
const THUNDER_KEY = "nightfall_clock:thunder";

const dusk = new DuskWatch();
// The dusk or storm message showing now (the newest wins), and until which tick.
let message = "", messageUntil = -1, duskCount = 0, stormCount = 0;

// Bedrock's stable API has no "is it thundering" reading, only the change event: remember the last
// one in the world, so a reload still knows.
const thundering = () => world.getDynamicProperty(THUNDER_KEY) === true;
world.afterEvents.weatherChange.subscribe((ev) => {
  if (!/overworld/.test(ev.dimension)) return;
  const now = ev.newWeather === WeatherType.Thunder;
  if (now && ev.previousWeather !== WeatherType.Thunder) {
    message = AQUA + STORM;
    messageUntil = system.currentTick + STORM_TICKS;
    stormCount++;
  }
  world.setDynamicProperty(THUNDER_KEY, now);
});

/** What the clock shows a player in this dimension just now, colour code first. */
export function reading(dimensionId: string) {
  const elsewhere = dimensionId !== "minecraft:overworld";
  const t = world.getTimeOfDay(), minute = minuteOfDay(t), day = world.getDay() + 1;
  const seconds = elsewhere ? -1 : secondsToDark(t, thundering());
  const text = line(day, minute, true, seconds, elsewhere);
  const isGold = !elsewhere && gold(minute, seconds);
  let shown = (isGold ? GOLD : WHITE) + text;
  if (!elsewhere && system.currentTick < messageUntil) shown = message;
  return { timeOfDay: t, day, minute, seconds, text, gold: isGold, shown, thunder: thundering() };
}

function pass() {
  if (dusk.update(minuteOfDay(world.getTimeOfDay()))) {
    message = GOLD + DUSK;
    messageUntil = system.currentTick + DUSK_TICKS;
    duskCount++;
  }
  for (const player of world.getAllPlayers()) {
    try {
      draw(player, "hb" as Place, reading(player.dimension.id).shown);
    } catch (e) {
      console.warn(`[Nightfall Clock] couldn't draw for ${player.name}: ${e}`);
    }
  }
}
system.runInterval(pass, PASS_TICKS);

// The self-test's hook: what the clock reads now, here and in the Nether, and how often dusk and
// storms have arrived. One pack can't call another, so it asks by script event.
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== "nightfall_clock:debug") return;
  pass();
  const reply = { over: reading("minecraft:overworld"), nether: reading("minecraft:nether"), duskCount, stormCount };
  system.sendScriptEvent("nightfall_clock:debug_reply", JSON.stringify(reply));
});

console.log(`[Nightfall Clock] ${VERSION}: script loaded`);
