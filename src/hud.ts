// The clock's own line on the screen. The resource pack's hud_screen.json has one label per place
// (above the hotbar and the four corners); each keeps the last title text that began with its key
// ("[nc:hb]" for above the hotbar), even after the title itself has gone, and the big centre title is
// hidden whenever it begins with "[nc:". So the line goes out as a title with no fade-in, stay or
// fade-out, only when its text changes. The same way Pocket List for Bedrock draws its corner list.
//
// Setting a title with those times also sets the player's title times, which would make a later
// ordinary /title show for no time at all; two ticks after each send, "title @s reset" puts the
// times back (the label has kept its text by then; the UI sees only the last title of a tick).
import { Player, system, world } from "@minecraft/server";

export type Place = "hb" | "tl" | "tr" | "bl" | "br";
export const PLACES: Place[] = ["hb", "tl", "tr", "bl", "br"];
const TIMES = { fadeInDuration: 0, stayDuration: 0, fadeOutDuration: 0 };

interface Shown {
  place: Place;
  text: string;
  resetPending: boolean;
  /** True while the old place is being blanked; nothing else is sent then. */
  moving: boolean;
}
const shown = new Map<string, Shown>();

/** What was last drawn for a player (the self-test reads it). */
export const lastShown = (player: Player) => shown.get(player.id);

function send(player: Player, s: Shown, place: Place, body: string) {
  player.onScreenDisplay.setTitle(`[nc:${place}]` + body, TIMES);
  if (s.resetPending) return;
  s.resetPending = true;
  system.runTimeout(() => {
    s.resetPending = false;
    try {
      if (player.isValid) player.runCommand("title @s reset");
    } catch (e) {
      console.warn(`[Nightfall Clock] title reset: ${e}`);
    }
  }, 2);
}

/** Draws the line (empty blanks it). A place change blanks the old place first. */
export function draw(player: Player, place: Place, text: string) {
  let s = shown.get(player.id);
  if (!s) {
    s = { place, text: "", resetPending: false, moving: false };
    shown.set(player.id, s);
  }
  if (s.moving) return;
  if (s.place !== place) {
    const old = s.place, st = s;
    st.place = place;
    st.moving = true;
    send(player, st, old, "");
    st.text = "";
    // The game shows only the last title set in a tick: draw the new place a few ticks later.
    system.runTimeout(() => {
      st.moving = false;
      if (player.isValid) draw(player, place, text);
    }, 3);
    return;
  }
  if (text === s.text) return;
  s.text = text;
  // A space at each end pads the text inside its dark box, which is exactly as wide as the text.
  send(player, s, place, text ? ` ${text} ` : "");
}

world.afterEvents.playerLeave.subscribe(({ playerId }) => shown.delete(playerId));
