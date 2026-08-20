import React, { useEffect, useRef, useState } from 'react';
import { PanelProps } from '@grafana/data';
import { SimpleOptions, MachineLayoutConfig } from 'types';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import defaultFloorplanUrl from '../img/layout.jpg';

interface Props extends PanelProps<SimpleOptions> {}

const getStyles = () => ({
  wrapper: css`
    position: relative;
    overflow: hidden;
    font-family: 'Inter', sans-serif;
  `,
  modeBadge: css`
    position: absolute;
    top: 15px;
    right: 15px;
    z-index: 20;
    background: rgba(255, 170, 0, 0.9);
    color: #000;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    pointer-events: none;
  `,
  iconBtn: css`
    background: #333;
    border: 1px solid #555;
    color: white;
    border-radius: 4px;
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    &:hover { background: #444; }
    &:active { background: #222; }
  `,
  addBtn: css`
    background: #0072d3;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    transition: background 0.2s;
    &:hover { background: #005fba; }
  `,
  deleteBtn: css`
    width: 100%;
    margin-top: 16px;
    background: #e63946;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
    &:hover { background: #ff4d5a; }
  `,
});

// ─── Status helpers ────────────────────────────────────────────────────────────
function getStatusColor(status: number | undefined, opts: SimpleOptions): string {
  if (status === undefined || status === null || isNaN(Number(status))) {
    return opts.colorOff || '#1a1a2e';
  }
  if (status === 0) { return opts.colorAlarm      || '#ff2222'; }
  if (status === 1) { return opts.colorRunning     || '#00cc44'; }
  if (status === 2) { return opts.colorProduction  || '#ffaa00'; }
  return opts.colorOff || '#1a1a2e';
}

function getStatusLabel(status: number | undefined): string {
  if (status === undefined || status === null || isNaN(Number(status))) { return '⚫ Off / No Data'; }
  if (status === 0) { return '🔴 Alarm'; }
  if (status === 1) { return '🟢 Running'; }
  if (status === 2) { return '🟡 In Production'; }
  return '⚫ Off / No Data';
}

function parseTooltipFields(str: string): Array<{ column: string; label: string; unit: string }> {
  if (!str?.trim()) { return []; }
  return str.split(',').map(part => {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) { return null; }
    const column = trimmed.slice(0, eqIdx).trim();
    const rest = trimmed.slice(eqIdx + 1).trim();
    const colonIdx = rest.indexOf(':');
    const label = colonIdx === -1 ? rest : rest.slice(0, colonIdx).trim();
    const unit  = colonIdx === -1 ? '' : rest.slice(colonIdx + 1).trim();
    return { column, label, unit };
  }).filter(Boolean) as Array<{ column: string; label: string; unit: string }>;
}

export const SimplePanel: React.FC<Props> = ({ options, data, width, height, onOptionsChange }) => {
  const styles = useStyles2(getStyles);

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const mountRef           = useRef<HTMLDivElement>(null);
  const labelsContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef         = useRef<HTMLDivElement | null>(null);

  // ── React state ───────────────────────────────────────────────────────────
  const [webglError, setWebglError] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [newMachineName, setNewMachineName] = useState('');

  // ── Three.js refs ─────────────────────────────────────────────────────────
  const sceneRef       = useRef<THREE.Scene | null>(null);
  const rendererRef    = useRef<WebGLRenderer | null>(null);
  const cameraRef      = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitRef       = useRef<OrbitControls | null>(null);
  const dControlsRef   = useRef<DragControls | null>(null);
  const meshesArrayRef = useRef<THREE.Mesh[]>([]);
  const floorMatRef    = useRef<THREE.MeshStandardMaterial | null>(null);
  const gridHelperRef  = useRef<THREE.GridHelper | null>(null);

  // ── Data refs ─────────────────────────────────────────────────────────────
  const machinesRef    = useRef<Map<string, THREE.Mesh>>(new Map());
  const statusRef      = useRef<Map<string, number | undefined>>(new Map());
  const sqlColumnsRef  = useRef<Map<string, Map<string, number>>>(new Map());
  const labelsRef      = useRef<Map<string, HTMLDivElement>>(new Map());

  // ── Stable refs for callbacks ─────────────────────────────────────────────
  const lastDragEnd        = useRef(0);
  const optionsRef         = useRef(options);
  const onOptionsChangeRef = useRef(onOptionsChange);
  const widthRef           = useRef(width);
  const heightRef          = useRef(height);
  
  useEffect(() => {
    optionsRef.current         = options;
    onOptionsChangeRef.current = onOptionsChange;
    widthRef.current           = width;
    heightRef.current          = height;
  });

  // ─── Effect: Camera Preset ─────────────────────────────────────────────────
  useEffect(() => {
    const cam = cameraRef.current;
    const orbit = orbitRef.current;
    if (!cam || !orbit || !sceneReady) { return; }

    if (options.cameraPreset === 'top') {
      cam.position.set(0, 45, 0.001);
      cam.lookAt(0, 0, 0);
      orbit.target.set(0, 0, 0);
    } else {
      cam.position.set(0, 18, 22);
      cam.lookAt(0, 0, 0);
      orbit.target.set(0, 0, 0);
    }
    orbit.update();
  }, [options.cameraPreset, sceneReady]);

  // ─── Effect: Grid Lines ────────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) { return; }
    if (gridHelperRef.current) {
      scene.remove(gridHelperRef.current);
      gridHelperRef.current = null;
    }
    if (options.enableGrid) {
      const gs = Math.max(0.1, options.gridSize || 1);
      const divisions = Math.round(50 / gs);
      const helper = new THREE.GridHelper(50, divisions, 0x3a3a4a, 0x2a2a3a);
      helper.position.y = 0.01;
      scene.add(helper);
      gridHelperRef.current = helper;
    }
  }, [options.enableGrid, options.gridSize, sceneReady]);

  // ─── Effect: Mode Switches (Edit Mode Toggle) ──────────────────────────────
  useEffect(() => {
    if (dControlsRef.current) {
      dControlsRef.current.enabled = options.enableEditMode;
    }
    // Clear selection if we lock
    if (!options.enableEditMode) {
      setSelectedMachine(null);
    }
  }, [options.enableEditMode]);

  // ─── Effect: Auto-Discovery & Data Sync ────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) { return; }
    const opts = optionsRef.current;
    
    // 1. Parse SQL
    const freshSQL = new Map<string, Map<string, number>>();
    const stringFields = data.series.flatMap(s => s.fields.filter(f => f.type === 'string'));
    const numberFields = data.series.flatMap(s => s.fields.filter(f => f.type === 'number'));

    if (stringFields.length >= 1 && numberFields.length >= 1) {
      const nameField = stringFields[0];
      for (let i = 0; i < nameField.values.length; i++) {
        const mName = String(nameField.values[i]);
        if (!mName) continue;
        if (!freshSQL.has(mName)) { freshSQL.set(mName, new Map()); }
        for (const nf of numberFields) {
          const v = nf.values[i];
          if (v != null) { freshSQL.get(mName)!.set(nf.name, Number(v)); }
        }
      }
    } else {
      for (const nf of numberFields) {
        if (!nf.name) continue;
        const vals = nf.values;
        if (vals.length > 0) {
          const m = new Map<string, number>();
          m.set('value', Number(vals[vals.length - 1]));
          freshSQL.set(nf.name, m);
        }
      }
    }
    sqlColumnsRef.current = freshSQL;

    // 2. Auto-Discovery Logic
    const configs = opts.machineConfigs || {};
    let newConfigs: Record<string, MachineLayoutConfig> | null = null;
    let autoPlacementCount = Object.keys(configs).length;

    for (const mName of freshSQL.keys()) {
      if (!configs[mName]) {
        if (!newConfigs) newConfigs = { ...configs };
        const col = autoPlacementCount % 10;
        const row = Math.floor(autoPlacementCount / 10);
        newConfigs[mName] = {
          x: col * 3,
          z: row * 3,
          scaleX: opts.boxWidth || 2,
          scaleY: opts.boxHeight || 1,
          scaleZ: opts.boxDepth || 2,
          rotationY: 0
        };
        autoPlacementCount++;
      }
    }

    if (newConfigs && onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
      return;
    }

    // 3. Render Meshes
    const currentConfigNames = Object.keys(configs);
    for (const name of currentConfigNames) {
      if (!machinesRef.current.has(name)) {
        const cfg = configs[name];
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.2 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(cfg.x, cfg.scaleY / 2, cfg.z);
        mesh.scale.set(cfg.scaleX, cfg.scaleY, cfg.scaleZ);
        mesh.rotation.y = cfg.rotationY || 0;
        mesh.userData = { name };
        scene.add(mesh);
        machinesRef.current.set(name, mesh);

        const label = document.createElement('div');
        label.style.cssText = `
          position: absolute; color: white; background: rgba(0,0,0,0.8);
          padding: 4px 9px; border-radius: 5px; font-size: 11px;
          font-family: monospace; pointer-events: none;
          border: 1px solid rgba(255,255,255,0.15); white-space: nowrap;
          transform: translate(-50%, -50%); backdrop-filter: blur(3px);
          transition: opacity 0.2s;
        `;
        labelsContainerRef.current?.appendChild(label);
        labelsRef.current.set(name, label);
      } else {
        // Sync scaling and rotation from config instantly in case user adjusts via UI Panel
        const mesh = machinesRef.current.get(name)!;
        const cfg = configs[name];
        mesh.scale.set(cfg.scaleX, cfg.scaleY, cfg.scaleZ);
        mesh.position.y = Math.abs(cfg.scaleY) / 2;
        mesh.rotation.y = cfg.rotationY || 0;
      }
    }

    for (const [name, mesh] of machinesRef.current.entries()) {
      if (!currentConfigNames.includes(name) || configs[name]?.hidden) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.MeshStandardMaterial).dispose();
        const label = labelsRef.current.get(name);
        if (label?.parentNode) { label.parentNode.removeChild(label); }
        machinesRef.current.delete(name);
        labelsRef.current.delete(name);
        statusRef.current.delete(name);
      }
    }

    for (const [name, mesh] of machinesRef.current.entries()) {
      const machineSQL = freshSQL.get(name);
      const status = machineSQL?.get('value') ?? machineSQL?.get('status');
      statusRef.current.set(name, status);

      const hexColor = getStatusColor(status, opts);
      (mesh.material as THREE.MeshStandardMaterial).color.set(hexColor);

      const label = labelsRef.current.get(name);
      if (label) {
        label.innerHTML = `
          <b style="color:#eee">${name}</b>
          <br/><span style="color:${hexColor};font-size:10px">${getStatusLabel(status)}</span>
        `;
      }
    }

    // Refresh controls arrays by mutating in place so DragControls reference stays intact
    meshesArrayRef.current.length = 0;
    meshesArrayRef.current.push(...Array.from(machinesRef.current.values()));

  }, [data, sceneReady, options.machineConfigs]);


  // ─── Effect: Init Scene (runs once) ───────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) { return; }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 18, 22);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setWebglError('ไม่สามารถเปิดใช้งาน 3D (WebGL) ได้');
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer as any;

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbitRef.current = orbit;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    scene.add(dirLight);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    floorMatRef.current = floorMat;
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position: absolute; display: none; z-index: 100;
      background: rgba(8,8,20,0.96); color: #eee;
      padding: 12px 16px; border-radius: 10px;
      font-size: 12px; font-family: monospace;
      pointer-events: none; border: 1px solid rgba(255,255,255,0.15);
      backdrop-filter: blur(8px); box-shadow: 0 6px 28px rgba(0,0,0,0.8);
      min-width: 180px; max-width: 280px; line-height: 1.8;
    `;
    mountRef.current.appendChild(tooltip);
    tooltipRef.current = tooltip;

    // ─── DragControls (For Move Mode) ──────────────────────────────────
    const dControls = new DragControls(meshesArrayRef.current, camera, renderer.domElement);
    dControls.enabled = false;
    
    dControls.addEventListener('dragstart', (ev) => { 
      orbit.enabled = false; 
      setSelectedMachine(ev.object.userData.name); // Select on drag start
    });
    
    dControls.addEventListener('drag', (ev) => {
      const mesh = ev.object;
      mesh.position.y = Math.abs(mesh.scale.y) / 2; // Lock to floor
      // Grid Snap Logic
      if (optionsRef.current.enableSnap && optionsRef.current.gridSize) {
        const s = optionsRef.current.gridSize;
        mesh.position.x = Math.round(mesh.position.x / s) * s;
        mesh.position.z = Math.round(mesh.position.z / s) * s;
      }
    });

    dControls.addEventListener('dragend', (ev) => { 
      orbit.enabled = true;
      lastDragEnd.current = Date.now();
      const mesh = ev.object;
      const name = mesh.userData.name;
      const fn = onOptionsChangeRef.current;
      const opts = optionsRef.current;
      if (name && fn) {
        const newConfigs = { ...(opts.machineConfigs || {}) };
        newConfigs[name] = {
          ...newConfigs[name],
          x: mesh.position.x,
          z: mesh.position.z,
        };
        fn({ ...opts, machineConfigs: newConfigs });
      }
    });
    
    dControlsRef.current = dControls;


    // ─── Raycaster ────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const getMouseNDC = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (event: PointerEvent) => {
      event.stopPropagation(); // Prevents Grafana from dragging the dashboard panel
      if (event.button !== 0) return; // Only accept left click
      if (Date.now() - lastDragEnd.current < 150) return; // Ignore click that fires after drag release
      
      const opts = optionsRef.current;
      getMouseNDC(event);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshesArrayRef.current);
      const hitMesh = hits.length > 0 ? (hits[0].object as THREE.Mesh) : null;

      if (!opts.enableEditMode) {
        setSelectedMachine(null);
        const urlTemplate = opts.dashboardUrlTemplate?.trim();
        if (urlTemplate && hitMesh) {
          const name = hitMesh.userData.name as string;
          const url = urlTemplate.replace(/\$\{name\}/g, encodeURIComponent(name));
          window.open(url, '_blank', 'noopener');
        }
      } else {
        // We are in Edit Mode
        if (hitMesh) {
          setSelectedMachine(hitMesh.userData.name);
        } else {
          setSelectedMachine(null);
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    const onMouseMove = (event: MouseEvent) => {
      if (!optionsRef.current.enableTooltip) {
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
        const color = getStatusColor(status, optionsRef.current);
        const machineSQL = sqlColumnsRef.current.get(name) || new Map<string, number>();

        const extraFields = parseTooltipFields(optionsRef.current.tooltipFields || '');
        let extraHtml = '';
        for (const f of extraFields) {
          const val = machineSQL.get(f.column);
          if (val !== undefined) {
            extraHtml += `
              <div style="display:flex;justify-content:space-between;gap:20px;padding:2px 0">
                <span style="color:#999">${f.label}</span>
                <span style="color:#fff;font-weight:600">${val}${f.unit ? ' ' + f.unit : ''}</span>
              </div>`;
          }
        }

        const rect = renderer.domElement.getBoundingClientRect();
        let tx = event.clientX - rect.left + 18;
        let ty = event.clientY - rect.top + 18;
        if (tx + 290 > rect.width) { tx = event.clientX - rect.left - 295; }
        if (ty + 180 > rect.height) { ty = event.clientY - rect.top - 185; }

        tooltip.innerHTML = `
          <div style="font-size:14px;font-weight:700;color:#fff;
            border-bottom:1px solid rgba(255,255,255,0.12);
            padding-bottom:7px;margin-bottom:8px">${name}</div>
          <div style="display:flex;justify-content:space-between;gap:20px;padding:2px 0">
            <span style="color:#999">สถานะ</span>
            <span style="color:${color};font-weight:700">${getStatusLabel(status)}</span>
          </div>
          ${extraHtml}
          <div style="margin-top:8px;font-size:10px;color:#555;border-top:1px solid rgba(255,255,255,0.07);padding-top:6px">
            คลิกเพื่อดูรายละเอียด
          </div>
        `;
        tooltip.style.left = `${tx}px`;
        tooltip.style.top = `${ty}px`;
        tooltip.style.display = 'block';
      } else {
        tooltip.style.display = 'none';
      }
    };
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    // ── Animation Loop ────────────────────────────────────────────────────────
    let animId: number;
    const tempV = new THREE.Vector3();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      orbit.update();

      const time = Date.now() * 0.005;
      const w = widthRef.current;
      const h = heightRef.current;

      for (const [name, mesh] of machinesRef.current.entries()) {
        const status = statusRef.current.get(name);
        const mat = mesh.material as THREE.MeshStandardMaterial;

        // Visual FX for alarm and production
        if (status === 0) {
          mat.emissive.setHex(0xff0000);
          mat.emissiveIntensity = Math.abs(Math.sin(time)) * 0.9;
        } else if (status === 2) {
          mat.emissive.setHex(0xff8800);
          mat.emissiveIntensity = Math.abs(Math.sin(time * 0.4)) * 0.2;
        } else {
          mat.emissiveIntensity = 0;
        }

        const label = labelsRef.current.get(name);
        if (label) {
          tempV.copy(mesh.position);
          tempV.y += Math.abs(mesh.scale.y) / 2 + 0.5; // Always above the box
          tempV.project(camera);

          if (tempV.z > 1) {
            label.style.opacity = '0';
          } else {
            label.style.opacity = '1';
            label.style.left = `${(tempV.x * 0.5 + 0.5) * w}px`;
            label.style.top = `${(tempV.y * -0.5 + 0.5) * h}px`;
          }
        }
      }

      renderer.render(scene, camera);
    };
    animate();
    setSceneReady(true);

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      if (mountRef.current && renderer.domElement.parentNode) {
        mountRef.current.removeChild(renderer.domElement);
      }
      if (tooltip.parentNode) { tooltip.parentNode.removeChild(tooltip); }
      dControls.dispose();
      orbit.dispose();
      (renderer as THREE.WebGLRenderer).dispose();
      scene.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Resize ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (cameraRef.current && rendererRef.current) {
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      (rendererRef.current as THREE.WebGLRenderer).setSize(width, height);
    }
  }, [width, height]);

  // ─── Floorplan Texture ────────────────────────────────────────────────────
  useEffect(() => {
    if (!floorMatRef.current) { return; }
    const urlToLoad = options.floorplanUrl?.trim() || defaultFloorplanUrl;
    new THREE.TextureLoader().load(urlToLoad, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      floorMatRef.current!.map = tex;
      floorMatRef.current!.color.setHex(0xffffff);
      floorMatRef.current!.needsUpdate = true;
    });
  }, [options.floorplanUrl]);

  // ─── Property Adjuster (HTML UI) ──────────────────────────────────────────
  const adjustProperty = (prop: 'scaleX'|'scaleY'|'scaleZ'|'rotationY', delta: number) => {
    if (!selectedMachine) return;
    const opts = optionsRef.current;
    const newConfigs = { ...(opts.machineConfigs || {}) };
    const current = newConfigs[selectedMachine] || { x:0, z:0, scaleX:2, scaleY:1, scaleZ:2, rotationY:0 };
    
    let currentVal = current[prop];
    if (currentVal === undefined) {
      if (prop === 'scaleX') currentVal = opts.boxWidth || 2;
      else if (prop === 'scaleY') currentVal = opts.boxHeight || 1;
      else if (prop === 'scaleZ') currentVal = opts.boxDepth || 2;
      else if (prop === 'rotationY') currentVal = 0;
    }
    let newValue = (currentVal as number) + delta;
    if (prop.startsWith('scale') && newValue < 0.1) newValue = 0.1; // Prevent negative/zero scale

    newConfigs[selectedMachine] = { ...current, [prop]: newValue };
    
    // Smooth immediate visual update
    const mesh = machinesRef.current.get(selectedMachine);
    if (mesh) {
      if (prop === 'rotationY') {
        mesh.rotation.y = newValue;
      } else {
        mesh.scale.set(
          prop === 'scaleX' ? newValue : newConfigs[selectedMachine].scaleX, 
          prop === 'scaleY' ? newValue : newConfigs[selectedMachine].scaleY, 
          prop === 'scaleZ' ? newValue : newConfigs[selectedMachine].scaleZ
        );
        mesh.position.y = Math.abs(mesh.scale.y) / 2;
      }
    }

    if (onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
    }
  };

  // ─── Add Machine Handler ────────────────────────────────────────────────
  const handleAddMachine = () => {
    const name = newMachineName.trim();
    if (!name) return;
    
    const opts = optionsRef.current;
    const newConfigs = { ...(opts.machineConfigs || {}) };
    
    if (newConfigs[name]) {
      if (newConfigs[name].hidden) {
        newConfigs[name].hidden = false;
      }
    } else {
      newConfigs[name] = {
        x: 0,
        z: 0,
        scaleX: opts.boxWidth || 2,
        scaleY: opts.boxHeight || 1,
        scaleZ: opts.boxDepth || 2,
        rotationY: 0
      };
    }
    
    setShowAddPopup(false);
    setNewMachineName('');
    setSelectedMachine(name);

    if (onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
    }
  };

  // ─── Delete Machine Handler ───────────────────────────────────────────────
  const handleDeleteSelected = () => {
    if (!selectedMachine) return;
    const opts = optionsRef.current;
    const newConfigs = { ...(opts.machineConfigs || {}) };
    if (newConfigs[selectedMachine]) {
      newConfigs[selectedMachine].hidden = true;
    }
    
    setSelectedMachine(null);

    if (onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
    }
  };


  if (webglError) {
    return (
      <div className={styles.wrapper} style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' }}>
        <div style={{ color: '#ff5555', padding: 24, textAlign: 'center', border: '1px solid #ff5555', borderRadius: 8 }}>
          <b>⚠️ WebGL Error</b>
          <p>{webglError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cx(styles.wrapper, css`width: ${width}px; height: ${height}px;`)}>
      {/* 3D Canvas */}
      <div ref={mountRef} />

      {/* Floating Labels */}
      <div
        ref={labelsContainerRef}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%', zIndex: 5 }}
      />

      {/* 🛠️ Add Machine Button & Popup */}
      {options.enableEditMode && (
        <div style={{ position: 'absolute', top: 15, left: 15, zIndex: 30 }}>
          {!showAddPopup ? (
            <button 
              className={styles.addBtn} 
              onClick={() => setShowAddPopup(true)}
              onPointerDown={(e) => e.stopPropagation()} 
            >
              + สร้างกล่องใหม่
            </button>
          ) : (
            <div 
              style={{
                background: 'rgba(25, 25, 35, 0.95)', border: '1px solid #444',
                borderRadius: 8, padding: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column', gap: '8px', width: '220px'
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <h5 style={{ margin: 0, color: '#fff', fontSize: '14px' }}>สร้าง / กู้คืนกล่อง</h5>
              <input 
                autoFocus
                type="text" 
                value={newMachineName}
                onChange={(e) => setNewMachineName(e.target.value)}
                placeholder="ระบุชื่อ (ต้องตรงกับ SQL)"
                style={{
                  padding: '8px', borderRadius: '4px', border: '1px solid #555',
                  background: '#111', color: '#fff', fontSize: '13px'
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMachine()}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button 
                  onClick={handleAddMachine}
                  style={{ flex: 1, background: '#00cc44', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ตกลง
                </button>
                <button 
                  onClick={() => { setShowAddPopup(false); setNewMachineName(''); }}
                  style={{ flex: 1, background: '#555', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🛠️ Edit Mode Indicator */}
      {options.enableEditMode && (
        <div className={styles.modeBadge}>
          🛠️ EDIT MODE ACTIVE
        </div>
      )}

      {/* 🛠️ Smart Control Panel (HTML UI for Scale/Rotate/Delete) */}
      {options.enableEditMode && selectedMachine && (
        <div 
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
          position: 'absolute', bottom: 20, right: 20, zIndex: 30,
          background: 'rgba(25, 25, 35, 0.95)', border: '1px solid #444',
          borderRadius: 12, padding: '16px', color: '#fff',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
          width: 260
        }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: 16, borderBottom: '1px solid #555', paddingBottom: 8, color: '#ffaa00' }}>
            🛠️ ตั้งค่า: {selectedMachine}
          </h4>
          
          <div style={{ display: 'grid', gap: '10px' }}>
            {/* Scale Controls */}
            {[
              { label: 'กว้าง (X)', prop: 'scaleX', delta: 0.5 },
              { label: 'สูง (Y)', prop: 'scaleY', delta: 0.5 },
              { label: 'ลึก (Z)', prop: 'scaleZ', delta: 0.5 },
            ].map(item => (
              <div key={item.prop} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#bbb' }}>{item.label}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={() => adjustProperty(item.prop as any, -item.delta)} className={styles.iconBtn}>-</button>
                  <span style={{ display: 'inline-block', width: 35, textAlign: 'center', fontSize: 13, fontWeight: 'bold' }}>
                    {(options.machineConfigs?.[selectedMachine] as any)?.[item.prop] || 1}
                  </span>
                  <button onClick={() => adjustProperty(item.prop as any, item.delta)} className={styles.iconBtn}>+</button>
                </div>
              </div>
            ))}
            
            {/* Rotation Control */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 13, color: '#bbb' }}>หมุน (องศา)</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={() => adjustProperty('rotationY', -Math.PI/8)} className={styles.iconBtn}>↺</button>
                <span style={{ display: 'inline-block', width: 35, textAlign: 'center', fontSize: 13, fontWeight: 'bold' }}>
                  {Math.round(((options.machineConfigs?.[selectedMachine]?.rotationY) || 0) * (180/Math.PI))}°
                </span>
                <button onClick={() => adjustProperty('rotationY', Math.PI/8)} className={styles.iconBtn}>↻</button>
              </div>
            </div>
          </div>

          <button className={styles.deleteBtn} onClick={handleDeleteSelected}>
            🗑️ ลบกล่องนี้
          </button>
        </div>
      )}
    </div>
  );
};
