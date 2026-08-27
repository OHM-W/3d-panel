import React, { useEffect, useRef, useState } from 'react';
import { PanelProps, FieldConfigSource, getActiveThreshold } from '@grafana/data';
import { SimpleOptions, MachineLayoutConfig, AlarmSeverity, CameraMode } from '../types';
import { css, cx } from '@emotion/css';
import { useStyles2, useTheme2 } from '@grafana/ui';
import * as THREE from 'three';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import { CameraRig } from '../engine/CameraRig';
import { AlarmRenderer } from '../engine/AlarmRenderer';
import { TextureManager } from '../engine/TextureManager';

// Modular Child Components
import { CameraToolbar } from './CameraToolbar';
import { WalkthroughHelp } from './WalkthroughHelp';
import { MachineHUDDrawer } from './MachineHUDDrawer';
import { EditControlPanel } from './EditControlPanel';
import { AddMachineModal } from './AddMachineModal';

interface Props extends PanelProps<SimpleOptions> {}

const getStyles = () => ({
  wrapper: css`
    position: relative;
    overflow: hidden;
    font-family: 'Inter', sans-serif;
    user-select: none;
  `,
  modeBadge: css`
    position: absolute; top: 15px; right: 15px; z-index: 20;
    background: rgba(255, 170, 0, 0.9); color: #000;
    padding: 6px 16px; border-radius: 20px;
    font-size: 12px; font-weight: 800; letter-spacing: 0.5px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5); pointer-events: none;
  `,
});

// ─── 🛡️ Security: HTML Sanitizer (XSS Prevention) ───────────────────────────
function escapeHTML(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTelemetryValue(val: any): string {
  if (typeof val === 'number') {
    if (isNaN(val)) return '—';
    return Number.isInteger(val)
      ? val.toLocaleString()
      : val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return escapeHTML(val ?? '—');
}

function getStatusColor(status: number | undefined, fieldConfig: FieldConfigSource, theme: any): string {
  if (status === undefined || status === null || isNaN(Number(status))) {
    return theme.visualization.getColorByName('semi-dark-gray') || '#64748B';
  }
  if (status === 4) {
    return theme.visualization.getColorByName('semi-dark-blue') || '#38BDF8';
  }
  const steps = fieldConfig?.defaults?.thresholds?.steps ?? [];
  const threshold = getActiveThreshold(Number(status), steps);
  return theme.visualization.getColorByName(threshold.color);
}

function getStatusLabel(status: number | undefined): string {
  if (status === undefined || status === null || isNaN(Number(status))) return '⚫ Off / No Data';
  if (status === 4) return '🔒 LOTO Maintenance';
  if (status === 3) return '🔴 Critical Alarm';
  if (status === 1) return '🟡 In Production';
  if (status === 2) return '🟢 Running';
  return '⚫ Off / No Data';
}

function parseTooltipFields(str: string): Array<{ column: string; label: string; unit: string }> {
  if (!str?.trim()) return [];
  return str.split(',').map(part => {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return null;
    const column = trimmed.slice(0, eqIdx).trim();
    const rest = trimmed.slice(eqIdx + 1).trim();
    const colonIdx = rest.indexOf(':');
    const label = colonIdx === -1 ? rest : rest.slice(0, colonIdx).trim();
    const unit  = colonIdx === -1 ? '' : rest.slice(colonIdx + 1).trim();
    return { column, label, unit };
  }).filter(Boolean) as Array<{ column: string; label: string; unit: string }>;
}

export const SimplePanel: React.FC<Props> = ({ options, data, width, height, onOptionsChange, fieldConfig }) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  // ─── Stable Refs ──────────────────────────────────────────────────────────
  const fieldConfigRef = useRef(fieldConfig);
  const themeRef = useRef(theme);
  const optionsRef = useRef(options);
  const onOptionsChangeRef = useRef(onOptionsChange);
  const widthRef = useRef(width);
  const heightRef = useRef(height);

  useEffect(() => {
    fieldConfigRef.current = fieldConfig;
    themeRef.current = theme;
    optionsRef.current = options;
    onOptionsChangeRef.current = onOptionsChange;
    widthRef.current = width;
    heightRef.current = height;
  });

  // ─── DOM Refs ─────────────────────────────────────────────────────────────
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // ─── State ────────────────────────────────────────────────────────────────
  const [webglError, setWebglError] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [newMachineName, setNewMachineName] = useState('');
  const [hudMachine, setHudMachine] = useState<string | null>(null);
  const [camMode, setCamMode] = useState<CameraMode>(options.cameraPreset || 'perspective');

  // ─── Three.js & Engine Refs ───────────────────────────────────────────────
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cameraRigRef = useRef<CameraRig | null>(null);
  const alarmRendererRef = useRef<AlarmRenderer | null>(null);
  const textureManagerRef = useRef<TextureManager | null>(null);

  const meshesArrayRef = useRef<THREE.Mesh[]>([]);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const dControlsRef = useRef<DragControls | null>(null);

  // Data maps
  const machinesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const statusRef = useRef<Map<string, number | undefined>>(new Map());
  const severityRef = useRef<Map<string, AlarmSeverity>>(new Map());
  const lotoRef = useRef<Map<string, boolean>>(new Map());
  const sqlColumnsRef = useRef<Map<string, Map<string, number>>>(new Map());
  const labelsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastDragEnd = useRef(0);

  // ─── Selection Helper ─────────────────────────────────────────────────────
  const selectMachine = (name: string | null) => {
    setSelectedMachine(name);
    setRenameInput(name || '');
  };

  // ─── Switch Camera Mode Handler ───────────────────────────────────────────
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

  // Sync camMode if options.cameraPreset changes from panel options
  useEffect(() => {
    if (options.cameraPreset && options.cameraPreset !== camMode) {
      setCamMode(options.cameraPreset);
      if (cameraRigRef.current && sceneReady) {
        cameraRigRef.current.setMode(options.cameraPreset, options.floorSize || 50);
      }
    }
  }, [options.cameraPreset, options.floorSize, sceneReady]);

  // ─── Effect: Floorplan Texture ────────────────────────────────────────────
  useEffect(() => {
    if (textureManagerRef.current) {
      textureManagerRef.current.updateFloorplan(options.floorplanUrl);
    }
  }, [options.floorplanUrl, sceneReady]);

  // ─── Effect: Grid Lines ───────────────────────────────────────────────────
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

  // ─── Effect: Edit Mode Toggle ─────────────────────────────────────────────
  useEffect(() => {
    if (dControlsRef.current) {
      dControlsRef.current.enabled = options.enableEditMode;
    }
    if (!options.enableEditMode) {
      selectMachine(null);
    }
  }, [options.enableEditMode]);

  // ─── Effect: Data Sync & ISA-101 Alarms ───────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;
    const opts = optionsRef.current;

    const nameCol = opts.machineNameField?.trim() || 'machine_name';
    const statusCol = opts.statusFieldName?.trim() || 'status';
    const severityCol = opts.severityFieldName?.trim() || 'severity';
    const lotoCol = opts.lotoFieldName?.trim() || 'is_loto';

    // 1. Parse SQL DataFrame
    const freshSQL = new Map<string, Map<string, number>>();
    const stringFields = data.series.flatMap(s => s.fields.filter(f => f.type === 'string'));
    const numberFields = data.series.flatMap(s => s.fields.filter(f => f.type === 'number'));
    const boolFields = data.series.flatMap(s => s.fields.filter(f => f.type === 'boolean'));

    const nameField = stringFields.find(f => f.name === nameCol) ?? stringFields[0];
    const severityField = stringFields.find(f => f.name === severityCol);
    const lotoField = boolFields.find(f => f.name === lotoCol) ?? numberFields.find(f => f.name === lotoCol);

    if (nameField && (numberFields.length >= 1 || boolFields.length >= 1)) {
      for (let i = 0; i < nameField.values.length; i++) {
        const mName = String(nameField.values[i]);
        if (!mName) continue;

        if (!freshSQL.has(mName)) freshSQL.set(mName, new Map());
        for (const nf of numberFields) {
          const v = nf.values[i];
          if (v != null) freshSQL.get(mName)!.set(nf.name, Number(v));
        }

        if (severityField) {
          const sev = String(severityField.values[i] || 'None') as AlarmSeverity;
          severityRef.current.set(mName, sev);
        }

        if (lotoField) {
          const isL = Boolean(lotoField.values[i]);
          lotoRef.current.set(mName, isL);
        }
      }
    }
    sqlColumnsRef.current = freshSQL;

    // 2. Auto-Discovery (Edit mode only)
    const configs = opts.machineConfigs || {};
    let newConfigs: Record<string, MachineLayoutConfig> | null = null;
    let autoPlacementCount = Object.keys(configs).length;

    for (const mName of freshSQL.keys()) {
      if (!configs[mName]) {
        if (!newConfigs) newConfigs = { ...configs };
        const col = autoPlacementCount % 10;
        const row = Math.floor(autoPlacementCount / 10);
        newConfigs[mName] = {
          x: col * 3, z: row * 3,
          scaleX: opts.boxWidth || 2, scaleY: opts.boxHeight || 1,
          scaleZ: opts.boxDepth || 2, rotationY: 0,
        };
        autoPlacementCount++;
      }
    }

    if (newConfigs && opts.enableEditMode && onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
      return;
    }

    // 3. Render / Update Meshes
    const currentConfigNames = Object.keys(configs);
    for (const name of currentConfigNames) {
      const cfg = configs[name];
      if (!machinesRef.current.has(name)) {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.2 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.position.set(cfg.x, cfg.scaleY / 2, cfg.z);
        mesh.scale.set(cfg.scaleX, cfg.scaleY, cfg.scaleZ);
        mesh.rotation.y = cfg.rotationY || 0;
        mesh.userData = { name };
        scene.add(mesh);
        machinesRef.current.set(name, mesh);

        // Label element with XSS escaping
        const label = document.createElement('div');
        label.style.cssText = `
          position: absolute; top: 0; left: 0;
          will-change: transform;
          color: white; background: rgba(10, 15, 25, 0.88);
          padding: 4px 9px; border-radius: 6px; font-size: 11px;
          font-family: monospace; pointer-events: none;
          border: 1px solid rgba(255,255,255,0.18); white-space: nowrap;
          backdrop-filter: blur(4px); transition: opacity 0.2s;
        `;
        labelsContainerRef.current?.appendChild(label);
        labelsRef.current.set(name, label);
      } else {
        const mesh = machinesRef.current.get(name)!;
        mesh.scale.set(cfg.scaleX, cfg.scaleY, cfg.scaleZ);
        mesh.position.y = Math.abs(cfg.scaleY) / 2;
        mesh.rotation.y = cfg.rotationY || 0;
      }
    }

    // Remove hidden / deleted machines
    for (const [name, mesh] of machinesRef.current.entries()) {
      if (!currentConfigNames.includes(name) || configs[name]?.hidden) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        const label = labelsRef.current.get(name);
        if (label?.parentNode) label.parentNode.removeChild(label);
        machinesRef.current.delete(name);
        labelsRef.current.delete(name);
        statusRef.current.delete(name);
        severityRef.current.delete(name);
        lotoRef.current.delete(name);
        alarmRendererRef.current?.removeMachine(name);
      }
    }

    // 4. Update Status Colors & ISA-101 Badges (with XSS Sanitization)
    for (const [name, mesh] of machinesRef.current.entries()) {
      const machineSQL = freshSQL.get(name);
      let rawStatus = machineSQL?.get(statusCol) ?? machineSQL?.get('value');
      const isLOTO = lotoRef.current.get(name) ?? false;
      const severity = severityRef.current.get(name) ?? 'None';

      if (isLOTO) rawStatus = 4;
      statusRef.current.set(name, rawStatus);

      const hexColor = getStatusColor(rawStatus, fieldConfigRef.current, themeRef.current);
      (mesh.material as THREE.MeshStandardMaterial).color.set(hexColor);

      // ISA-101 Visuals
      alarmRendererRef.current?.updateMachineVisuals(
        name, mesh, rawStatus, severity, isLOTO,
        opts.enableISA101Alarms !== false,
        opts.enableLOTO !== false
      );

      // Label Content with ISA-101 Badge (Strictly Escaped)
      const label = labelsRef.current.get(name);
      if (label) {
        let badgeHtml = '';
        if (isLOTO && opts.enableLOTO !== false) {
          badgeHtml = '<span style="background:#0284c7;color:#fff;padding:1px 4px;border-radius:3px;font-size:9px;font-weight:bold;margin-left:4px">🔒 LOTO</span>';
        } else if (severity === 'Critical' || rawStatus === 3) {
          badgeHtml = '<span style="background:#dc2626;color:#fff;padding:1px 4px;border-radius:3px;font-size:9px;font-weight:bold;margin-left:4px">▲ CRIT</span>';
        } else if (severity === 'Major') {
          badgeHtml = '<span style="background:#d97706;color:#fff;padding:1px 4px;border-radius:3px;font-size:9px;font-weight:bold;margin-left:4px">◆ MAJOR</span>';
        }

        const safeName = escapeHTML(name);
        const safeStatusLabel = escapeHTML(getStatusLabel(rawStatus));

        label.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between">
            <b style="color:#eee">${safeName}</b>
            ${badgeHtml}
          </div>
          <span style="color:${hexColor};font-size:10px">${safeStatusLabel}</span>
        `;
      }
    }

    meshesArrayRef.current.length = 0;
    meshesArrayRef.current.push(...Array.from(machinesRef.current.values()));

  }, [data, sceneReady, options.machineConfigs, options.machineNameField, options.statusFieldName, options.enableISA101Alarms, options.enableLOTO]);

  // ─── Effect: Init Three.js Scene ──────────────────────────────────────────
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

    // ─── 🔄 WebGL Context Loss Recovery Lifecycle ─────────────────────────────
    let isContextLost = false;

    const onContextLost = (event: Event) => {
      event.preventDefault();
      isContextLost = true;
      console.warn('[IMS 3D Panel] WebGL Context Lost! Pausing render loop gracefully...');
      if (animId) cancelAnimationFrame(animId);
    };

    const onContextRestored = () => {
      console.info('[IMS 3D Panel] WebGL Context Restored! Re-initializing textures & state...');
      isContextLost = false;
      if (textureManagerRef.current) {
        textureManagerRef.current.updateFloorplan(optionsRef.current.floorplanUrl);
      }
      lastTime = performance.now();
      animate();
    };

    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

    // Initialize Engine Modules
    const cameraRig = new CameraRig(camera, renderer.domElement);
    cameraRig.setMode(options.cameraPreset || 'perspective', options.floorSize || 50);
    cameraRigRef.current = cameraRig;

    const alarmRenderer = new AlarmRenderer(scene);
    alarmRendererRef.current = alarmRenderer;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(12, 24, 12);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Floor Mesh & Texture Manager
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

    // Tooltip DOM element
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
    tooltipRef.current = tooltip;

    // DragControls (for Edit mode)
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

    // Raycaster & Click Handling
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

    // Hover Tooltip (Strictly Escaped against XSS)
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

        const extraFields = parseTooltipFields(optionsRef.current.tooltipFields || '');
        let extraHtml = '';
        for (const f of extraFields) {
          const val = machineSQL.get(f.column);
          if (val !== undefined) {
            const formattedVal = formatTelemetryValue(val);
            const safeLabel = escapeHTML(f.label);
            const safeUnit = escapeHTML(f.unit);
            extraHtml += `
              <div style="display:flex;justify-content:space-between;gap:18px;padding:2px 0">
                <span style="color:#94a3b8">${safeLabel}</span>
                <span style="color:#fff;font-weight:600">${formattedVal}${safeUnit ? ' ' + safeUnit : ''}</span>
              </div>`;
          }
        }

        const rect = renderer.domElement.getBoundingClientRect();
        let tx = event.clientX - rect.left + 18;
        let ty = event.clientY - rect.top + 18;
        if (tx + 290 > rect.width) tx = event.clientX - rect.left - 295;
        if (ty + 180 > rect.height) ty = event.clientY - rect.top - 185;

        const safeName = escapeHTML(name);
        const safeStatus = escapeHTML(getStatusLabel(status));

        tooltip.innerHTML = `
          <div style="font-size:14px;font-weight:800;color:#fff;border-bottom:1px solid rgba(255,255,255,0.14);padding-bottom:6px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
            <span>${safeName}</span>
            ${isLOTO ? '<span style="color:#38bdf8;font-size:10px;font-weight:bold">🔒 LOTO</span>' : ''}
            ${severity === 'Critical' ? '<span style="color:#ef4444;font-size:10px;font-weight:bold">▲ CRITICAL</span>' : ''}
          </div>
          <div style="display:flex;justify-content:space-between;gap:18px;padding:2px 0">
            <span style="color:#94a3b8">Status</span>
            <span style="color:${color};font-weight:700">${safeStatus}</span>
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

    // ─── Animation Loop ─────────────────────────────────────────────────────
    let animId: number;
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

      // Update Camera & Alarms
      cameraRig.update(delta, fSize);
      alarmRenderer.animate(time);

      // Label Positioning & Status Pulsing
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

  // ─── Effect: Resize ───────────────────────────────────────────────────────
  useEffect(() => {
    if (cameraRef.current && rendererRef.current) {
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    }
  }, [width, height]);

  // ─── Effect: Floor Size ───────────────────────────────────────────────────
  useEffect(() => {
    if (floorMeshRef.current) {
      const fSize = Math.max(10, options.floorSize || 50);
      floorMeshRef.current.scale.set(fSize, fSize, 1);
    }
  }, [options.floorSize, sceneReady]);

  // ─── Edit Mode: Adjust Properties ─────────────────────────────────────────
  const adjustProperty = (prop: 'scaleX'|'scaleY'|'scaleZ'|'rotationY', delta: number) => {
    if (!selectedMachine) return;
    const opts = optionsRef.current;
    const newConfigs = { ...(opts.machineConfigs || {}) };
    const current = newConfigs[selectedMachine] || { x:0, z:0, scaleX:2, scaleY:1, scaleZ:2, rotationY:0 };
    let currentVal = (current as any)[prop] ?? (prop === 'scaleX' ? opts.boxWidth || 2 : prop === 'scaleY' ? opts.boxHeight || 1 : prop === 'scaleZ' ? opts.boxDepth || 2 : 0);
    let newValue = (currentVal as number) + delta;
    if (prop.startsWith('scale') && newValue < 0.1) newValue = 0.1;

    newConfigs[selectedMachine] = { ...current, [prop]: newValue };
    const mesh = machinesRef.current.get(selectedMachine);
    if (mesh) {
      if (prop === 'rotationY') mesh.rotation.y = newValue;
      else {
        mesh.scale.set(
          prop === 'scaleX' ? newValue : newConfigs[selectedMachine].scaleX,
          prop === 'scaleY' ? newValue : newConfigs[selectedMachine].scaleY,
          prop === 'scaleZ' ? newValue : newConfigs[selectedMachine].scaleZ,
        );
        mesh.position.y = Math.abs(mesh.scale.y) / 2;
      }
    }
    if (onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
    }
  };

  // ─── ✏️ Rename Machine Handler (Instant Re-binding) ───────────────────────
  const handleRenameMachine = () => {
    const newName = renameInput.trim();
    if (!newName || !selectedMachine || newName === selectedMachine) return;

    const opts = optionsRef.current;
    const oldConfigs = opts.machineConfigs || {};
    const currentConfig = oldConfigs[selectedMachine] || {
      x: 0, z: 0, scaleX: opts.boxWidth || 2, scaleY: opts.boxHeight || 1, scaleZ: opts.boxDepth || 2, rotationY: 0
    };

    // 1. Copy config to newName, delete old key from machineConfigs
    const newConfigs = { ...oldConfigs };
    newConfigs[newName] = { ...currentConfig };
    delete newConfigs[selectedMachine];

    // 2. Update Three.js Mesh and Label refs in-place
    const mesh = machinesRef.current.get(selectedMachine);
    if (mesh) {
      mesh.userData = { name: newName };
      machinesRef.current.delete(selectedMachine);
      machinesRef.current.set(newName, mesh);
    }

    const label = labelsRef.current.get(selectedMachine);
    if (label) {
      labelsRef.current.delete(selectedMachine);
      labelsRef.current.set(newName, label);
    }

    // 3. Clear old status/severity/loto for old name
    statusRef.current.delete(selectedMachine);
    severityRef.current.delete(selectedMachine);
    lotoRef.current.delete(selectedMachine);
    alarmRendererRef.current?.removeMachine(selectedMachine);

    // 4. Update selection state
    setSelectedMachine(newName);
    setRenameInput(newName);

    // 5. Trigger Grafana options change to persist in Dashboard JSON
    if (onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
    }
  };

  const handleAddMachine = () => {
    const name = newMachineName.trim();
    if (!name) return;
    const opts = optionsRef.current;
    const newConfigs = { ...(opts.machineConfigs || {}) };
    if (newConfigs[name]) {
      if (newConfigs[name].hidden) newConfigs[name].hidden = false;
    } else {
      newConfigs[name] = { x: 0, z: 0, scaleX: opts.boxWidth || 2, scaleY: opts.boxHeight || 1, scaleZ: opts.boxDepth || 2, rotationY: 0 };
    }
    setShowAddPopup(false);
    setNewMachineName('');
    selectMachine(name);
    if (onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedMachine) return;
    const opts = optionsRef.current;
    const newConfigs = { ...(opts.machineConfigs || {}) };
    if (newConfigs[selectedMachine]) newConfigs[selectedMachine].hidden = true;
    selectMachine(null);
    if (onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
    }
  };

  const hudData = hudMachine ? sqlColumnsRef.current.get(hudMachine) : undefined;
  const hudStatus = hudMachine ? statusRef.current.get(hudMachine) : undefined;
  const hudSeverity = hudMachine ? severityRef.current.get(hudMachine) ?? 'None' : 'None';
  const hudLOTO = hudMachine ? lotoRef.current.get(hudMachine) ?? false : false;
  const hudColor = getStatusColor(hudStatus, fieldConfig, theme);
  const tooltipFieldsParsed = parseTooltipFields(options.tooltipFields || '');

  if (webglError) {
    return (
      <div className={styles.wrapper} style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
        <div style={{ color: '#ef4444', padding: 24, textAlign: 'center', border: '1px solid #ef4444', borderRadius: 8 }}>
          <b>WebGL Error</b>
          <p>{escapeHTML(webglError)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cx(styles.wrapper, css`width: ${width}px; height: ${height}px;`)}>
      {/* 3D Canvas */}
      <div ref={mountRef} />

      {/* ── 1. Floating On-Screen Camera Toolbar ─────────────────────────── */}
      {!options.enableEditMode && (
        <CameraToolbar
          currentMode={camMode}
          onSwitchMode={handleSwitchCamMode}
          onReset={handleResetCamera}
        />
      )}

      {/* ── 2. Walkthrough Mode Key Help ─────────────────────────────────── */}
      <WalkthroughHelp visible={camMode === 'walkthrough' && !options.enableEditMode} />

      {/* Floating Labels */}
      <div
        ref={labelsContainerRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          pointerEvents: 'none', width: '100%', height: '100%',
          zIndex: 5, display: options.showLabels !== false ? 'block' : 'none'
        }}
      />

      {/* ── 3. Machine HUD Drawer ────────────────────────────────────────── */}
      {!options.enableEditMode && (
        <MachineHUDDrawer
          machineName={hudMachine}
          status={hudStatus}
          severity={hudSeverity}
          isLOTO={hudLOTO}
          hudColor={hudColor}
          statusLabel={getStatusLabel(hudStatus)}
          telemetryData={hudData}
          tooltipFields={tooltipFieldsParsed}
          statusFieldName={options.statusFieldName}
          dashboardUrlTemplate={options.dashboardUrlTemplate}
          onClose={() => setHudMachine(null)}
        />
      )}

      {/* ── 4. Add Machine Button & Modal (Edit mode) ────────────────────── */}
      {options.enableEditMode && (
        <AddMachineModal
          isOpen={showAddPopup}
          machineName={newMachineName}
          onMachineNameChange={setNewMachineName}
          onConfirm={handleAddMachine}
          onCancel={() => { setShowAddPopup(false); setNewMachineName(''); }}
          onOpen={() => setShowAddPopup(true)}
        />
      )}

      {/* ── Edit Mode Badge ───────────────────────────────────────────────── */}
      {options.enableEditMode && <div className={styles.modeBadge}>🛠️ EDIT MODE ACTIVE</div>}

      {/* ── 5. Edit Control Panel ─────────────────────────────────────────── */}
      {options.enableEditMode && (
        <EditControlPanel
          selectedMachine={selectedMachine}
          machineConfig={selectedMachine ? options.machineConfigs?.[selectedMachine] : undefined}
          renameInput={renameInput}
          onRenameInputChange={setRenameInput}
          onRename={handleRenameMachine}
          onAdjustProperty={adjustProperty}
          onDelete={handleDeleteSelected}
        />
      )}
    </div>
  );
};
