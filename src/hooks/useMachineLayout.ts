import { useState, MutableRefObject } from 'react';
import * as THREE from 'three';
import { SimpleOptions, AlarmSeverity } from '../types';
import { AlarmRenderer } from '../engine/AlarmRenderer';
import {
  alignLeft, alignRight, alignTop, alignBottom,
  alignCenterH, distributeHorizontal, distributeVertical
} from '../utils/alignmentUtils';

interface UseMachineLayoutParams {
  optionsRef: MutableRefObject<SimpleOptions>;
  onOptionsChangeRef: MutableRefObject<((options: SimpleOptions) => void) | undefined>;
  machinesRef: MutableRefObject<Map<string, THREE.Mesh>>;
  labelsRef: MutableRefObject<Map<string, HTMLDivElement>>;
  statusRef: MutableRefObject<Map<string, number | undefined>>;
  severityRef: MutableRefObject<Map<string, AlarmSeverity>>;
  lotoRef: MutableRefObject<Map<string, boolean>>;
  alarmRendererRef: MutableRefObject<AlarmRenderer | null>;
}

export function useMachineLayout({
  optionsRef,
  onOptionsChangeRef,
  machinesRef,
  labelsRef,
  statusRef,
  severityRef,
  lotoRef,
  alarmRendererRef,
}: UseMachineLayoutParams) {
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [newMachineName, setNewMachineName] = useState('');

  // ─── Placement Mode (Click-to-Place) ─────────────────────────────────────
  const [placementMode, setPlacementMode] = useState<string | null>(null);

  const enterPlacementMode = (machineName: string) => {
    setPlacementMode(machineName);
    document.body.style.cursor = 'crosshair';
  };

  const exitPlacementMode = () => {
    setPlacementMode(null);
    document.body.style.cursor = 'default';
  };

  const placeMachineAt = (x: number, z: number) => {
    if (!placementMode) return;
    const name = placementMode;
    const opts = optionsRef.current;
    const newConfigs = { ...(opts.machineConfigs || {}) };
    newConfigs[name] = {
      x, z,
      scaleX: opts.boxWidth || 2,
      scaleY: opts.boxHeight || 1,
      scaleZ: opts.boxDepth || 2,
      rotationY: 0,
    };
    exitPlacementMode();
    selectMachine(name);
    
    if (onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
    }
  };

  // ─── Anchor Calibration Mode ──────────────────────────────────────────────
  const [anchorMode, setAnchorMode] = useState<'A' | 'B' | null>(null);
  
  // When anchor is placed on the 3D plane, we get U,V and ask user for real-world X,Z
  // For simplicity without a popup dialog, we could assume standard bounds or provide a dialog.
  // Actually, let's open a small dialog state for the world coordinate input.
  const [pendingAnchor, setPendingAnchor] = useState<{ u: number, v: number } | null>(null);

  const startAnchorPlacement = (mode: 'A' | 'B') => {
    setAnchorMode(mode);
    document.body.style.cursor = 'crosshair';
  };

  const cancelAnchorPlacement = () => {
    setAnchorMode(null);
    setPendingAnchor(null);
    document.body.style.cursor = 'default';
  };

  const onFloorClickedForAnchor = (u: number, v: number) => {
    if (!anchorMode) return;
    setPendingAnchor({ u, v });
    document.body.style.cursor = 'default';
  };

  const confirmAnchorPoint = (worldX: number, worldZ: number) => {
    if (!anchorMode || !pendingAnchor) return;
    const opts = optionsRef.current;
    const anchorData = {
      imageU: pendingAnchor.u,
      imageV: pendingAnchor.v,
      worldX,
      worldZ
    };

    if (onOptionsChangeRef.current) {
      onOptionsChangeRef.current({
        ...opts,
        [anchorMode === 'A' ? 'anchorA' : 'anchorB']: anchorData
      });
    }

    setAnchorMode(null);
    setPendingAnchor(null);
  };

  // ─── Multi-select State ──────────────────────────────────────────────────
  // Set of machine names currently selected for group operations
  const [selectedGroup, setSelectedGroup] = useState<Set<string>>(new Set());

  const selectMachine = (name: string | null) => {
    setSelectedMachine(name);
    setRenameInput(name || '');
  };

  /** Toggle a machine into/out of the multi-select group (Shift+Click behaviour) */
  const toggleGroupSelection = (name: string) => {
    setSelectedGroup((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  /** Clear all multi-selected machines */
  const clearGroupSelection = () => setSelectedGroup(new Set());

  /**
   * Move all machines in the selectedGroup by (dx, dz) delta.
   * Used by drag handlers to translate an entire group at once.
   */
  const handleGroupMove = (dx: number, dz: number) => {
    if (selectedGroup.size === 0) { return; }
    const opts = optionsRef.current;
    const newConfigs = { ...(opts.machineConfigs || {}) };

    for (const name of selectedGroup) {
      if (!newConfigs[name]) { continue; }
      newConfigs[name] = {
        ...newConfigs[name],
        x: newConfigs[name].x + dx,
        z: newConfigs[name].z + dz,
      };

      // Immediately update the 3D mesh position so the UI feels responsive
      const mesh = machinesRef.current.get(name);
      if (mesh) {
        mesh.position.x = newConfigs[name].x;
        mesh.position.z = newConfigs[name].z;
      }
    }

    if (onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
    }
  };

  const handleAdjustProperty = (prop: 'scaleX' | 'scaleY' | 'scaleZ' | 'rotationY', delta: number) => {
    if (!selectedMachine) { return; }
    const opts = optionsRef.current;
    const newConfigs = { ...(opts.machineConfigs || {}) };
    const current = newConfigs[selectedMachine] || { x: 0, z: 0, scaleX: 2, scaleY: 1, scaleZ: 2, rotationY: 0 };

    // Type-safe property access (replaces the 'any' cast)
    const propMap: Record<string, keyof typeof current> = {
      scaleX: 'scaleX', scaleY: 'scaleY', scaleZ: 'scaleZ', rotationY: 'rotationY',
    };
    const key = propMap[prop];
    let currentVal = (current[key] as number) ?? 0;
    let newValue = currentVal + delta;
    if (prop.startsWith('scale') && newValue < 0.1) { newValue = 0.1; }

    newConfigs[selectedMachine] = { ...current, [prop]: newValue };
    const mesh = machinesRef.current.get(selectedMachine);
    if (mesh) {
      if (prop === 'rotationY') {
        mesh.rotation.y = newValue;
      } else {
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

  const handleRenameMachine = () => {
    const newName = renameInput.trim();
    if (!newName || !selectedMachine || newName === selectedMachine) { return; }

    const opts = optionsRef.current;
    const oldConfigs = opts.machineConfigs || {};
    const currentConfig = oldConfigs[selectedMachine] || {
      x: 0, z: 0, scaleX: opts.boxWidth || 2, scaleY: opts.boxHeight || 1, scaleZ: opts.boxDepth || 2, rotationY: 0,
    };

    const newConfigs = { ...oldConfigs };
    newConfigs[newName] = { ...currentConfig };
    delete newConfigs[selectedMachine];

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

    statusRef.current.delete(selectedMachine);
    severityRef.current.delete(selectedMachine);
    lotoRef.current.delete(selectedMachine);
    alarmRendererRef.current?.removeMachine(selectedMachine);

    setSelectedMachine(newName);
    setRenameInput(newName);

    if (onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
    }
  };

  const handleAddMachine = () => {
    const name = newMachineName.trim();
    if (!name) { return; }
    const opts = optionsRef.current;
    const newConfigs = { ...(opts.machineConfigs || {}) };
    if (newConfigs[name]) {
      if (newConfigs[name].hidden) { newConfigs[name].hidden = false; }
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
    if (!selectedMachine) { return; }
    const opts = optionsRef.current;
    const newConfigs = { ...(opts.machineConfigs || {}) };
    if (newConfigs[selectedMachine]) { newConfigs[selectedMachine].hidden = true; }
    selectMachine(null);
    if (onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
    }
  };

  const handleAlign = (operation: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'distH' | 'distV') => {
    if (selectedGroup.size < 2) return;
    const opts = optionsRef.current;
    const names = Array.from(selectedGroup);
    const configs = opts.machineConfigs || {};
    
    const opMap = {
      left: alignLeft,
      right: alignRight,
      top: alignTop,
      bottom: alignBottom,
      centerH: alignCenterH,
      distH: distributeHorizontal,
      distV: distributeVertical,
    };
    
    const newConfigs = opMap[operation](names, configs);
    
    for (const name of names) {
      const mesh = machinesRef.current.get(name);
      if (mesh && newConfigs[name]) {
        mesh.position.x = newConfigs[name].x;
        mesh.position.z = newConfigs[name].z;
      }
    }
    
    if (onOptionsChangeRef.current) {
      onOptionsChangeRef.current({ ...opts, machineConfigs: newConfigs });
    }
  };

  return {
    selectedMachine,
    renameInput,
    showAddPopup,
    newMachineName,
    
    // Placement Mode
    placementMode,
    enterPlacementMode,
    exitPlacementMode,
    placeMachineAt,

    // Multi-select & Align
    selectedGroup,
    toggleGroupSelection,
    clearGroupSelection,
    handleGroupMove,
    handleAlign,

    // Anchor Calibration
    anchorMode,
    pendingAnchor,
    startAnchorPlacement,
    cancelAnchorPlacement,
    confirmAnchorPoint,
    onFloorClickedForAnchor,

    // Single-select
    selectMachine,
    setRenameInput,
    setShowAddPopup,
    setNewMachineName,
    handleAdjustProperty,
    handleRenameMachine,
    handleAddMachine,
    handleDeleteSelected,
  };
}



