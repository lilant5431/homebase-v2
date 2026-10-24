import { describe, expect, it } from "vitest";
import { Ray, Vector3 } from "three";
import { makeCrystalGeometry } from "./crystalGeometry";
import { viewpoints } from "./contract";

describe("the refractor's actual convex hull", () => {
  it("Lumen planes enclose every mesh vertex", () => {
    const { geometry, planes } = makeCrystalGeometry();
    try {
      expect(planes.length).toBeGreaterThan(12);
      const vertices = geometry.getAttribute("position");
      for (const plane of planes) {
        expect(Math.hypot(plane.x, plane.y, plane.z)).toBeCloseTo(1, 6);
        expect(plane.w).toBeLessThan(0);
        for (let i = 0; i < vertices.count; i++) {
          const p = new Vector3().fromBufferAttribute(vertices, i);
          expect(
            p.x * plane.x + p.y * plane.y + p.z * plane.z + plane.w,
          ).toBeLessThan(0.00001);
        }
      }
    } finally {
      geometry.dispose();
    }
  });
  it("Lumen exits match independent triangle-ray intersections", () => {
    const { geometry, planes } = makeCrystalGeometry();
    try {
      const positions = geometry.getAttribute("position");
      for (const origin of [new Vector3(), new Vector3(0.8, 2.1, -0.4)]) {
        for (let i = 0; i < 40; i++) {
          const direction = new Vector3(
            Math.sin(i * 1.7),
            Math.cos(i * 0.83),
            Math.cos(i * 2.3),
          ).normalize();
          const ray = new Ray(origin, direction);
          const analytic = Math.min(
            ...planes.map((p) => {
              const n = new Vector3(p.x, p.y, p.z);
              const denominator = n.dot(direction);
              return denominator > 0.00001
                ? -(n.dot(origin) + p.w) / denominator
                : Infinity;
            }),
          );
          let triangleDistance = Infinity;
          for (let v = 0; v < positions.count; v += 3) {
            const hit = ray.intersectTriangle(
              new Vector3().fromBufferAttribute(positions, v),
              new Vector3().fromBufferAttribute(positions, v + 1),
              new Vector3().fromBufferAttribute(positions, v + 2),
              false,
              new Vector3(),
            );
            if (hit)
              triangleDistance = Math.min(
                triangleDistance,
                origin.distanceTo(hit),
              );
          }
          expect(Number.isFinite(triangleDistance)).toBe(true);
          expect(analytic).toBeCloseTo(triangleDistance, 4);
        }
      }
    } finally {
      geometry.dispose();
    }
  });
  it("keeps all interpolated orbit routes outside the sculpture and its instruments", () => {
    for (const from of Object.values(viewpoints))
      for (const to of Object.values(viewpoints)) {
        for (let i = 0; i <= 100; i++) {
          const t = i / 100;
          const radius = from.radius * (1 - t) + to.radius * t;
          // Includes pointer drift margin; the outermost halo radius is 8.9.
          expect(radius).toBeGreaterThan(12);
        }
      }
    expect(new Set(Object.values(viewpoints).map((p) => p.angle)).size).toBe(3);
  });
});
