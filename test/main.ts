// Nightfall Clock self-test: a test-only pack for a throwaway test world, never shipped. Stable
// script APIs only, so it runs on a plain dedicated server with no experiments and no player.
//
//   /scriptevent nightfall_clock:test    every case, then "NC TEST: DONE"
//
// Each case prints "NC TEST: CASE <name>: PASS" or "... FAIL <why>"; tools/bds-check.js reads them.
// The rules are checked directly (clock.ts is copied into this pack); the pack's live reading is
// asked through its nightfall_clock:debug hook, since one pack can't call another.
import { world, system } from "@minecraft/server";
import { DARK_TICK, DUSK, cleanSettings, DuskWatch, STORM, darkIn, gold, line, minuteOfDay, secondsToDark, time } from "../src/clock.js";

const log = (s: string) => console.warn("NC TEST: " + s);
const wait = (ticks: number) => new Promise<void>((resolve) => system.runTimeout(() => resolve(), ticks));
class Fail extends Error {}
function must(cond: unknown, why: string): asserts cond {
  if (!cond) throw new Fail(why);
}
const eq = (a: unknown, b: unknown, what: string) => must(a === b, `${what}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
const run = (cmd: string) => world.getDimension("minecraft:overworld").runCommand(cmd);

type Json = Record<string, any>;
let pending: ((r: Json) => void) | undefined;
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== "nightfall_clock:debug_reply") return;
  const f = pending;
  pending = undefined;
  f?.(JSON.parse(ev.message));
});
function ask(settings: Json = {}): Promise<Json> {
  return new Promise((resolve, reject) => {
    pending = resolve;
    system.sendScriptEvent("nightfall_clock:debug", JSON.stringify(settings));
    system.runTimeout(() => {
      if (pending === resolve) {
        pending = undefined;
        reject(new Fail("no reply from the pack"));
      }
    }, 40);
  });
}
async function at(tick: number): Promise<Json> {
  run(`time set ${tick}`);
  await wait(2);
  return ask();
}

const CASES: [string, () => Promise<void>][] = [
  ["rules", async () => {
    eq(minuteOfDay(0), 6 * 60, "tick 0");
    eq(minuteOfDay(6000), 12 * 60, "tick 6000");
    eq(minuteOfDay(18000), 0, "tick 18000");
    eq(time(4, 14 * 60 + 35, true), "Day 4 · 2:35 PM", "12-hour");
    eq(time(4, 14 * 60 + 35, false), "Day 4 · 14:35", "24-hour");
    eq(time(1, 30, true), "Day 1 · 12:30 AM", "after midnight");
    eq(darkIn(24), "dark in 24s", "seconds");
    eq(darkIn(65), "dark in 1:05", "minutes");
    eq(secondsToDark(11000, false), -1, "before 6 PM");
    eq(secondsToDark(12000, false), Math.ceil((DARK_TICK - 12000) / 20), "at 6 PM");
    eq(secondsToDark(12500, true), -1, "thunder");
    eq(secondsToDark(14000, false), -1, "after dark");
    must(gold(18 * 60, 30) && gold(18 * 60 + 70, 5) && !gold(17 * 60 + 59, -1) && !gold(19 * 60 + 30, -1), "gold window");
    eq(line(4, 21 * 60 + 12, true, -1, true), "Overworld: Day 4 · 9:12 PM", "elsewhere");
    const w = new DuskWatch();
    must(!w.update(18 * 60 + 5), "first look past 6 PM isn't dusk");
    const v = new DuskWatch();
    v.update(17 * 60 + 59);
    must(v.update(18 * 60 + 1), "dusk arriving");
    const j = new DuskWatch();
    j.update(16 * 60);
    must(!j.update(19 * 60), "a jump isn't dusk");
  }],
  ["settings", async () => {
    const d = cleanSettings(undefined);
    must(d.clock && d.dusk && d.countdown && d.storm && d.elsewhere && d.twelveHour && d.place === "hb", "defaults");
    const bad = cleanSettings({ clock: "no", place: "middle", twelveHour: false, storm: false });
    must(bad.clock && bad.place === "hb" && !bad.twelveHour && !bad.storm, "wrong values take defaults, right ones stay");
    eq(cleanSettings({ place: "br" }).place, "br", "a corner");
    // The live line for other settings, at 6:30 PM.
    await at(12500);
    const r = await ask({ countdown: false, twelveHour: false });
    must(/^Day \d+ · 18:30$/.test(r.custom.over.text), "24-hour, no countdown: " + r.custom.over.text);
    must(r.custom.over.gold, "still gold without the countdown");
    eq((await ask({ clock: false })).custom.over.shown, "", "clock off draws nothing");
    eq((await ask({ elsewhere: false })).custom.nether.shown, "", "Nether off draws nothing");
    must((await ask({ elsewhere: false })).custom.over.shown !== "", "Overworld still drawn");
  }],
  ["noon", async () => {
    const r = (await at(6000)).over;
    must(/^Day \d+ · 12:00 PM$/.test(r.text), "noon line: " + r.text);
    must(r.shown.startsWith("§f") && !r.gold, "white at noon: " + r.shown);
  }],
  ["evening gold and countdown", async () => {
    const r = (await at(12500)).over;
    must(r.gold, "gold at 6:30 PM");
    eq(r.seconds, Math.ceil((DARK_TICK - 12500) / 20), "seconds to dark");
    must(r.text.endsWith(" · dark in " + r.seconds + "s"), "countdown in the line: " + r.text);
  }],
  ["dusk arrives", async () => {
    const before = (await at(11950)).duskCount;
    await wait(110);
    const r = await ask();
    eq(r.duskCount, before + 1, "dusk count");
    eq(r.over.shown, "§6" + DUSK, "dusk message");
  }],
  ["time set isn't dusk", async () => {
    await at(10000);
    await wait(20);
    const before = (await ask()).duskCount;
    await at(13000);
    await wait(20);
    eq((await ask()).duskCount, before, "dusk count after a jump");
  }],
  ["storm", async () => {
    run("weather clear");
    await wait(10);
    const before = (await at(12400)).stormCount;
    run("weather thunder");
    await wait(10);
    const r = await ask();
    eq(r.stormCount, before + 1, "storm count");
    eq(r.over.shown, "§b" + STORM, "storm message");
    eq(r.over.seconds, -1, "no countdown in thunder");
    run("weather clear");
    await wait(10);
  }],
  ["nether", async () => {
    const r = (await at(12500)).nether;
    must(r.text.startsWith("Overworld: Day "), "nether line: " + r.text);
    eq(r.seconds, -1, "no countdown elsewhere");
  }],
];

async function skyLight() {
  // Not a pass or fail: Bedrock's sky light around dusk, to check the dark tick against.
  const dim = world.getDimension("minecraft:overworld");
  const spot = { x: 0, y: -59, z: 0 };
  const seen: string[] = [];
  for (let t = 11500; t <= 14500; t += 250) {
    run(`time set ${t}`);
    await wait(3);
    try {
      seen.push(`${t}:${dim.getSkyLightLevel(spot)}/${dim.getLightLevel(spot)}`);
    } catch (e) {
      seen.push(`${t}:err ${e}`);
    }
  }
  log("INFO sky light (tick:sky/total) " + seen.join(" "));
  run("time set 30000");
  await wait(3);
  log("INFO after time set 30000: " + JSON.stringify((await ask()).over.text));
}

system.afterEvents.scriptEventReceive.subscribe(async (ev) => {
  if (ev.id !== "nightfall_clock:test") return;
  run("tickingarea add circle 0 0 0 2 nctest");
  run("gamerule dodaylightcycle true");
  await wait(20);
  let failed = 0;
  for (const [name, fn] of CASES) {
    try {
      await fn();
      log(`CASE ${name}: PASS`);
    } catch (e) {
      failed++;
      log(`CASE ${name}: FAIL ${e instanceof Fail ? e.message : e}`);
    }
  }
  await skyLight();
  log(failed ? `${failed} of ${CASES.length} FAILED` : `PASS all ${CASES.length}`);
  log("DONE");
});
