import { useEffect, useRef, useState, MutableRefObject } from 'react';
import * as THREE from 'three';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import { SimpleOptions, CameraMode } from '../types';
import { CameraRig } from '../engine/CameraRig';
import { AlarmRenderer } from '../engine/AlarmRenderer';
import { TextureManager } from '../engine/TextureManager';
import { escapeHTML, formatTelemetryValue, TooltipFieldDef } from '../utils/formatUtils';
import { getStatusColor, getStatusLabel } from '../utils/statusUtils';

interface UseThreeSceneParams {
  options: SimpleOptions;
  width: number;
  height: number;
  fieldConfig: any;
  theme: any;
  optionsRef: MutableRefObject<SimpleOptions>;
  onOptionsChangeRef: MutableRefObject<((options: SimpleOptions) => void) | undefined>;
  sqlColumnsRef: MutableRefObject<Map<string, Map<string, number>>>;
  statusRef: MutableRefObject<Map<string, number | undefined>>;
  severityRef: MutableRefObject<Map<string, any>>;
  lotoRef: MutableRefObject<Map<string, boolean>>;
  labelsRef: MutableRefObject<Map<string, HTMLDivElement>>;
  tooltipFieldsParsed: TooltipFieldDef[];
  selectMachine: (name: string | null) => void;
  setHudMachine: (name: string | null) => void;
}

export function useThreeScene({
  options,
  width,
  height,
  fieldConfig,
  theme,
  optionsRef,
  onOptionsChangeRef,
  sqlColumnsRef,
  statusRef,
  severityRef,
  lotoRef,
  labelsRef,
  tooltipFieldsParsed,
  selectMachine,
  setHudMachine,
}: UseThreeSceneParams) {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsContainerRef = useRef<HTMLDivElement>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [camMode, setCamMode] = useState<CameraMode>(options.cameraPreset || 'perspective');

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cameraRigRef = useRef<CameraRig | null>(null);
  const alarmRendererRef = useRef<AlarmRenderer | null>(null);
  const textureManagerRef = useRef<TextureManager | null>(null);

  const meshesArrayRef = useRef<THREE.Mesh[]>([]);
  const machinesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const dControlsRef = useRef<DragControls | null>(null);
  const lastDragEnd = useRef(0);

  const fieldConfigRef = useRef(fieldConfig);
  const themeRef = useRef(theme);
  const widthRef = useRef(width);
  const heightRef = useRef(height);

  useEffect(() => {
    fieldConfigRef.current = fieldConfig;
    themeRef.current = theme;
    widthRef.current = width;
    heightRef.current = height;
  });

  // Switch camera mode
  const handleSwitchCamMode = (newMode: CameraMode) => {
    setCamMode(newMode);
    if (cameraRigRef.current) {
      cameraRigRef.current.setMode(newMode, options.floorSize || 50);
    }
  };

  const handleResetCamera = () => {
    if (cameraRigRef.current) {
      cameraRigRef.current.resetView(options.floorSize || 50);
    }
  };

  // Sync preset from options
  useEffect(() => {
    if (options.cameraPreset && options.cameraPreset !== camMode) {
      setCamMode(options.cameraPreset);
      if (cameraRigRef.current && sceneReady) {
        cameraRigRef.current.setMode(options.cameraPreset, options.floorSize || 50);
      }
    }
  }, [options.cameraPreset, options.floorSize, sceneReady, camMode]);

  // Floorplan Texture
  useEffect(() => {
    if (textureManagerRef.current) {
      textureManagerRef.current.updateFloorplan(options.floorplanUrl);
    }
  }, [options.floorplanUrl, sceneReady]);

  // Grid
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (gridHelperRef.current) {
      scene.remove(gridHelperRef.current);
      gridHelperRef.current = null;
    }
    if (options.enableGrid) {
      const gs = Math.max(0.1, options.gridSize || 1);
      const fSize = Math.max(10, options.floorSize || 50);
      const divisions = Math.round(fSize / gs);
      const helper = new THREE.GridHelper(fSize, divisions, 0x3a3a4a, 0x2a2a3a);
      helper.position.y = 0.01;
      scene.add(helper);
      gridHelperRef.current = helper;
    }
  }, [options.enableGrid, options.gridSize, options.floorSize, sceneReady]);

  // Edit Mode DragControls
  useEffect(() => {
    if (dControlsRef.current) {
      dControlsRef.current.enabled = options.enableEditMode;
    }
  }, [options.enableEditMode]);

  // Resize
  useEffect(() => {
    if (cameraRef.current && rendererRef.current) {
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    }
  }, [width, height]);

  // Floor scale
  useEffect(() => {
    if (floorMeshRef.current) {
      const fSize = Math.max(10, options.floorSize || 50);
      floorMeshRef.current.scale.set(fSize, fSize, 1);
    }
  }, [options.floorSize, sceneReady]);

  // ─── Initialize Three.js WebGL Scene ──────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111116);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setWebglError('ไม่สามารถเปิดใช้งาน WebGL 3D ได้');
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    let isContextLost = false;
    let animId: number;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      isContextLost = true;
      console.warn('[IMS 3D Panel] WebGL Context Lost! Pausing render loop gracefully...');
      if (animId) cancelAnimationFrame(animId);
    };

    const onContextRestored = () => {
      console.info('[IMS 3D Panel] WebGL Context Restored! Re-initializing textures & state...');
      isContextLost = false;
      if (textureManagerRef.current) {
        textureManagerRef.current.restoreContext();
        textureManagerRef.current.updateFloorplan(optionsRef.current.floorplanUrl);
      }
      lastTime = performance.now();
      animate();
    };

    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

    const cameraRig = new CameraRig(camera, renderer.domElement);
    cameraRig.setMode(options.cameraPreset || 'perspective', options.floorSize || 50);
    cameraRigRef.current = cameraRig;

    const alarmRenderer = new AlarmRenderer(scene);
    alarmRendererRef.current = alarmRenderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(12, 24, 12);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const floorGeo = new THREE.PlaneGeometry(1, 1);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x222224 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    floorMeshRef.current = floor;

    const textureManager = new TextureManager(floorMat, renderer);
    textureManager.updateFloorplan(options.floorplanUrl);
    textureManagerRef.current = textureManager;

    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position: absolute; display: none; z-index: 100;
      background: rgba(10,12,20,0.96); color: #eee;
      padding: 12px 16px; border-radius: 10px;
      font-size: 12px; font-family: monospace;
      pointer-events: none; border: 1px solid rgba(255,255,255,0.18);
      backdrop-filter: blur(8px); box-shadow: 0 6px 28px rgba(0,0,0,0.8);
      min-width: 180px; max-width: 280px; line-height: 1.8;
    `;
    mountRef.current.appendChild(tooltip);

    const dControls = new DragControls(meshesArrayRef.current, camera, renderer.domElement);
    dControls.enabled = false;
    dControls.addEventListener('dragstart', (ev) => {
      cameraRig.orbit.enabled = false;
      selectMachine(ev.object.userData.name);
    });
    dControls.addEventListener('drag', (ev) => {
      const mesh = ev.object;
      mesh.position.y = Math.abs(mesh.scale.y) / 2;
      if (optionsRef.current.enableSnap && optionsRef.current.gridSize) {
        const s = optionsRef.current.gridSize;
        mesh.position.x = Math.round(mesh.position.x / s) * s;
        mesh.position.z = Math.round(mesh.position.z / s) * s;
      }
    });
    dControls.addEventListener('dragend', (ev) => {
      cameraRig.orbit.enabled = true;
      lastDragEnd.current = Date.now();
      const mesh = ev.object;
      const name = mesh.userData.name;
      const fn = onOptionsChangeRef.current;
      const opts = optionsRef.current;
      if (name && fn) {
        const newConfigs = { ...(opts.machineConfigs || {}) };
        newConfigs[name] = { ...newConfigs[name], x: mesh.position.x, z: mesh.position.z };
        fn({ ...opts, machineConfigs: newConfigs });
      }
    });
    dControlsRef.current = dControls;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0, time: 0 };

    const getMouseNDC = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY, time: Date.now() };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (Date.now() - lastDragEnd.current < 150) return;

      const dx = Math.abs(e.clientX - pointerDownPos.x);
      const dy = Math.abs(e.clientY - pointerDownPos.y);
      const dt = Date.now() - pointerDownPos.time;

      if (dx < 6 && dy < 6 && dt < 450) {
        getMouseNDC(e);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(meshesArrayRef.current);

        if (hits.length > 0) {
          const hitMesh = hits[0].object as THREE.Mesh;
          const name = hitMesh.userData.name as string;

          if (!optionsRef.current.enableEditMode) {
            if (optionsRef.current.showHUD !== false) {
              setHudMachine(name);
            }
            cameraRig.focusOn(hitMesh.position, Math.max(hitMesh.scale.x, hitMesh.scale.z) * 3 + 5);

            if (!optionsRef.current.showHUD && optionsRef.current.dashboardUrlTemplate) {
              const url = optionsRef.current.dashboardUrlTemplate.replace(/\${name}/g, encodeURIComponent(name));
              window.open(url, '_blank', 'noopener');
            }
          } else {
            selectMachine(name);
          }
        } else {
          if (!optionsRef.current.enableEditMode) setHudMachine(null);
          else selectMachine(null);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onMouseMove = (event: MouseEvent) => {
      if (optionsRef.current.enableTooltip === false) {
        tooltip.style.display = 'none';
        return;
      }
      getMouseNDC(event);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshesArrayRef.current);

      if (hits.length > 0) {
        const mesh = hits[0].object as THREE.Mesh;
        const name = mesh.userData.name as string;
        const status = statusRef.current.get(name);
        const severity = severityRef.current.get(name) ?? 'None';
        const isLOTO = lotoRef.current.get(name) ?? false;
        const color = getStatusColor(status, fieldConfigRef.current, themeRef.current);
        const machineSQL = sqlColumnsRef.current.get(name) || new Map<string, number>();

        let extraHtml = '';
        for (const f of tooltipFieldsParsed) {
          const val = machineSQL.get(f.column);
          if (val !== undefined) {
            extraHtml += `
              <div style="display:flex;justify-content:space-between;gap:18px;padding:2px 0">
                <span style="color:#94a3b8">${escapeHTML(f.label)}</span>
                <span style="color:#fff;font-weight:600">${formatTelemetryValue(val)}${f.unit ? ' ' + escapeHTML(f.unit) : ''}</span>
              </div>`;
          }
        }

        const rect = renderer.domElement.getBoundingClientRect();
        let tx = event.clientX - rect.left + 18;
        let ty = event.clientY - rect.top + 18;
        if (tx + 290 > rect.width) tx = event.clientX - rect.left - 295;
        if (ty + 180 > rect.height) ty = event.clientY - rect.top - 185;

        tooltip.innerHTML = `
          <div style="font-size:14px;font-weight:800;color:#fff;border-bottom:1px solid rgba(255,255,255,0.14);padding-bottom:6px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
            <span>${escapeHTML(name)}</span>
            ${isLOTO ? '<span style="color:#38bdf8;font-size:10px;font-weight:bold">🔒 LOTO</span>' : ''}
            ${severity === 'Critical' ? '<span style="color:#ef4444;font-size:10px;font-weight:bold">▲ CRITICAL</span>' : ''}
          </div>
          <div style="display:flex;justify-content:space-between;gap:18px;padding:2px 0">
            <span style="color:#94a3b8">Status</span>
            <span style="color:${color};font-weight:700">${escapeHTML(getStatusLabel(status))}</span>
          </div>
          ${extraHtml}
          <div style="margin-top:8px;font-size:10px;color:#64748b;border-top:1px solid rgba(255,255,255,0.08);padding-top:6px">คลิกเพื่อดูรายละเอียดเชิงลึก</div>
        `;
        tooltip.style.left = `${tx}px`;
        tooltip.style.top = `${ty}px`;
        tooltip.style.display = 'block';
      } else {
        tooltip.style.display = 'none';
      }
    };
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    let lastTime = performance.now();
    const tempV = new THREE.Vector3();

    const animate = () => {
      if (isContextLost) return;
      animId = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      const time = now * 0.005;
      const w = widthRef.current;
      const h = heightRef.current;
      const fSize = optionsRef.current.floorSize || 50;

      cameraRig.update(delta, fSize);
      alarmRenderer.animate(time);

      for (const [name, mesh] of machinesRef.current.entries()) {
        const status = statusRef.current.get(name);
        const mat = mesh.material as THREE.MeshStandardMaterial;

        if (status === 3) {
          mat.emissive.setHex(0xef4444);
          mat.emissiveIntensity = Math.abs(Math.sin(time * 3)) * 0.8;
        } else if (status === 1) {
          mat.emissive.setHex(0xf59e0b);
          mat.emissiveIntensity = Math.abs(Math.sin(time * 0.8)) * 0.25;
        } else if (status === 4) {
          mat.emissive.setHex(0x0284c7);
          mat.emissiveIntensity = 0.4;
        } else {
          mat.emissiveIntensity = 0;
        }

        const label = labelsRef.current.get(name);
        if (label && optionsRef.current.showLabels !== false) {
          tempV.copy(mesh.position);
          tempV.y += Math.abs(mesh.scale.y) / 2 + 0.6;
          tempV.project(camera);

          if (tempV.z > 1) {
            label.style.opacity = '0';
          } else {
            label.style.opacity = '1';
            label.style.transform = `translate3d(${(tempV.x * 0.5 + 0.5) * w}px, ${(tempV.y * -0.5 + 0.5) * h}px, 0) translate(-50%, -50%)`;
          }
        }
      }

      renderer.render(scene, camera);
    };
    animate();
    setSceneReady(true);

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      cameraRig.dispose();
      alarmRenderer.dispose();
      textureManager.dispose();
      dControls.dispose();

      if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);

      renderer.forceContextLoss();
      renderer.dispose();
      scene.clear();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    mountRef,
    labelsContainerRef,
    sceneRef,
    sceneReady,
    camMode,
    webglError,
    machinesRef,
    meshesArrayRef,
    alarmRendererRef,
    handleSwitchCamMode,
    handleResetCamera,
  };
}
