import { Vector3, Vector4 } from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

// One closed, convex quartz habit. The GPU traces the SAME planes as this mesh;
// there is no spherical thickness proxy or back-face texture approximation.
export function makeCrystalGeometry() {
  const points: Vector3[] = [];
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
