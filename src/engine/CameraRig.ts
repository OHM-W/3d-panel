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

  // Walkthrough Controls
  private moveState = { forward: false, backward: false, left: false, right: false };
  private moveSpeed = 12.0;
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;
  private onMouseMoveBound: (e: MouseEvent) => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.orbit = new OrbitControls(this.camera, this.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;

    this.onKeyDownBound = this.onKeyDown.bind(this);
    this.onKeyUpBound = this.onKeyUp.bind(this);
    this.onMouseMoveBound = this.onMouseMove.bind(this);

    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    this.domElement.addEventListener('mousemove', this.onMouseMoveBound);
  }

  public getMode(): CameraMode {
    return this.mode;
  }

  public setMode(newMode: CameraMode, floorSize = 50) {
    this.mode = newMode;
    this.targetCamPos = null;
    this.targetOrbitTarget = null;

    if (newMode === 'top') {
      this.orbit.enabled = true;
      this.orbit.enableRotate = false;
      this.camera.position.set(0, floorSize * 0.9, 0.001);
      this.camera.lookAt(0, 0, 0);
      this.orbit.target.set(0, 0, 0);
      this.orbit.update();
    } else if (newMode === 'walkthrough') {
      this.orbit.enabled = false;
      this.camera.position.set(0, 1.8, floorSize * 0.35);
      this.camera.lookAt(0, 1.8, 0);
      this.euler.setFromQuaternion(this.camera.quaternion);
    } else {
      // Perspective / Orbit
      this.orbit.enabled = true;
      this.orbit.enableRotate = true;
      this.camera.position.set(0, 20, 26);
      this.camera.lookAt(0, 0, 0);
      this.orbit.target.set(0, 0, 0);
      this.orbit.update();
    }
  }

  public resetView(floorSize = 50) {
    this.setMode(this.mode, floorSize);
  }

  public focusOn(targetPos: THREE.Vector3, distance = 8) {
    if (this.mode === 'walkthrough') {
      const eyePos = targetPos.clone().add(new THREE.Vector3(0, 1.8, distance));
      this.targetCamPos = eyePos;
      this.targetOrbitTarget = targetPos.clone().add(new THREE.Vector3(0, 1.8, 0));
    } else {
      this.targetOrbitTarget = targetPos.clone();
      const offset = new THREE.Vector3(0, distance * 0.7, distance);
      this.targetCamPos = targetPos.clone().add(offset);
    }
  }

  public update(delta: number, floorSize = 50) {
    // 1. Smooth Focus Lerp
    if (this.targetCamPos && this.targetOrbitTarget) {
      this.camera.position.lerp(this.targetCamPos, 0.08);
      if (this.mode !== 'walkthrough') {
        this.orbit.target.lerp(this.targetOrbitTarget, 0.08);
      } else {
        this.camera.lookAt(this.targetOrbitTarget);
      }
      if (this.camera.position.distanceTo(this.targetCamPos) < 0.1) {
        this.targetCamPos = null;
        this.targetOrbitTarget = null;
      }
    }

    // 2. Mode Updates
    if (this.mode === 'walkthrough') {
      this.velocity.x -= this.velocity.x * 10.0 * delta;
      this.velocity.z -= this.velocity.z * 10.0 * delta;

      this.direction.z = Number(this.moveState.forward) - Number(this.moveState.backward);
      this.direction.x = Number(this.moveState.right) - Number(this.moveState.left);
      this.direction.normalize();

      if (this.moveState.forward || this.moveState.backward) {
        this.velocity.z -= this.direction.z * this.moveSpeed * 10.0 * delta;
      }
      if (this.moveState.left || this.moveState.right) {
        this.velocity.x += this.direction.x * this.moveSpeed * 10.0 * delta;
      }

      this.camera.translateX(this.velocity.x * delta);
      this.camera.translateZ(this.velocity.z * delta);
      this.camera.position.y = 1.8; // Maintain walking eye height

      // Clamp within factory floor boundaries
      const bound = (floorSize / 2) - 1;
      this.camera.position.x = Math.max(-bound, Math.min(bound, this.camera.position.x));
      this.camera.position.z = Math.max(-bound, Math.min(bound, this.camera.position.z));
    } else {
      this.orbit.update();
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (this.mode !== 'walkthrough') return;
    if (['ArrowUp', 'KeyW'].includes(e.code)) this.moveState.forward = true;
    if (['ArrowDown', 'KeyS'].includes(e.code)) this.moveState.backward = true;
    if (['ArrowLeft', 'KeyA'].includes(e.code)) this.moveState.left = true;
    if (['ArrowRight', 'KeyD'].includes(e.code)) this.moveState.right = true;
  }

  private onKeyUp(e: KeyboardEvent) {
    if (this.mode !== 'walkthrough') return;
    if (['ArrowUp', 'KeyW'].includes(e.code)) this.moveState.forward = false;
    if (['ArrowDown', 'KeyS'].includes(e.code)) this.moveState.backward = false;
    if (['ArrowLeft', 'KeyA'].includes(e.code)) this.moveState.left = false;
    if (['ArrowRight', 'KeyD'].includes(e.code)) this.moveState.right = false;
  }

  private onMouseMove(e: MouseEvent) {
    if (this.mode !== 'walkthrough' || e.buttons !== 1) return;
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
    this.domElement.removeEventListener('mousemove', this.onMouseMoveBound);
    this.orbit.dispose();
  }
}
