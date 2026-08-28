import { useEffect, useRef, useState, MutableRefObject } from 'react';
import * as THREE from 'three';
import { FieldConfigSource, GrafanaTheme2 } from '@grafana/data';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import { SimpleOptions, CameraMode, AlarmSeverity } from '../types';
import { CameraRig } from '../engine/CameraRig';
import { AlarmRenderer } from '../engine/AlarmRenderer';
import { TextureManager } from '../engine/TextureManager';
import { escapeHTML, formatTelemetryValue, TooltipFieldDef } from '../utils/formatUtils';
import { getStatusColor, getStatusLabel } from '../utils/statusUtils';

interface UseThreeSceneParams {
  options: SimpleOptions;
  width: number;
  height: number;
  fieldConfig: FieldConfigSource;
  theme: GrafanaTheme2;
  optionsRef: MutableRefObject<SimpleOptions>;
  onOptionsChangeRef: MutableRefObject<((options: SimpleOptions) => void) | undefined>;
  sqlColumnsRef: MutableRefObject<Map<string, Map<string, number>>>;
  statusRef: MutableRefObject<Map<string, number | undefined>>;
  severityRef: MutableRefObject<Map<string, AlarmSeverity>>;
  lotoRef: MutableRefObject<Map<string, boolean>>;
  labelsRef: MutableRefObject<Map<string, HTMLDivElement>>;
  tooltipFieldsParsed: TooltipFieldDef[];
  selectMachine: (name: string | null) => void;
  setHudMachine: (name: string | null) => void;
  placementMode?: string | null;
  placeMachineAt?: (x: number, z: number) => void;
  selectedGroup?: Set<string>;
  setGroupSelection?: (names: string[] | Set<string>) => void;
  toggleGroupSelection?: (name: string) => void;
  clearGroupSelection?: () => void;
  selectedMachine?: string | null;
  anchorMode?: 'A' | 'B' | null;
  onFloorClickedForAnchor?: (u: number, v: number) => void;
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
  placementMode,
  placeMachineAt,
  selectedGroup,
  setGroupSelection,
  toggleGroupSelection,
  clearGroupSelection,
  selectedMachine,
  anchorMode,
  onFloorClickedForAnchor,
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

  // Layout Feature Refs
  const placementModeRef = useRef(placementMode);
  const ghostMeshRef = useRef<THREE.Mesh | null>(null);
  const snapHighlightRef = useRef<THREE.Mesh | null>(null);
  const placeMachineAtRef = useRef(placeMachineAt);
  const anchorModeRef = useRef(anchorMode);
  const onFloorClickedForAnchorRef = useRef(onFloorClickedForAnchor);
  
  // Callback Refs to avoid stale closures
  const selectMachineRef = useRef(selectMachine);
  const setHudMachineRef = useRef(setHudMachine);
  const selectedGroupRef = useRef(selectedGroup);
  const setGroupSelectionRef = useRef(setGroupSelection);
  const toggleGroupSelectionRef = useRef(toggleGroupSelection);
  const clearGroupSelectionRef = useRef(clearGroupSelection);

  useEffect(() => {
    placementModeRef.current = placementMode;
    placeMachineAtRef.current = placeMachineAt;
    anchorModeRef.current = anchorMode;
    onFloorClickedForAnchorRef.current = onFloorClickedForAnchor;
    selectMachineRef.current = selectMachine;
    setHudMachineRef.current = setHudMachine;
    selectedGroupRef.current = selectedGroup;
    setGroupSelectionRef.current = setGroupSelection;
    toggleGroupSelectionRef.current = toggleGroupSelection;
    clearGroupSelectionRef.current = clearGroupSelection;
  }, [placementMode, placeMachineAt, anchorMode, onFloorClickedForAnchor, selectMachine, setHudMachine, selectedGroup, setGroupSelection, toggleGroupSelection, clearGroupSelection]);

  // Multi-select / Single-select Visual Emissive Highlight (Cyan Glow)
  useEffect(() => {
    for (const [name, mesh] of machinesRef.current.entries()) {
      const isSelected = (selectedGroup && selectedGroup.has(name)) || name === selectedMachine;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        if (isSelected) {
          mat.emissive.setHex(0x00e5ff);
          mat.emissiveIntensity = 0.6;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0.0;
        }
      }
    }
  }, [selectedGroup, selectedMachine, sceneReady]);

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

  // Sync preset from options ONLY when the dashboard author changes it
  const prevPresetRef = useRef<CameraMode | undefined>(options.cameraPreset);
  useEffect(() => {
    if (options.cameraPreset && options.cameraPreset !== prevPresetRef.current) {
      prevPresetRef.current = options.cameraPreset;
      setCamMode(options.cameraPreset);
      if (cameraRigRef.current && sceneReady) {
        cameraRigRef.current.setMode(options.cameraPreset, options.floorSize || 50);
      }
    }
  }, [options.cameraPreset, options.floorSize, sceneReady]);

  // Floorplan Texture
  useEffect(() => {
    if (textureManagerRef.current) {
      textureManagerRef.current.updateFloorplan(options.floorplanUrl);
    }
  }, [options.floorplanUrl, sceneReady]);

  // Grid & Snap Helper
  const rebuildGrid = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    
    if (gridHelperRef.current) {
      scene.remove(gridHelperRef.current);
      gridHelperRef.current.dispose();
      gridHelperRef.current = null;
    }
    
    if (options.enableEditMode && options.showSnapGrid !== false && options.enableSnap !== false) {
      const gs = Math.max(0.1, options.snapSize || 1);
      const fSize = Math.max(10, options.floorSize || 50);
      const aspect = floorAspectRef.current || 1;
      const gridSize = Math.max(fSize * aspect, fSize);
      const divisions = Math.min(Math.round(gridSize / gs), 400); // cap divisions to avoid lag
      const helper = new THREE.GridHelper(gridSize, divisions, 0x334155, 0x1e293b);
      helper.position.y = 0.01; 
      scene.add(helper);
      gridHelperRef.current = helper;
    }
  };

  useEffect(() => {
    rebuildGrid();
  }, [options.enableEditMode, options.showSnapGrid, options.enableSnap, options.snapSize, options.floorSize, sceneReady]);

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

  // Floor scale — preserve aspect ratio when floorSize changes
  const floorAspectRef = useRef<number>(1);
  useEffect(() => {
    if (floorMeshRef.current) {
      const fSize = Math.max(10, options.floorSize || 50);
      // BUG FIX (MEDIUM): Apply stored aspect ratio so resizing floorSize
      // doesn't destroy the texture aspect ratio correction
      floorMeshRef.current.scale.set(fSize * floorAspectRef.current, fSize, 1);
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

    // Feature 2: Placement Ghost Mesh
    const ghostMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x00ff87, transparent: true, opacity: 0.4, wireframe: false })
    );
    ghostMesh.visible = false;
    scene.add(ghostMesh);
    ghostMeshRef.current = ghostMesh;

    // Feature 4: Snap Highlight Mesh
    const snapHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x00ff87, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
    );
    snapHighlight.rotation.x = -Math.PI / 2;
    snapHighlight.position.y = 0.02;
    snapHighlight.visible = false;
    scene.add(snapHighlight);
    snapHighlightRef.current = snapHighlight;

    const textureManager = new TextureManager(floorMat, renderer);

    // BUG FIX (MEDIUM): Correct floor plane aspect ratio once bitmap is decoded.
    // Previously the floor was always a perfect square (fSize x fSize), which
    // warped rectangular floorplan images (e.g. 16:9). Now we rescale the X-axis
    // to match the image's true width/height ratio.
    textureManager.onAspectRatioReady = (aspect: number) => {
      floorAspectRef.current = aspect;
      if (floorMeshRef.current) {
        const fSize = Math.max(10, options.floorSize || 50);
        floorMeshRef.current.scale.set(fSize * aspect, fSize, 1);
      }
      rebuildGrid();
    };

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

    // 2D Marquee Drag Selection Overlay Box
    const marquee = document.createElement('div');
    marquee.style.cssText = `
      position: absolute; display: none; z-index: 80;
      border: 2px dashed #00e5ff; background: rgba(0, 229, 255, 0.18);
      pointer-events: none; border-radius: 4px; box-shadow: 0 0 12px rgba(0,229,255,0.3);
    `;
    mountRef.current.appendChild(marquee);

    let isMarquee = false;
    let marqueeStart = { x: 0, y: 0 };
    let dragStartOffsets = new Map<string, { x: number, z: number }>();
    let draggedStartPos = { x: 0, z: 0 };

    const dControls = new DragControls(meshesArrayRef.current, camera, renderer.domElement);
    dControls.enabled = false;
    dControls.addEventListener('dragstart', (ev) => {
      cameraRig.orbit.enabled = false;
      const mesh = ev.object;
      const name = mesh.userData.name;
      selectMachineRef.current(name);
      draggedStartPos = { x: mesh.position.x, z: mesh.position.z };
      dragStartOffsets.clear();

      if (selectedGroupRef.current && selectedGroupRef.current.has(name)) {
        for (const mName of selectedGroupRef.current) {
          const m = machinesRef.current.get(mName);
          if (m) {
            dragStartOffsets.set(mName, { x: m.position.x, z: m.position.z });
          }
        }
      }
    });

    dControls.addEventListener('drag', (ev) => {
      const mesh = ev.object;
      const name = mesh.userData.name;
      
      // Feature 4: Adjustable Snap-to-Grid
      const opts = optionsRef.current;
      if (opts.enableSnap !== false) {
        const snap = opts.snapSize || 1;
        mesh.position.x = Math.round(mesh.position.x / snap) * snap;
        mesh.position.z = Math.round(mesh.position.z / snap) * snap;
      }
      
      // Lock Y axis so it doesn't float or sink
      mesh.position.y = Math.abs(mesh.scale.y) / 2;

      // Synchronized Group Dragging
      if (dragStartOffsets.has(name)) {
        const dx = mesh.position.x - draggedStartPos.x;
        const dz = mesh.position.z - draggedStartPos.z;
        for (const [mName, startP] of dragStartOffsets.entries()) {
          if (mName === name) continue;
          const peerMesh = machinesRef.current.get(mName);
          if (peerMesh) {
            peerMesh.position.x = startP.x + dx;
            peerMesh.position.z = startP.z + dz;
          }
        }
      }
    });

    dControls.addEventListener('dragend', (ev) => {
      cameraRig.orbit.enabled = true;
      const mesh = ev.object;
      const name = mesh.userData.name;
      const opts = optionsRef.current;

      // Snap the final position before saving
      if (opts.enableSnap !== false) {
        const snap = opts.snapSize || 1;
        mesh.position.x = Math.round(mesh.position.x / snap) * snap;
        mesh.position.z = Math.round(mesh.position.z / snap) * snap;
      }

      const fn = onOptionsChangeRef.current;
      if (name && fn) {
        const newConfigs = { ...(opts.machineConfigs || {}) };
        if (dragStartOffsets.has(name)) {
          const dx = mesh.position.x - draggedStartPos.x;
          const dz = mesh.position.z - draggedStartPos.z;
          for (const [mName, startP] of dragStartOffsets.entries()) {
            const finalX = mName === name ? mesh.position.x : startP.x + dx;
            const finalZ = mName === name ? mesh.position.z : startP.z + dz;
            newConfigs[mName] = { ...newConfigs[mName], x: finalX, z: finalZ };
          }
          dragStartOffsets.clear();
        } else {
          newConfigs[name] = { ...newConfigs[name], x: mesh.position.x, z: mesh.position.z };
        }
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

      // Marquee Box Selection start in Edit Mode
      if (optionsRef.current.enableEditMode) {
        getMouseNDC(e);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(meshesArrayRef.current);
        if (hits.length === 0 || e.shiftKey) {
          isMarquee = true;
          marqueeStart = { x: e.clientX, y: e.clientY };
          cameraRig.orbit.enabled = false;
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;

      // Finish Marquee Drag Selection
      if (isMarquee) {
        isMarquee = false;
        marquee.style.display = 'none';
        cameraRig.orbit.enabled = true;

        const rect = renderer.domElement.getBoundingClientRect();
        const startX = marqueeStart.x - rect.left;
        const startY = marqueeStart.y - rect.top;
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);

        if (maxX - minX > 8 && maxY - minY > 8) {
          const selectedNames: string[] = [];
          const tempV = new THREE.Vector3();
          for (const [name, mesh] of machinesRef.current.entries()) {
            mesh.getWorldPosition(tempV);
            tempV.project(camera);
            const px = ((tempV.x + 1) / 2) * rect.width;
            const py = ((-tempV.y + 1) / 2) * rect.height;
            if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
              selectedNames.push(name);
            }
          }
          if (setGroupSelectionRef.current) {
            if (e.shiftKey && selectedGroupRef.current) {
              const union = new Set(selectedGroupRef.current);
              selectedNames.forEach(n => union.add(n));
              setGroupSelectionRef.current(union);
            } else {
              setGroupSelectionRef.current(selectedNames);
            }
          }
          return;
        }
      }

      const dx = Math.abs(e.clientX - pointerDownPos.x);
      const dy = Math.abs(e.clientY - pointerDownPos.y);
      const dt = Date.now() - pointerDownPos.time;

      if (dx < 6 && dy < 6 && dt < 450) {
        getMouseNDC(e);
        raycaster.setFromCamera(mouse, camera);

        // Feature 1: Anchor Mode Logic
        if (optionsRef.current.enableEditMode && anchorModeRef.current) {
          const floorHits = raycaster.intersectObject(floorMeshRef.current!);
          if (floorHits.length > 0) {
            const hit = floorHits[0];
            const imageU = hit.uv?.x ?? 0;
            const imageV = 1 - (hit.uv?.y ?? 0); // Three.js UV is bottom-up, invert to top-down
            if (onFloorClickedForAnchorRef.current) {
              onFloorClickedForAnchorRef.current(imageU, imageV);
            }
          }
          return;
        }

        // Feature 2: Placement Mode Logic
        if (optionsRef.current.enableEditMode && placementModeRef.current) {
          const floorHits = raycaster.intersectObject(floorMeshRef.current!);
          if (floorHits.length > 0) {
            const point = floorHits[0].point;
            let snappedX = point.x;
            let snappedZ = point.z;
            const snap = optionsRef.current.snapSize || 1;
            
            if (optionsRef.current.enableSnap !== false) {
              snappedX = Math.round(point.x / snap) * snap;
              snappedZ = Math.round(point.z / snap) * snap;
            }
            
            if (placeMachineAtRef.current) {
              placeMachineAtRef.current(snappedX, snappedZ);
            }
            
            if (ghostMeshRef.current) ghostMeshRef.current.visible = false;
            if (snapHighlightRef.current) snapHighlightRef.current.visible = false;
          }
          return; // Skip normal selection
        }

        const hits = raycaster.intersectObjects(meshesArrayRef.current);

        if (hits.length > 0) {
          const hitMesh = hits[0].object as THREE.Mesh;
          const name = hitMesh.userData.name as string;

          if (!optionsRef.current.enableEditMode) {
            if (optionsRef.current.showHUD !== false) {
              setHudMachineRef.current(name);
            }
            cameraRig.focusOn(hitMesh.position, Math.max(hitMesh.scale.x, hitMesh.scale.z) * 3 + 5);

            if (!optionsRef.current.showHUD && optionsRef.current.dashboardUrlTemplate) {
              const url = optionsRef.current.dashboardUrlTemplate.replace(/\${name}/g, encodeURIComponent(name));
              window.open(url, '_blank', 'noopener');
            }
          } else {
            // Edit Mode Selection
            if (e.shiftKey) {
              if (toggleGroupSelectionRef.current) toggleGroupSelectionRef.current(name);
            } else {
              if (clearGroupSelectionRef.current) clearGroupSelectionRef.current();
              selectMachineRef.current(name);
            }
          }
        } else {
          if (!optionsRef.current.enableEditMode) {
            setHudMachineRef.current(null);
          } else {
            if (!e.shiftKey && clearGroupSelectionRef.current) clearGroupSelectionRef.current();
            selectMachineRef.current(null);
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // PERF FIX (CRITICAL): Throttle raycaster to max ~30fps (33ms).
    // Without throttle, every single mousemove event triggers a full raycast
    // against all meshes — catastrophic on scenes with 100+ machines.
    let lastMouseMoveTime = 0;
    const onMouseMove = (event: MouseEvent) => {
      const now = performance.now();
      if (now - lastMouseMoveTime < 33) { return; } // ~30fps throttle
      lastMouseMoveTime = now;

      getMouseNDC(event);
      raycaster.setFromCamera(mouse, camera);

      // Feature 2 & 4: Placement Ghost and Snap Highlight
      if (optionsRef.current.enableEditMode) {
        const floorHits = raycaster.intersectObject(floorMeshRef.current!);
        if (floorHits.length > 0) {
          const point = floorHits[0].point;
          const opts = optionsRef.current;
          const snap = opts.snapSize || 1;
          let snappedX = point.x;
          let snappedZ = point.z;
          
          if (opts.enableSnap !== false) {
            snappedX = Math.round(point.x / snap) * snap;
            snappedZ = Math.round(point.z / snap) * snap;
          }

          // Update Snap Highlight
          if (snapHighlightRef.current) {
            snapHighlightRef.current.scale.set(snap, snap, 1);
            snapHighlightRef.current.position.set(snappedX, 0.02, snappedZ);
            snapHighlightRef.current.visible = opts.enableSnap !== false;
          }

          // Update Ghost Mesh
          if (placementModeRef.current && ghostMeshRef.current) {
            ghostMeshRef.current.visible = true;
            ghostMeshRef.current.scale.set(opts.boxWidth || 2, opts.boxHeight || 1, opts.boxDepth || 2);
            ghostMeshRef.current.position.set(snappedX, (opts.boxHeight || 1) / 2, snappedZ);
          } else if (ghostMeshRef.current) {
            ghostMeshRef.current.visible = false;
          }
        }
      } else {
        if (snapHighlightRef.current) snapHighlightRef.current.visible = false;
        if (ghostMeshRef.current) ghostMeshRef.current.visible = false;
      }

      if (optionsRef.current.enableTooltip === false) {
        tooltip.style.display = 'none';
        return;
      }

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
        if (tx + 290 > rect.width) { tx = event.clientX - rect.left - 295; }
        if (ty + 180 > rect.height) { ty = event.clientY - rect.top - 185; }

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
      if (marquee.parentNode) marquee.parentNode.removeChild(marquee);

      // Dispose all machine meshes
      for (const mesh of machinesRef.current.values()) {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
      machinesRef.current.clear();
      meshesArrayRef.current.length = 0;

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
