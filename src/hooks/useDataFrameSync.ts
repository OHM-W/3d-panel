import { useEffect, MutableRefObject } from 'react';
import * as THREE from 'three';
import { PanelData } from '@grafana/data';
import { SimpleOptions, MachineLayoutConfig, AlarmSeverity } from '../types';
import { AlarmRenderer } from '../engine/AlarmRenderer';
import { escapeHTML } from '../utils/formatUtils';
import { getStatusColor, getStatusLabel } from '../utils/statusUtils';
import { buildAliasLookup, resolveDbToModel } from '../utils/matchingUtils';

interface UseDataFrameSyncParams {
  data: PanelData;
  options: SimpleOptions;
  sceneReady: boolean;
  sceneRef: MutableRefObject<THREE.Scene | null>;
  machinesRef: MutableRefObject<Map<string, THREE.Mesh>>;
  meshesArrayRef: MutableRefObject<THREE.Mesh[]>;
  labelsRef: MutableRefObject<Map<string, HTMLDivElement>>;
  labelsContainerRef: MutableRefObject<HTMLDivElement | null>;
  alarmRendererRef: MutableRefObject<AlarmRenderer | null>;
  sqlColumnsRef: MutableRefObject<Map<string, Map<string, number>>>;
  statusRef: MutableRefObject<Map<string, number | undefined>>;
  severityRef: MutableRefObject<Map<string, AlarmSeverity>>;
  lotoRef: MutableRefObject<Map<string, boolean>>;
  optionsRef: MutableRefObject<SimpleOptions>;
  onOptionsChangeRef: MutableRefObject<((options: SimpleOptions) => void) | undefined>;
  fieldConfigRef: MutableRefObject<any>;
  themeRef: MutableRefObject<any>;
}

export function useDataFrameSync({
  data,
  options,
  sceneReady,
  sceneRef,
  machinesRef,
  meshesArrayRef,
  labelsRef,
  labelsContainerRef,
  alarmRendererRef,
  sqlColumnsRef,
  statusRef,
  severityRef,
  lotoRef,
  optionsRef,
  onOptionsChangeRef,
  fieldConfigRef,
  themeRef,
}: UseDataFrameSyncParams) {
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;
    const opts = optionsRef.current;

    const nameCol = opts.machineNameField?.trim() || 'machine_name';
    const statusCol = opts.statusFieldName?.trim() || 'status';
    const severityCol = opts.severityFieldName?.trim() || 'severity';
    const lotoCol = opts.lotoFieldName?.trim() || 'is_loto';

    // 1. Parse DataFrame
    const freshSQL = new Map<string, Map<string, number>>();
    const stringFields = data.series.flatMap(s => s.fields.filter(f => f.type === 'string'));
    const numberFields = data.series.flatMap(s => s.fields.filter(f => f.type === 'number'));
    const boolFields = data.series.flatMap(s => s.fields.filter(f => f.type === 'boolean'));

    const nameField = stringFields.find(f => f.name === nameCol) ?? stringFields[0];
    const severityField = stringFields.find(f => f.name === severityCol);
    const lotoField = boolFields.find(f => f.name === lotoCol) ?? numberFields.find(f => f.name === lotoCol);

    if (nameField && (numberFields.length >= 1 || boolFields.length >= 1)) {
      // Build alias lookup from user-configured CSV (built once per render, not per row)
      const aliasLookup = buildAliasLookup(opts.aliasMappingCsv || '');
      const regex = opts.machineNameRegex?.trim() || undefined;

      // BUG FIX (HIGH): Only read the LAST row per machine to avoid O(N) CPU spike
      // from raw time-series data. We scan backwards and record only the first
      // (latest) occurrence of each machine name.
      const seenMachines = new Set<string>();
      for (let i = nameField.values.length - 1; i >= 0; i--) {
        const rawDbName = String(nameField.values[i]);
        if (!rawDbName) { continue; }

        // SPRINT 2: Resolve DB identifier → 3D model name via alias/regex pipeline
        const mName = resolveDbToModel(rawDbName, aliasLookup, regex);

        if (seenMachines.has(mName)) { continue; }
        seenMachines.add(mName);

        if (!freshSQL.has(mName)) { freshSQL.set(mName, new Map()); }
        for (const nf of numberFields) {
          const v = nf.values[i];
          if (v != null) { freshSQL.get(mName)!.set(nf.name, Number(v)); }
        }

        if (severityField) {
          // BUG FIX (HIGH): Use null check (== null) not falsy (||) so that
          // numeric severity 0 is not coerced to 'None'
          const rawSev = severityField.values[i];
          const sev = (rawSev == null ? 'None' : String(rawSev)) as AlarmSeverity;
          severityRef.current.set(mName, sev);
        }

        if (lotoField) {
          lotoRef.current.set(mName, Boolean(lotoField.values[i]));
        }
      }
    }
    sqlColumnsRef.current = freshSQL;

    // 2. Auto-Discovery in Edit Mode
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

    // 3. Render / Update 3D Meshes
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

    // Remove hidden / deleted
    for (const [name, mesh] of machinesRef.current.entries()) {
      if (!currentConfigNames.includes(name) || configs[name]?.hidden) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        // BUG FIX (CRITICAL): material can be an array (multi-material mesh), so
        // blindly casting to THREE.Material would throw TypeError. Check first.
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
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

    // 4. Update Colors & ISA-101 Labels
    for (const [name, mesh] of machinesRef.current.entries()) {
      const machineSQL = freshSQL.get(name);
      let rawStatus = machineSQL?.get(statusCol) ?? machineSQL?.get('value');
      const isLOTO = lotoRef.current.get(name) ?? false;
      const severity = severityRef.current.get(name) ?? 'None';

      if (isLOTO) rawStatus = 4;
      statusRef.current.set(name, rawStatus);

      const hexColor = getStatusColor(rawStatus, fieldConfigRef.current, themeRef.current);
      (mesh.material as THREE.MeshStandardMaterial).color.set(hexColor);

      alarmRendererRef.current?.updateMachineVisuals(
        name, mesh, rawStatus, severity, isLOTO,
        opts.enableISA101Alarms !== false,
        opts.enableLOTO !== false
      );

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

        label.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between">
            <b style="color:#eee">${escapeHTML(name)}</b>
            ${badgeHtml}
          </div>
          <span style="color:${hexColor};font-size:10px">${escapeHTML(getStatusLabel(rawStatus))}</span>
        `;
      }
    }

    meshesArrayRef.current.length = 0;
    meshesArrayRef.current.push(...Array.from(machinesRef.current.values()));

  }, [data, sceneReady, options.machineConfigs, options.machineNameField, options.statusFieldName, options.enableISA101Alarms, options.enableLOTO]);
}
