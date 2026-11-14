// The clock's rules, from the world's time of day. No game objects, so the self-test checks them
// directly. The same rules and words as the Java edition (its Paper plugin reads the day's ticks the
// same way): tick 0 is 6:00 AM and the sun stands at noon at tick 6000, so 6:00 PM is tick 12000.

export const DAY_TICKS = 24000;
const MINUTES_PER_DAY = 24 * 60;
/** Tick 0 is 6:00 AM: the sun's noon (tick 6000) is 12:00. */
const TICKS_BEFORE_MIDNIGHT = 6000;
export const SUNSET_MINUTE = 18 * 60;
const NIGHT_MINUTE = 19 * 60;
/**
 * The tick at which it's dark enough outside for monsters to spawn: the Java edition's sky light
 * falls from full at tick 11867 to 4 of 15 at 13670 in a straight line, and monsters spawn at 7 or
 * below, so about 13178. The self-test logs Bedrock's own sky light around it to check.
 */
export const DARK_TICK = 11867 + ((1 - 7 / 15) / (1 - 0.26666668)) * (13670 - 11867);
const TICKS_PER_SECOND = 20;

export const DUSK = "The sun's getting real low";
export const STORM = "Storm's rolling in";
export const GOLD = "§6", AQUA = "§b", WHITE = "§f";

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Minutes after midnight at this time of day (any tick: it wraps). */
export const minuteOfDay = (timeOfDay: number) =>
  Math.floor((mod(timeOfDay + TICKS_BEFORE_MIDNIGHT, DAY_TICKS) * MINUTES_PER_DAY) / DAY_TICKS);

/**
 * Whole real seconds until it's dark enough outside for monsters to spawn, from 6:00 PM until then;
 * -1 at any other time, or in a thunderstorm, when they can spawn already.
 */
export function secondsToDark(timeOfDay: number, thundering: boolean): number {
  if (thundering || minuteOfDay(timeOfDay) < SUNSET_MINUTE) return -1;
  const left = DARK_TICK - mod(timeOfDay, DAY_TICKS);
  return left <= 0 ? -1 : Math.ceil(left / TICKS_PER_SECOND);
}

/** Gold from 6:00 PM until dark: 7:00 PM, or later while the clock is still counting down. */
export const gold = (minute: number, seconds: number) => minute >= SUNSET_MINUTE && (minute < NIGHT_MINUTE || seconds >= 0);

const two = (n: number) => String(n).padStart(2, "0");

/** "Day 4 · 2:35 PM", or "Day 4 · 14:35" with 24-hour time. */
export function time(day: number, minute: number, twelveHour: boolean): string {
  const hour24 = Math.floor(minute / 60), minutes = two(minute % 60);
  if (!twelveHour) return `Day ${day} · ${two(hour24)}:${minutes}`;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `Day ${day} · ${hour12}:${minutes} ${hour24 < 12 ? "AM" : "PM"}`;
}

/** "dark in 24s", or "dark in 1:05" from a minute up. */
export const darkIn = (seconds: number) =>
  seconds < 60 ? `dark in ${seconds}s` : `dark in ${Math.floor(seconds / 60)}:${two(seconds % 60)}`;

/** The whole line: "Day 4 · 6:42 PM · dark in 24s", or "Overworld: Day 4 · 9:12 PM" in the Nether or the End. */
export function line(day: number, minute: number, twelveHour: boolean, seconds: number, elsewhere: boolean): string {
  let text = time(day, minute, twelveHour);
  if (seconds >= 0) text += " · " + darkIn(seconds);
  return elsewhere ? "Overworld: " + text : text;
}

/** One player's choices (the Java edition's settings screen), saved on the player. */
export interface Settings {
  clock: boolean;
  dusk: boolean;
  countdown: boolean;
  storm: boolean;
  elsewhere: boolean;
  /** One of the places in hud.ts: "hb" above the hotbar, or a corner. */
  place: string;
  twelveHour: boolean;
}
export const PLACE_KEYS = ["hb", "tl", "tr", "bl", "br"];
export const PLACE_NAMES = ["Above the hotbar", "Top left", "Top right", "Bottom left", "Bottom right"];
export const defaults = (): Settings => ({ clock: true, dusk: true, countdown: true, storm: true, elsewhere: true, place: "hb", twelveHour: true });

/** Settings from whatever was saved: a missing or wrong-typed value takes its default. */
export function cleanSettings(raw: unknown): Settings {
  const s = defaults();
  if (typeof raw !== "object" || raw === null) return s;
  const r = raw as Record<string, unknown>;
  for (const k of ["clock", "dusk", "countdown", "storm", "elsewhere", "twelveHour"] as const) if (typeof r[k] === "boolean") s[k] = r[k];
  if (typeof r.place === "string" && PLACE_KEYS.includes(r.place)) s.place = r.place;
  return s;
}

/**
 * Decides the moment dusk arrives: the clock passing 6:00 PM as the day runs. A jump of more than
 * ten game minutes (a /time set, or everyone sleeping) isn't dusk arriving, and neither is the first
 * look at a world that's already past 6:00 PM. Fed every second or so (20 ticks is 1.2 game minutes).
 */
export class DuskWatch {
  static readonly MAX_STEP_MINUTES = 10;
  private last = -1;
  update(minute: number): boolean {
    const arrived = this.last >= 0 && this.last < SUNSET_MINUTE && minute >= SUNSET_MINUTE && minute - this.last <= DuskWatch.MAX_STEP_MINUTES;
    this.last = minute;
    return arrived;
  }
}
