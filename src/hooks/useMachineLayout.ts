import { useState, MutableRefObject } from 'react';
import * as THREE from 'three';
import { SimpleOptions } from '../types';
import { AlarmRenderer } from '../engine/AlarmRenderer';

interface UseMachineLayoutParams {
  optionsRef: MutableRefObject<SimpleOptions>;
  onOptionsChangeRef: MutableRefObject<((options: SimpleOptions) => void) | undefined>;
  machinesRef: MutableRefObject<Map<string, THREE.Mesh>>;
  labelsRef: MutableRefObject<Map<string, HTMLDivElement>>;
  statusRef: MutableRefObject<Map<string, number | undefined>>;
  severityRef: MutableRefObject<Map<string, any>>;
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

  const selectMachine = (name: string | null) => {
    setSelectedMachine(name);
    setRenameInput(name || '');
  };

  const handleAdjustProperty = (prop: 'scaleX' | 'scaleY' | 'scaleZ' | 'rotationY', delta: number) => {
    if (!selectedMachine) return;
    const opts = optionsRef.current;
    const newConfigs = { ...(opts.machineConfigs || {}) };
    const current = newConfigs[selectedMachine] || { x: 0, z: 0, scaleX: 2, scaleY: 1, scaleZ: 2, rotationY: 0 };
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

  const handleRenameMachine = () => {
    const newName = renameInput.trim();
    if (!newName || !selectedMachine || newName === selectedMachine) return;

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

  return {
    selectedMachine,
    renameInput,
    showAddPopup,
    newMachineName,
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
