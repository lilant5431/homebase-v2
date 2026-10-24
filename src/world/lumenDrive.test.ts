import { describe, expect, it } from "vitest";
import { lumenDrive } from "./lumenDrive";
import type { WorldInput } from "./contract";
const input: WorldInput = {
  area: "week",
  emphasis: false,
  reducedMotion: false,
};
describe("Lumen presentation light circuit", () => {
  it("keeps all channels finite for malformed and extreme presentation settings", () => {
    for (const value of [NaN, Infinity, -Infinity, -100, 100]) {
      const drive = lumenDrive(
        { ...input, power: value, beamWidth: value },
        value,
        value,
      );
      expect(
        Object.values(drive)
          .filter((v) => typeof v === "number")
          .every(Number.isFinite),
      ).toBe(true);
      expect(drive.width).toBeGreaterThanOrEqual(0.25);
      expect(drive.width).toBeLessThanOrEqual(1.1);
      expect(drive.energy).toBeGreaterThan(0);
      expect(drive.energy).toBeLessThan(2);
    }
  });
  it("beacon off retains an illuminated crystal", () => {
    const on = lumenDrive(input, 2);
    const off = lumenDrive({ ...input, beacon: false }, 2);
    expect(off.beacon).toBe(false);
    expect(off.energy).toBeGreaterThan(0);
    expect(off.energy).toBeLessThan(on.energy);
  });
  it("a frozen clock freezes the circuit without mutating the presentation input", () => {
    const frozen = Object.freeze({ ...input, reducedMotion: true, power: 0.8 });
    expect(lumenDrive(frozen, 3)).toEqual(lumenDrive(frozen, 3));
    expect(lumenDrive(frozen, 4).phase).not.toBe(lumenDrive(frozen, 3).phase);
    expect(lumenDrive({ ...frozen, emphasis: true }, 3).energy).toBeGreaterThan(
      lumenDrive(frozen, 3).energy,
    );
    expect(frozen.power).toBe(0.8);
  });
});
