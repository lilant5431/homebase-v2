import { describe, expect, it } from "vitest";
import { createLightEvents } from "./lightEvents";
import type { WorldInput } from "./contract";
const base: WorldInput = {
  area: "week",
  emphasis: false,
  reducedMotion: false,
  power: 1,
};
describe("interaction light wavefronts", () => {
  it("idle clocks and camera inspection do not generate repeated ripples", () => {
    const circuit = createLightEvents(base);
    for (let t = 0; t < 60; t++) {
      circuit.update({ ...base, orbit: t * 0.01 }, t);
      expect(circuit.sample(t).events).toHaveLength(0);
    }
    expect(circuit.sample(60).count).toBe(0);
  });
  it("accumulates small energy adjustments into a bounded meaningful change", () => {
    const circuit = createLightEvents(base);
    circuit.update({ ...base, power: 1.05 }, 1);
    expect(circuit.sample(1).count).toBe(0);
    circuit.update({ ...base, power: 1.1 }, 2);
    expect(circuit.sample(2)).toMatchObject({ count: 1, reason: "Energy" });
    circuit.update({ ...base, power: 1.1 }, 3);
    expect(circuit.sample(3).count).toBe(1);
    expect(circuit.sample(8).events).toHaveLength(0);
    expect(circuit.sample(8).flash).toBe(0);
  });
  it("emits for navigation and both beacon edges, bounding rapid interactions", () => {
    const circuit = createLightEvents(base);
    for (let i = 0; i < 30; i++)
      circuit.update(
        {
          ...base,
          area: i % 2 ? "assignments" : "planning",
          beacon: !!(i % 2),
        },
        i * 0.1,
      );
    expect(circuit.sample(3).events).toHaveLength(8);
    expect(circuit.sample(3).reason).toBe("Navigation");
    circuit.update({ ...base, area: "assignments", beacon: false }, 3.1);
    expect(circuit.sample(3.1).reason).toBe("Beacon");
    circuit.update({ ...base, area: "assignments", beacon: true }, 3.2);
    expect(circuit.sample(3.2).reason).toBe("Beacon");
  });
  it("clears animation on reduced motion/reference mode without delayed replay", () => {
    for (const mode of [{ reducedMotion: true }, { refined: false }]) {
      const circuit = createLightEvents(base);
      circuit.update({ ...base, beacon: false }, 1);
      circuit.update({ ...base, ...mode }, 1.1);
      expect(circuit.sample(1.1).events).toHaveLength(0);
      circuit.update(base, 1.2);
      expect(circuit.sample(1.2).events).toHaveLength(0);
      circuit.update({ ...base, area: "planning" }, 2);
      expect(circuit.sample(2).events).toHaveLength(1);
    }
  });
  it("normalizes malformed settings and copies caller state", () => {
    const input = { ...base };
    const circuit = createLightEvents(input);
    input.area = "planning";
    circuit.update({ ...base, power: NaN }, 1);
    circuit.update({ ...base, power: 1.5 }, 2);
    expect(
      circuit.sample(2).events.every((e) => Number.isFinite(e.strength)),
    ).toBe(true);
    expect(circuit.sample(2).reason).toBe("Energy");
  });
});
