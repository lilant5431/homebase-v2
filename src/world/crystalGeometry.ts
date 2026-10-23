import { Vector3, Vector4 } from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

// One closed, convex quartz habit. The GPU traces the SAME planes as this mesh;
// there is no spherical thickness proxy or back-face texture approximation.
export function makeCrystalGeometry() {
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
