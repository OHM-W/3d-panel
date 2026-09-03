import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CameraMode } from '../types';

export class CameraRig {
  public camera: THREE.PerspectiveCamera;
  public orbit: OrbitControls;
  private domElement: HTMLElement;
  private mode: CameraMode = 'perspective';

  // Smooth Focus
  private targetCamPos: THREE.Vector3 | null = null;
  private targetOrbitTarget: THREE.Vector3 | null = null;

  // Walkthrough & Pan Controls
  private moveState = { forward: false, backward: false, left: false, right: false };
  private moveSpeed = 14.0;
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;
  private onMouseMoveBound: (e: MouseEvent) => void;
  private onOrbitStartBound: () => void;
  private onBlurBound: () => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.orbit = new OrbitControls(this.camera, this.domElement);

    // ─── 🚀 Free Camera Configuration (Unconstrained 3D Orbit) ──────────────
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.enablePan = true;
    this.orbit.screenSpacePanning = true; // Freely pan in screen space (up, down, left, right)
    this.orbit.panSpeed = 1.4;
    this.orbit.rotateSpeed = 1.0;
    this.orbit.zoomSpeed = 1.2;
    this.orbit.minDistance = 0.5;
    this.orbit.maxDistance = 1500;
    this.orbit.maxPolarAngle = Math.PI - 0.05; // Full 180° vertical rotation freedom

    // Mouse & Touch bindings
    this.orbit.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.orbit.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this.onKeyDownBound = this.onKeyDown.bind(this);
    this.onKeyUpBound = this.onKeyUp.bind(this);
    this.onMouseMoveBound = this.onMouseMove.bind(this);
    this.onOrbitStartBound = this.onOrbitStart.bind(this);
    this.onBlurBound = this.onBlur.bind(this);

    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('blur', this.onBlurBound);
    this.domElement.addEventListener('mousemove', this.onMouseMoveBound);
    this.orbit.addEventListener('start', this.onOrbitStartBound);
  }

  private onOrbitStart() {
    // Cancel in-flight focus lerp when user interacts manually with orbit controls
    this.targetCamPos = null;
    this.targetOrbitTarget = null;
  }

  private onBlur() {
    // Reset key states and velocity on window/tab blur to prevent stuck keys
    this.moveState = { forward: false, backward: false, left: false, right: false };
    this.velocity.set(0, 0, 0);
  }

  public getMode(): CameraMode {
    return this.mode;
  }

  public setOrbitEnabled(enabled: boolean) {
    if (this.mode === 'walkthrough') {
      this.orbit.enabled = false;
    } else {
      this.orbit.enabled = enabled;
    }
  }

  public setMode(newMode: CameraMode, floorSize = 50) {
    this.mode = newMode;
    this.targetCamPos = null;
    this.targetOrbitTarget = null;

    const safeFloorSize = typeof floorSize === 'number' && Number.isFinite(floorSize) && floorSize > 0 ? floorSize : 50;

    // BUG FIX (HIGH): Reset walkthrough state so switching modes doesn't carry
    // over stale velocity or stuck key states → camera won't lurch on re-entry
    this.velocity.set(0, 0, 0);
    this.moveState = { forward: false, backward: false, left: false, right: false };

    if (newMode === 'top') {
      this.orbit.enabled = true;
      this.orbit.enableRotate = false;
      this.orbit.enablePan = true;
      this.orbit.screenSpacePanning = true;
      this.orbit.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      this.orbit.touches = {
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
      this.camera.position.set(0, safeFloorSize * 1.2, 0.02);
      this.camera.lookAt(0, 0, 0);
      this.orbit.target.set(0, 0, 0);
      this.orbit.update();
    } else if (newMode === 'walkthrough') {
      this.orbit.enabled = false;
      this.camera.position.set(0, 1.8, safeFloorSize * 0.35);
      this.camera.lookAt(0, 1.8, 0);
      this.euler.setFromQuaternion(this.camera.quaternion);
    } else {
      // Free 3D Orbit
      this.orbit.enabled = true;
      this.orbit.enableRotate = true;
      this.orbit.enablePan = true;
      this.orbit.screenSpacePanning = true;
      this.orbit.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      this.orbit.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
      this.camera.position.set(0, 122, 128);
      this.camera.lookAt(0, 0, 0);
      this.orbit.target.set(0, 0, 0);
      this.orbit.update();
    }
  }

  public resetView(floorSize = 50) {
    this.setMode(this.mode, floorSize);
  }

  public focusOn(targetPos: THREE.Vector3 | { x: number; y?: number; z: number }, distance = 8) {
    if (
      !targetPos ||
      typeof targetPos.x !== 'number' ||
      typeof targetPos.z !== 'number' ||
      !Number.isFinite(targetPos.x) ||
      !Number.isFinite(targetPos.z)
    ) {
      return;
    }

    const safeDist = typeof distance === 'number' && Number.isFinite(distance) && distance > 0 ? distance : 8;
    const targetY = typeof targetPos.y === 'number' && Number.isFinite(targetPos.y) ? targetPos.y : 0;
    const pos = new THREE.Vector3(targetPos.x, targetY, targetPos.z);

    if (this.mode === 'walkthrough') {
      const eyePos = pos.clone().add(new THREE.Vector3(0, 1.8, safeDist));
      this.targetCamPos = eyePos;
      this.targetOrbitTarget = pos.clone().add(new THREE.Vector3(0, 1.8, 0));
    } else if (this.mode === 'top') {
      const camY = this.camera.position.y > 1 ? this.camera.position.y : 60;
      this.targetOrbitTarget = new THREE.Vector3(pos.x, 0, pos.z);
      this.targetCamPos = new THREE.Vector3(pos.x, camY, pos.z + 0.02);
    } else {
      this.targetOrbitTarget = pos.clone();
      const offset = new THREE.Vector3(0, safeDist * 0.7, safeDist);
      this.targetCamPos = pos.clone().add(offset);
    }
  }

  public update(delta?: number, floorSize = 50) {
    const safeFloorSize = typeof floorSize === 'number' && Number.isFinite(floorSize) && floorSize > 0 ? floorSize : 50;
    const safeDelta = Math.min(Math.max(typeof delta === 'number' && Number.isFinite(delta) ? delta : 0.016, 0.0001), 0.2);

    // 1. Smooth Focus Lerp (Framerate-independent exponential decay)
    if (this.targetCamPos && this.targetOrbitTarget) {
      // Exponential decay rate (~1.0s transition duration, lambda = 7.0)
      const lerpFactor = 1 - Math.exp(-7.0 * safeDelta);
      this.camera.position.lerp(this.targetCamPos, lerpFactor);
      if (this.mode !== 'walkthrough') {
        this.orbit.target.lerp(this.targetOrbitTarget, lerpFactor);
      } else {
        this.camera.lookAt(this.targetOrbitTarget);
      }

      const camDist = this.camera.position.distanceTo(this.targetCamPos);
      const targetDist = this.mode === 'walkthrough' ? 0 : this.orbit.target.distanceTo(this.targetOrbitTarget);

      if (camDist < 0.02 && targetDist < 0.02) {
        this.camera.position.copy(this.targetCamPos);
        if (this.mode !== 'walkthrough') {
          this.orbit.target.copy(this.targetOrbitTarget);
        } else {
          this.camera.lookAt(this.targetOrbitTarget);
          this.euler.setFromQuaternion(this.camera.quaternion);
        }
        this.targetCamPos = null;
        this.targetOrbitTarget = null;
      }
    }

    // 2. Mode Updates
    if (this.mode === 'walkthrough') {
      this.velocity.x -= this.velocity.x * 10.0 * safeDelta;
      this.velocity.z -= this.velocity.z * 10.0 * safeDelta;

      this.direction.z = Number(this.moveState.forward) - Number(this.moveState.backward);
      this.direction.x = Number(this.moveState.right) - Number(this.moveState.left);
      this.direction.normalize();

      if (this.moveState.forward || this.moveState.backward) {
        this.velocity.z -= this.direction.z * this.moveSpeed * 10.0 * safeDelta;
      }
      if (this.moveState.left || this.moveState.right) {
        this.velocity.x += this.direction.x * this.moveSpeed * 10.0 * safeDelta;
      }

      this.camera.translateX(this.velocity.x * safeDelta);
      this.camera.translateZ(this.velocity.z * safeDelta);
      this.camera.position.y = 1.8;

      const bound = (safeFloorSize / 2) - 1;
      this.camera.position.x = Math.max(-bound, Math.min(bound, this.camera.position.x));
      this.camera.position.z = Math.max(-bound, Math.min(bound, this.camera.position.z));
    } else {
      this.orbit.update();
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (this.mode !== 'walkthrough') {
      return;
    }
    const targetTag = (e.target as HTMLElement)?.tagName;
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
      return;
    }
    // Cancel any active automated focus transition when user initiates manual movement
    this.targetCamPos = null;
    this.targetOrbitTarget = null;

    if (['ArrowUp', 'KeyW'].includes(e.code)) {
      this.moveState.forward = true;
    }
    if (['ArrowDown', 'KeyS'].includes(e.code)) {
      this.moveState.backward = true;
    }
    if (['ArrowLeft', 'KeyA'].includes(e.code)) {
      this.moveState.left = true;
    }
    if (['ArrowRight', 'KeyD'].includes(e.code)) {
      this.moveState.right = true;
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    if (this.mode !== 'walkthrough') {
      return;
    }
    const targetTag = (e.target as HTMLElement)?.tagName;
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
      return;
    }
    if (['ArrowUp', 'KeyW'].includes(e.code)) {
      this.moveState.forward = false;
    }
    if (['ArrowDown', 'KeyS'].includes(e.code)) {
      this.moveState.backward = false;
    }
    if (['ArrowLeft', 'KeyA'].includes(e.code)) {
      this.moveState.left = false;
    }
    if (['ArrowRight', 'KeyD'].includes(e.code)) {
      this.moveState.right = false;
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (this.mode !== 'walkthrough' || e.buttons !== 1) {
      return;
    }
    // Cancel any active automated focus transition when user initiates manual look
    this.targetCamPos = null;
    this.targetOrbitTarget = null;

    const movementX = e.movementX || 0;
    const movementY = e.movementY || 0;

    this.euler.y -= movementX * 0.003;
    this.euler.x -= movementY * 0.003;
    this.euler.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.euler.x));

    this.camera.quaternion.setFromEuler(this.euler);
  }

  public dispose() {
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('blur', this.onBlurBound);
    this.domElement.removeEventListener('mousemove', this.onMouseMoveBound);
    this.orbit.removeEventListener('start', this.onOrbitStartBound);
    this.orbit.dispose();
  }
}
