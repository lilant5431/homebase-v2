import { Vector3, Vector4 } from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

// One closed, convex quartz habit. The GPU traces the SAME planes as this mesh;
// there is no spherical thickness proxy or back-face texture approximation.
export type GemDesign = "original" | "lumen" | "vesper";
export function makeCrystalGeometry(design: GemDesign = "original") {
  const points: Vector3[] = [];
  for (const [height, radius] of [
    [-4.1, 1.6],
    [-2.7, 3.05],
    [2.6, 3.05],
    [4.15, 1.75],
  ]) {
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 + Math.PI / 6;
      points.push(
        new Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius),
      );
    }
  }
  points.push(new Vector3(0.25, 6.4, -0.15), new Vector3(-0.2, -5.7, 0.1));
  if (design !== "original") {
    points.length = 0;
    if (design === "lumen") {
      // Octagonal cut-corner section: broad windows, narrow bevels, pointed crown.
      const outline = [
        [-1.7, -2.1],
        [1.7, -2.1],
        [2.7, -1.1],
        [2.7, 1.1],
        [1.7, 2.1],
        [-1.7, 2.1],
        [-2.7, 1.1],
        [-2.7, -1.1],
      ];
      for (const [y, scale, phase] of [
        [-3.2, 0.67, 0.23],
        [-0.2, 1, 0],
        [2.8, 0.82, 0.23],
        [4.8, 0.38, 0],
      ])
        for (const [x, z] of outline) {
          const px = x * scale,
            pz = z * scale;
          points.push(
            new Vector3(
              px * Math.cos(phase) - pz * Math.sin(phase),
              y,
              px * Math.sin(phase) + pz * Math.cos(phase),
            ),
          );
        }
      points.push(new Vector3(0, 6.3, 0), new Vector3(0, -5.8, 0));
    } else {
      // Five-sided jewel with a flat crown/table and a long asymmetric pavilion.
      // A broad equator and shallow upper tier create a compact, assertive crest.
      for (const [y, r, phase] of [
        [-1.2, 3.5, 0],
        [1.1, 3.8, 0],
        [3.6, 1.7, 0],
      ])
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5 + phase;
          points.push(
            new Vector3(Math.sin(a) * r * 1.12, y, Math.cos(a) * r * 0.82),
          );
        }
      points.push(new Vector3(0.65, -5.0, 0.1));
    }
  }
  const geometry = new ConvexGeometry(points);
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const planes: Vector4[] = [];
  for (let i = 0; i < positions.count; i += 3) {
    const n = new Vector3().fromBufferAttribute(normals, i).normalize();
    const p = new Vector3().fromBufferAttribute(positions, i);
    const plane = new Vector4(n.x, n.y, n.z, -n.dot(p));
    if (
      !planes.some(
        (existing) =>
          Math.abs(existing.x - plane.x) +
            Math.abs(existing.y - plane.y) +
            Math.abs(existing.z - plane.z) +
            Math.abs(existing.w - plane.w) <
          1e-4,
      )
    )
      planes.push(plane);
  }
  return { geometry, planes };
}
