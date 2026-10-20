// R4: reminders in a village friend's own voice — calm wording (BANNED) and only friends who moved in.
import { describe, expect, it } from "vitest";
import { LANGS } from "../src/a11y/strings.ts";
import { RESIDENTS } from "../src/village/catalog.ts";
import { BANNED, reminderBody, RESIDENT_LINES } from "../src/notify/texts.ts";

describe("resident reminder lines", () => {
  it("every language has a calm line for every resident", () => {
    for (const l of LANGS) for (const r of RESIDENTS) {
      const line = RESIDENT_LINES[l][r.id];
      expect(line.length, `${l} ${r.id}`).toBeGreaterThan(5);
      expect(BANNED.test(line), `${l} ${r.id}: ${line}`).toBe(false);
    }
  });
  it("a friend's line every third day, friends taking turns; none without friends", () => {
    expect(reminderBody("en", 1, 0, ["wick", "momo"])).toBe(RESIDENT_LINES.en.wick);
    expect(reminderBody("en", 4, 0, ["wick", "momo"])).toBe(RESIDENT_LINES.en.momo);
    expect(Object.values(RESIDENT_LINES.en)).not.toContain(reminderBody("en", 1, 0, []));
    expect(Object.values(RESIDENT_LINES.en)).not.toContain(reminderBody("en", 0, 0, ["wick"]));
  });
});
