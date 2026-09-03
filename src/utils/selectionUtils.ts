import * as THREE from 'three';

export interface MarqueeRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function isMeshInMarquee(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  viewWidth: number,
  viewHeight: number,
  marquee: MarqueeRect
): boolean {
  if (!mesh || !camera || viewWidth <= 0 || viewHeight <= 0) return false;

  mesh.updateMatrixWorld();

  const tempV = new THREE.Vector3();
  const cornerLocal = new THREE.Vector3();

  let hasVisiblePoints = false;
  let minPx = Infinity;
  let maxPx = -Infinity;
  let minPy = Infinity;
  let maxPy = -Infinity;

  // Project origin / center
  mesh.getWorldPosition(tempV);
  tempV.project(camera);

  if (tempV.z >= -1 && tempV.z <= 1) {
    hasVisiblePoints = true;
    const cx = ((tempV.x + 1) / 2) * viewWidth;
    const cy = ((-tempV.y + 1) / 2) * viewHeight;
    minPx = Math.min(minPx, cx);
    maxPx = Math.max(maxPx, cx);
    minPy = Math.min(minPy, cy);
    maxPy = Math.max(maxPy, cy);
  }

  // Project all 8 corners of unit geometry [-0.5, 0.5] transformed by matrixWorld
  for (let dx = -1; dx <= 1; dx += 2) {
    for (let dy = -1; dy <= 1; dy += 2) {
      for (let dz = -1; dz <= 1; dz += 2) {
        cornerLocal.set(dx * 0.5, dy * 0.5, dz * 0.5);
        cornerLocal.applyMatrix4(mesh.matrixWorld);
        cornerLocal.project(camera);

        if (cornerLocal.z >= -1 && cornerLocal.z <= 1) {
          hasVisiblePoints = true;
          const cx = ((cornerLocal.x + 1) / 2) * viewWidth;
          const cy = ((-cornerLocal.y + 1) / 2) * viewHeight;
          minPx = Math.min(minPx, cx);
          maxPx = Math.max(maxPx, cx);
          minPy = Math.min(minPy, cy);
          maxPy = Math.max(maxPy, cy);
        }
      }
    }
  }

  if (!hasVisiblePoints) return false;

  // 2D AABB overlap check
  return !(minPx > marquee.maxX || maxPx < marquee.minX || minPy > marquee.maxY || maxPy < marquee.minY);
}

export function getMarqueeSelectedMachines(
  machines: Map<string, THREE.Mesh>,
  camera: THREE.Camera,
  viewWidth: number,
  viewHeight: number,
  marquee: MarqueeRect
): string[] {
  if (!machines || !camera || viewWidth <= 0 || viewHeight <= 0) return [];

  const selected: string[] = [];
  for (const [name, mesh] of machines.entries()) {
    if (isMeshInMarquee(mesh, camera, viewWidth, viewHeight, marquee)) {
      selected.push(name);
    }
  }
  return selected;
}
