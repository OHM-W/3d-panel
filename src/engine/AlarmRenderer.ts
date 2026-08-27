import * as THREE from 'three';
import { AlarmSeverity } from '../types';

export class AlarmRenderer {
  private scene: THREE.Scene;
  private beacons: Map<string, THREE.PointLight> = new Map();
  private lotoFrames: Map<string, THREE.LineSegments> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public updateMachineVisuals(
    name: string,
    mesh: THREE.Mesh,
    status: number | undefined,
    severity: AlarmSeverity,
    isLOTO: boolean,
    enableISA101: boolean,
    enableLOTOOption: boolean
  ) {
    const isCritical = status === 3 || severity === 'Critical';
    const isMajor = severity === 'Major';

    // 1. ISA-101 360° Strobe Beacon Light
    if (isCritical && enableISA101) {
      if (!this.beacons.has(name)) {
        const beacon = new THREE.PointLight(0xff1111, 0, 10);
        beacon.position.copy(mesh.position);
        beacon.position.y += Math.abs(mesh.scale.y) + 1.5;
        this.scene.add(beacon);
        this.beacons.set(name, beacon);
      }
    } else {
      const b = this.beacons.get(name);
      if (b) {
        this.scene.remove(b);
        this.beacons.delete(name);
      }
    }

    // 2. LOTO (Lockout / Tagout) Safety Wireframe Box
    if ((isLOTO || status === 4) && enableLOTOOption) {
      if (!this.lotoFrames.has(name)) {
        const boxGeo = new THREE.BoxGeometry(1.05, 1.05, 1.05);
        const wireGeo = new THREE.WireframeGeometry(boxGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
        const wireframe = new THREE.LineSegments(wireGeo, lineMat);
        wireframe.position.copy(mesh.position);
        wireframe.scale.copy(mesh.scale);
        wireframe.rotation.copy(mesh.rotation);
        this.scene.add(wireframe);
        this.lotoFrames.set(name, wireframe);
      }
    } else {
      const frame = this.lotoFrames.get(name);
      if (frame) {
        this.scene.remove(frame);
        frame.geometry.dispose();
        (frame.material as THREE.Material).dispose();
        this.lotoFrames.delete(name);
      }
    }
  }

  public animate(time: number) {
    // Pulse beacon lights
    for (const [, beacon] of this.beacons.entries()) {
      beacon.intensity = Math.abs(Math.sin(time * 5)) * 6.0;
    }

    // Rotate LOTO security frames slightly for glowing effect
    for (const [, frame] of this.lotoFrames.entries()) {
      const mat = frame.material as THREE.LineBasicMaterial;
      mat.opacity = 0.5 + Math.abs(Math.sin(time * 2)) * 0.5;
      mat.transparent = true;
    }
  }

  public removeMachine(name: string) {
    const b = this.beacons.get(name);
    if (b) {
      this.scene.remove(b);
      this.beacons.delete(name);
    }
    const frame = this.lotoFrames.get(name);
    if (frame) {
      this.scene.remove(frame);
      frame.geometry.dispose();
      (frame.material as THREE.Material).dispose();
      this.lotoFrames.delete(name);
    }
  }

  public dispose() {
    for (const [, b] of this.beacons.entries()) {
      this.scene.remove(b);
    }
    this.beacons.clear();

    for (const [, frame] of this.lotoFrames.entries()) {
      this.scene.remove(frame);
      frame.geometry.dispose();
      (frame.material as THREE.Material).dispose();
    }
    this.lotoFrames.clear();
  }
}
