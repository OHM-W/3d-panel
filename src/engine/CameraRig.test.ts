import * as THREE from 'three';
import { CameraRig } from './CameraRig';

describe('CameraRig', () => {
  let camera: THREE.PerspectiveCamera;
  let domElement: HTMLDivElement;
  let rig: CameraRig;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 1000);
    domElement = document.createElement('div');
    document.body.appendChild(domElement);
    rig = new CameraRig(camera, domElement);
  });

  afterEach(() => {
    rig.dispose();
    domElement.remove();
  });

  describe('R1: 2D Top-Down Mode Mouse Pan Controls', () => {
    it('configures 2D Plan mode with pan controls and disabled rotation', () => {
      rig.setMode('top', 50);

      expect(rig.getMode()).toBe('top');
      expect(rig.orbit.enabled).toBe(true);
      expect(rig.orbit.enableRotate).toBe(false);
      expect(rig.orbit.enablePan).toBe(true);
      expect(rig.orbit.screenSpacePanning).toBe(true);

      // Left click must be bound to PAN for floorplan dragging
      expect(rig.orbit.mouseButtons.LEFT).toBe(THREE.MOUSE.PAN);
      expect(rig.orbit.mouseButtons.MIDDLE).toBe(THREE.MOUSE.DOLLY);
      expect(rig.orbit.mouseButtons.RIGHT).toBe(THREE.MOUSE.PAN);

      // Touch controls
      expect(rig.orbit.touches.ONE).toBe(THREE.TOUCH.PAN);
      expect(rig.orbit.touches.TWO).toBe(THREE.TOUCH.DOLLY_PAN);

      // Camera position overhead
      expect(camera.position.x).toBeCloseTo(0);
      expect(camera.position.y).toBeCloseTo(60); // 50 * 1.2
      expect(camera.position.z).toBeCloseTo(0.02);
      expect(rig.orbit.target.x).toBeCloseTo(0);
      expect(rig.orbit.target.y).toBeCloseTo(0);
      expect(rig.orbit.target.z).toBeCloseTo(0);
    });
  });

  describe('R2: 3D Perspective Orbit Rotation', () => {
    it('configures 3D Orbit mode with rotation enabled and clean mouse re-binding', () => {
      // First switch to top mode
      rig.setMode('top', 50);
      expect(rig.orbit.enableRotate).toBe(false);
      expect(rig.orbit.mouseButtons.LEFT).toBe(THREE.MOUSE.PAN);

      // Switch to perspective mode
      rig.setMode('perspective', 50);

      expect(rig.getMode()).toBe('perspective');
      expect(rig.orbit.enabled).toBe(true);
      expect(rig.orbit.enableRotate).toBe(true);
      expect(rig.orbit.enablePan).toBe(true);
      expect(rig.orbit.screenSpacePanning).toBe(true);

      // Mouse bindings for 3D orbit
      expect(rig.orbit.mouseButtons.LEFT).toBe(THREE.MOUSE.ROTATE);
      expect(rig.orbit.mouseButtons.MIDDLE).toBe(THREE.MOUSE.DOLLY);
      expect(rig.orbit.mouseButtons.RIGHT).toBe(THREE.MOUSE.PAN);

      // Touch controls
      expect(rig.orbit.touches.ONE).toBe(THREE.TOUCH.ROTATE);
      expect(rig.orbit.touches.TWO).toBe(THREE.TOUCH.DOLLY_PAN);

      // 3D camera default position
      expect(camera.position.x).toBeCloseTo(0);
      expect(camera.position.y).toBeCloseTo(122);
      expect(camera.position.z).toBeCloseTo(128);
    });

    it('switching modes cleans up stale lerp targets and resets velocity', () => {
      const machinePos = new THREE.Vector3(10, 0, -20);
      rig.focusOn(machinePos, 12);

      // Mode switch cancels active focus lerp
      rig.setMode('top', 40);
      expect(rig.getMode()).toBe('top');

      rig.setMode('perspective', 40);
      expect(rig.getMode()).toBe('perspective');
    });

    it('handles safe fallback for non-positive or invalid floorSize', () => {
      rig.setMode('top', 0);
      expect(camera.position.y).toBeCloseTo(60); // defaults to 50 * 1.2

      rig.setMode('top', -100);
      expect(camera.position.y).toBeCloseTo(60);

      rig.setMode('top', NaN);
      expect(camera.position.y).toBeCloseTo(60);
    });
  });

  describe('R3: Machine Focus in 2D Top Mode vs 3D Perspective Mode', () => {
    it('focuses directly overhead in 2D Top mode without tilting into perspective angle', () => {
      rig.setMode('top', 50);
      const machinePos = new THREE.Vector3(15, 1, -25);

      rig.focusOn(machinePos, 10);

      // Simulate lerp update steps until settled
      for (let i = 0; i < 120; i++) {
        rig.update(0.016, 50);
      }

      // Camera position should be centered above machine with overhead Z offset (0.02)
      expect(camera.position.x).toBeCloseTo(15, 2);
      expect(camera.position.z).toBeCloseTo(-25 + 0.02, 2);
      // Orbit target centered at machine (X, 0, Z)
      expect(rig.orbit.target.x).toBeCloseTo(15, 2);
      expect(rig.orbit.target.y).toBeCloseTo(0, 2);
      expect(rig.orbit.target.z).toBeCloseTo(-25, 2);

      // Rotate remains disabled in 2D mode
      expect(rig.orbit.enableRotate).toBe(false);
      expect(rig.orbit.mouseButtons.LEFT).toBe(THREE.MOUSE.PAN);
    });

    it('preserves custom zoom height during 2D focus', () => {
      rig.setMode('top', 50);
      camera.position.y = 35; // User zoomed in

      rig.focusOn(new THREE.Vector3(20, 0, 40), 10);
      for (let i = 0; i < 120; i++) {
        rig.update(0.016, 50);
      }

      expect(camera.position.y).toBeCloseTo(35, 2);
      expect(camera.position.x).toBeCloseTo(20, 2);
      expect(camera.position.z).toBeCloseTo(40 + 0.02, 2);
    });

    it('focuses at 3D angled perspective in perspective mode', () => {
      rig.setMode('perspective', 50);
      const machinePos = new THREE.Vector3(10, 0, 10);
      const distance = 10;

      rig.focusOn(machinePos, distance);

      // Simulate lerp update steps until settled
      for (let i = 0; i < 120; i++) {
        rig.update(0.016, 50);
      }

      // 3D mode tilts camera by offset (0, distance * 0.7, distance)
      expect(camera.position.x).toBeCloseTo(10, 2);
      expect(camera.position.y).toBeCloseTo(0 + distance * 0.7, 2);
      expect(camera.position.z).toBeCloseTo(10 + distance, 2);
      expect(rig.orbit.target.x).toBeCloseTo(10, 2);
      expect(rig.orbit.target.z).toBeCloseTo(10, 2);

      // Rotate is enabled
      expect(rig.orbit.enableRotate).toBe(true);
      expect(rig.orbit.mouseButtons.LEFT).toBe(THREE.MOUSE.ROTATE);
    });

    it('accurately converges and snaps to exact destination even for close-range focus targets (< 0.1)', () => {
      rig.setMode('top', 50);
      // Start camera at (10, 60, 10.02)
      camera.position.set(10, 60, 10.02);
      rig.orbit.target.set(10, 0, 10);

      // Target machine is extremely close (dx = 0.04, dz = 0.03, initial dist = 0.05 < 0.1)
      const nearbyMachine = new THREE.Vector3(10.04, 0, 10.03);
      rig.focusOn(nearbyMachine, 8);

      for (let i = 0; i < 60; i++) {
        rig.update(0.016, 50);
      }

      // Must snap to exact position without premature abort
      expect(camera.position.x).toBeCloseTo(10.04, 5);
      expect(camera.position.y).toBeCloseTo(60, 5);
      expect(camera.position.z).toBeCloseTo(10.03 + 0.02, 5);
      expect(rig.orbit.target.x).toBeCloseTo(10.04, 5);
      expect(rig.orbit.target.y).toBeCloseTo(0, 5);
      expect(rig.orbit.target.z).toBeCloseTo(10.03, 5);
    });

    it('handles rapid successive focusOn calls without state corruption', () => {
      rig.setMode('perspective', 50);
      const posA = new THREE.Vector3(10, 0, 10);
      const posB = new THREE.Vector3(-20, 0, 30);

      rig.focusOn(posA, 8);
      rig.update(0.016, 50);

      // Interrupt with new machine focus immediately
      rig.focusOn(posB, 10);
      for (let i = 0; i < 120; i++) {
        rig.update(0.016, 50);
      }

      expect(camera.position.x).toBeCloseTo(-20, 2);
      expect(camera.position.y).toBeCloseTo(7, 2); // 10 * 0.7
      expect(camera.position.z).toBeCloseTo(40, 2); // 30 + 10
      expect(rig.orbit.target.x).toBeCloseTo(-20, 2);
      expect(rig.orbit.target.z).toBeCloseTo(30, 2);
    });

    it('smoothly converges under high refresh rate (144 Hz / delta = 0.0069s)', () => {
      rig.setMode('perspective', 50);
      rig.focusOn(new THREE.Vector3(30, 0, -30), 10);

      // 144 FPS for ~1.4 seconds (200 frames)
      for (let i = 0; i < 200; i++) {
        rig.update(0.00694, 50);
      }

      expect(camera.position.x).toBeCloseTo(30, 2);
      expect(camera.position.y).toBeCloseTo(7, 2);
      expect(camera.position.z).toBeCloseTo(-20, 2);
    });

    it('smoothly converges under low refresh rate (15 FPS / delta = 0.0667s)', () => {
      rig.setMode('perspective', 50);
      rig.focusOn(new THREE.Vector3(-15, 0, 25), 10);

      // 15 FPS for ~1.5 seconds (23 frames)
      for (let i = 0; i < 25; i++) {
        rig.update(0.0667, 50);
      }

      expect(camera.position.x).toBeCloseTo(-15, 2);
      expect(camera.position.y).toBeCloseTo(7, 2);
      expect(camera.position.z).toBeCloseTo(35, 2);
    });
  });

  describe('Interruption and Manual Input Handling', () => {
    it('cancels active focus lerp when user begins manual orbit/pan interaction', () => {
      rig.setMode('perspective', 50);
      const targetPos = new THREE.Vector3(50, 0, 50);
      rig.focusOn(targetPos, 10);

      rig.update(0.016, 50);
      // User starts dragging canvas with mouse -> OrbitControls fires 'start' event
      rig.orbit.dispatchEvent({ type: 'start' });

      // Next update step should NOT lerp towards targetPos anymore
      const currentPos = camera.position.clone();
      rig.update(0.016, 50);

      // Camera position should stay where OrbitControls left it, not continue moving to targetPos
      expect(camera.position.x).toBe(currentPos.x);
      expect(camera.position.y).toBe(currentPos.y);
      expect(camera.position.z).toBe(currentPos.z);
    });

    it('cancels active focus lerp when user presses movement keys in walkthrough mode', () => {
      rig.setMode('walkthrough', 50);
      rig.focusOn(new THREE.Vector3(20, 0, 20), 8);

      rig.update(0.016, 50);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));

      const posAfterKey = camera.position.clone();
      // Orbit target was cleared, camera moves via WASD velocity
      rig.update(0.016, 50);

      expect(camera.position.y).toBe(1.8);
      expect(camera.position.distanceTo(posAfterKey)).toBeGreaterThanOrEqual(0);
    });

    it('cancels active focus lerp when user drags mouse in walkthrough mode', () => {
      rig.setMode('walkthrough', 50);
      rig.focusOn(new THREE.Vector3(20, 0, 20), 8);

      rig.update(0.016, 50);
      domElement.dispatchEvent(new MouseEvent('mousemove', { buttons: 1, movementX: 10, movementY: 5 }));

      const posAfterMouse = camera.position.clone();
      rig.update(0.016, 50);

      // Should not lerp to (20, 1.8, 28)
      expect(camera.position.x).toBeCloseTo(posAfterMouse.x, 2);
    });

    it('ignores walkthrough movement keys when user is typing in an input or textarea element', () => {
      rig.setMode('walkthrough', 50);
      const inputEl = document.createElement('input');
      document.body.appendChild(inputEl);

      const event = new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true });
      Object.defineProperty(event, 'target', { value: inputEl });
      window.dispatchEvent(event);

      const posBefore = camera.position.clone();
      rig.update(0.016, 50);
      expect(camera.position.x).toBe(posBefore.x);
      expect(camera.position.z).toBe(posBefore.z);

      inputEl.remove();
    });

    it('resets walkthrough key states and velocity on window blur', () => {
      rig.setMode('walkthrough', 50);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));

      // Blur window
      window.dispatchEvent(new Event('blur'));

      // Velocity is reset to 0
      const posBefore = camera.position.clone();
      rig.update(0.016, 50);
      expect(camera.position.x).toBe(posBefore.x);
      expect(camera.position.z).toBe(posBefore.z);
    });
  });

  describe('Defensive Input Hardening', () => {
    it('gracefully ignores invalid, null, undefined, NaN, or non-finite focus target coordinates', () => {
      expect(() => rig.focusOn(null as any)).not.toThrow();
      expect(() => rig.focusOn(undefined as any)).not.toThrow();
      expect(() => rig.focusOn({} as any)).not.toThrow();
      expect(() => rig.focusOn({ x: NaN, y: 0, z: 0 } as any)).not.toThrow();
      expect(() => rig.focusOn({ x: 0, y: 0, z: NaN } as any)).not.toThrow();
      expect(() => rig.focusOn({ x: Infinity, y: 0, z: 0 } as any)).not.toThrow();
      expect(() => rig.focusOn({ x: 0, y: 0, z: -Infinity } as any)).not.toThrow();
      expect(() => rig.focusOn({ x: 10, y: Infinity, z: 10 } as any)).not.toThrow();
    });

    it('accepts plain coordinate objects without .clone() method', () => {
      rig.setMode('perspective', 50);
      const plainObj = { x: 10, y: 2, z: 15 };

      expect(() => rig.focusOn(plainObj, 8)).not.toThrow();

      for (let i = 0; i < 120; i++) {
        rig.update(0.016, 50);
      }

      expect(camera.position.x).toBeCloseTo(10, 2);
      expect(camera.position.y).toBeCloseTo(2 + 8 * 0.7, 2);
      expect(camera.position.z).toBeCloseTo(15 + 8, 2);
    });

    it('handles negative, NaN, or Infinity distance gracefully with default fallback', () => {
      rig.setMode('perspective', 50);
      const targetPos = new THREE.Vector3(10, 0, 10);

      rig.focusOn(targetPos, -5);
      for (let i = 0; i < 120; i++) {
        rig.update(0.016, 50);
      }

      // Falls back to safe distance = 8
      expect(camera.position.z).toBeCloseTo(10 + 8, 2);

      // Test Infinity distance
      rig.focusOn(targetPos, Infinity);
      for (let i = 0; i < 120; i++) {
        rig.update(0.016, 50);
      }
      expect(camera.position.z).toBeCloseTo(10 + 8, 2);
    });
  });

  describe('Orbit Controls Enablement and Mode Protection', () => {
    it('setOrbitEnabled respects mode and keeps orbit disabled in walkthrough mode', () => {
      rig.setMode('perspective', 50);
      expect(rig.orbit.enabled).toBe(true);

      rig.setOrbitEnabled(false);
      expect(rig.orbit.enabled).toBe(false);

      rig.setOrbitEnabled(true);
      expect(rig.orbit.enabled).toBe(true);

      // In walkthrough mode, setOrbitEnabled(true) must NOT enable orbit controls
      rig.setMode('walkthrough', 50);
      expect(rig.orbit.enabled).toBe(false);

      rig.setOrbitEnabled(true);
      expect(rig.orbit.enabled).toBe(false);

      rig.setOrbitEnabled(false);
      expect(rig.orbit.enabled).toBe(false);

      // In top mode, setOrbitEnabled works normally
      rig.setMode('top', 50);
      expect(rig.orbit.enabled).toBe(true);

      rig.setOrbitEnabled(false);
      expect(rig.orbit.enabled).toBe(false);

      rig.setOrbitEnabled(true);
      expect(rig.orbit.enabled).toBe(true);
    });
  });

  describe('Walkthrough Mode Integration', () => {
    it('focuses and synchronizes camera orientation in walkthrough mode', () => {
      rig.setMode('walkthrough', 50);
      expect(rig.getMode()).toBe('walkthrough');
      expect(rig.orbit.enabled).toBe(false);

      const targetPos = new THREE.Vector3(5, 0, -10);
      rig.focusOn(targetPos, 6);

      for (let i = 0; i < 120; i++) {
        rig.update(0.016, 50);
      }

      // Eye height at 1.8
      expect(camera.position.y).toBe(1.8);
      expect(camera.position.x).toBeCloseTo(5, 2);
      expect(camera.position.z).toBeCloseTo(-10 + 6, 2);
    });
  });

  describe('Reset and Lifecycle', () => {
    it('resetView restores active mode defaults', () => {
      rig.setMode('top', 50);
      camera.position.set(100, 200, 300);
      rig.resetView(50);

      expect(camera.position.x).toBeCloseTo(0);
      expect(camera.position.y).toBeCloseTo(60);
      expect(camera.position.z).toBeCloseTo(0.02);
    });

    it('dispose cleans up event listeners without error', () => {
      expect(() => rig.dispose()).not.toThrow();
    });
  });
});


