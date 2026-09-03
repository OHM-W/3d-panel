import * as THREE from 'three';
import { isMeshInMarquee, getMarqueeSelectedMachines, MarqueeRect } from './selectionUtils';

describe('selectionUtils', () => {
  let camera: THREE.PerspectiveCamera;
  const viewWidth = 1000;
  const viewHeight = 800;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(45, viewWidth / viewHeight, 0.1, 1000);
    // Position camera looking down from (0, 100, 100) towards (0, 0, 0)
    camera.position.set(0, 100, 100);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
  });

  const createBoxMesh = (name: string, x: number, y: number, z: number, sx = 2, sy = 1, sz = 2) => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.userData = { name };
    mesh.updateMatrixWorld();
    return mesh;
  };

  describe('isMeshInMarquee', () => {
    it('returns true when mesh is located in the center of the viewport and marquee covers center', () => {
      const mesh = createBoxMesh('M1', 0, 0.5, 0);
      // Origin (0,0,0) projects to (500, 400)
      const marquee: MarqueeRect = { minX: 400, maxX: 600, minY: 300, maxY: 500 };
      expect(isMeshInMarquee(mesh, camera, viewWidth, viewHeight, marquee)).toBe(true);
    });

    it('returns false when mesh is completely outside the marquee rectangle', () => {
      const mesh = createBoxMesh('M1', 50, 0.5, -50);
      const marquee: MarqueeRect = { minX: 400, maxX: 600, minY: 300, maxY: 500 };
      expect(isMeshInMarquee(mesh, camera, viewWidth, viewHeight, marquee)).toBe(false);
    });

    it('returns true when marquee overlaps the edge or corner of a scaled machine even if center is missed', () => {
      // Large mesh centered at (0, 0.5, 0) with width = 40 (extends X: -20 to +20)
      const mesh = createBoxMesh('M_Wide', 0, 0.5, 0, 40, 2, 4);

      // Project origin (500, 400).
      // A corner at X = +20 will project further to the right on screen (e.g. > 600px).
      // We set a marquee that covers only the right wing of the machine [600, 750]
      const marqueeRightEdge: MarqueeRect = { minX: 580, maxX: 750, minY: 350, maxY: 450 };
      expect(isMeshInMarquee(mesh, camera, viewWidth, viewHeight, marqueeRightEdge)).toBe(true);
    });

    it('does not select meshes located behind the camera frustum', () => {
      // Camera is at (0, 100, 100) looking at (0,0,0).
      // A point at (0, 150, 150) is behind the camera.
      const behindMesh = createBoxMesh('Behind', 0, 150, 150);
      const marquee: MarqueeRect = { minX: 0, maxX: 1000, minY: 0, maxY: 800 };
      expect(isMeshInMarquee(behindMesh, camera, viewWidth, viewHeight, marquee)).toBe(false);
    });

    it('handles null, undefined, or zero-dimension viewport gracefully', () => {
      const mesh = createBoxMesh('M1', 0, 0, 0);
      const marquee: MarqueeRect = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
      expect(isMeshInMarquee(null as any, camera, viewWidth, viewHeight, marquee)).toBe(false);
      expect(isMeshInMarquee(mesh, null as any, viewWidth, viewHeight, marquee)).toBe(false);
      expect(isMeshInMarquee(mesh, camera, 0, viewHeight, marquee)).toBe(false);
      expect(isMeshInMarquee(mesh, camera, viewWidth, 0, marquee)).toBe(false);
    });
  });

  describe('getMarqueeSelectedMachines', () => {
    it('returns array of matching machine names projecting inside marquee', () => {
      const map = new Map<string, THREE.Mesh>();
      const m1 = createBoxMesh('M1', 0, 0.5, 0);
      const m2 = createBoxMesh('M2', 100, 0.5, 100);
      map.set('M1', m1);
      map.set('M2', m2);

      const marquee: MarqueeRect = { minX: 450, maxX: 550, minY: 350, maxY: 450 };
      const selected = getMarqueeSelectedMachines(map, camera, viewWidth, viewHeight, marquee);
      expect(selected).toEqual(['M1']);
    });

    it('handles empty machines map', () => {
      const map = new Map<string, THREE.Mesh>();
      const marquee: MarqueeRect = { minX: 0, maxX: 500, minY: 0, maxY: 500 };
      expect(getMarqueeSelectedMachines(map, camera, viewWidth, viewHeight, marquee)).toEqual([]);
    });
  });
});
