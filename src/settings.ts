// Each player's settings, kept on the player as a dynamic property (JSON), so they're the player's own
// and travel with them in that world, as the Java edition's settings are the player's. The form is
// /nightfall_clock:settings (any player, no cheats needed).
import { CommandPermissionLevel, CustomCommandOrigin, CustomCommandStatus, Player, system, world } from "@minecraft/server";
import { FormCancelationReason, FormRejectError, FormRejectReason, ModalFormData } from "@minecraft/server-ui";
import { PLACE_KEYS, PLACE_NAMES, Settings, cleanSettings } from "./clock.js";

const PROP = "nightfall_clock:settings";
const cache = new Map<string, Settings>();

export function settingsOf(player: Player): Settings {
  let s = cache.get(player.id);
  if (!s) {
    let raw: unknown;
    try {
      const text = player.getDynamicProperty(PROP);
      raw = typeof text === "string" ? JSON.parse(text) : undefined;
    } catch (e) {
      console.warn(`[Nightfall Clock] ${player.name}'s settings couldn't be read, starting afresh: ${e}`);
    }
    s = cleanSettings(raw);
    cache.set(player.id, s);
  }
  return s;
}

function save(player: Player, s: Settings) {
  try {
    player.setDynamicProperty(PROP, JSON.stringify(s));
  } catch (e) {
    console.warn(`[Nightfall Clock] couldn't save ${player.name}'s settings: ${e}`);
  }
}

world.afterEvents.playerLeave.subscribe(({ playerId }) => cache.delete(playerId));

/** Shows the form, waiting while the player is still in another screen (the chat, after a command), up to about ten seconds. */
async function show(form: ModalFormData, player: Player) {
  for (let tries = 0; tries < 40; tries++) {
    let r;
    try {
      r = await form.show(player);
    } catch (e) {
      if (e instanceof FormRejectError && e.reason === FormRejectReason.PlayerQuit) return undefined;
      throw e;
    }
    if (r.cancelationReason !== FormCancelationReason.UserBusy) return r.canceled ? undefined : r;
    await new Promise<void>((done) => system.runTimeout(() => done(), 5));
  }
  return undefined;
}

export async function openSettings(player: Player): Promise<void> {
  const s = settingsOf(player);
  const form = new ModalFormData()
    .title("Nightfall Clock")
    .toggle("Clock", { defaultValue: s.clock, tooltip: "Show the day and time on your screen." })
    .toggle("Dusk warning", { defaultValue: s.dusk, tooltip: "\"The sun's getting real low\" when the sun sets." })
    .toggle("Countdown to dark", { defaultValue: s.countdown, tooltip: "Count down to when monsters can spawn, from 6:00 PM." })
    .toggle("Storm warning", { defaultValue: s.storm, tooltip: "\"Storm's rolling in\" when thunder starts." })
    .toggle("Overworld time in the Nether and End", { defaultValue: s.elsewhere, tooltip: "Keep showing the Overworld's time while you're in another dimension." })
    .dropdown("Position", PLACE_NAMES, { defaultValueIndex: Math.max(0, PLACE_KEYS.indexOf(s.place)), tooltip: "Above the hotbar, or a corner of the screen. On a phone the bottom corners are under your thumbs." })
    .dropdown("Time", ["12-hour", "24-hour"], { defaultValueIndex: s.twelveHour ? 0 : 1 })
    .submitButton("Save");
  const r = await show(form, player);
  if (!r?.formValues) return;
  const [clock, dusk, countdown, storm, elsewhere, place, hours] = r.formValues;
  if (typeof clock === "boolean") s.clock = clock;
  if (typeof dusk === "boolean") s.dusk = dusk;
  if (typeof countdown === "boolean") s.countdown = countdown;
  if (typeof storm === "boolean") s.storm = storm;
  if (typeof elsewhere === "boolean") s.elsewhere = elsewhere;
  if (typeof place === "number" && PLACE_KEYS[place]) s.place = PLACE_KEYS[place];
  if (typeof hours === "number") s.twelveHour = hours === 0;
  save(player, s);
}

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
  customCommandRegistry.registerCommand(
    { name: "nightfall_clock:settings", description: "Opens the Nightfall Clock settings.", permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false },
    (origin: CustomCommandOrigin) => {
      const who = origin.sourceEntity ?? origin.initiator;
      if (!(who instanceof Player)) return { status: CustomCommandStatus.Failure, message: "Nightfall Clock: open this as a player in the game." };
      system.run(() => openSettings(who));
      return { status: CustomCommandStatus.Success };
    },
  );
});
