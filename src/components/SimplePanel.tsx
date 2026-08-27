import React, { useEffect, useRef, useState } from 'react';
import { PanelProps } from '@grafana/data';
import { SimpleOptions, AlarmSeverity } from '../types';
import { css, cx } from '@emotion/css';
import { useStyles2, useTheme2 } from '@grafana/ui';

// Custom Hooks
import { useThreeScene } from '../hooks/useThreeScene';
import { useDataFrameSync } from '../hooks/useDataFrameSync';
import { useMachineLayout } from '../hooks/useMachineLayout';

// Child Components
import { CameraToolbar } from './CameraToolbar';
import { WalkthroughHelp } from './WalkthroughHelp';
import { MachineHUDDrawer } from './MachineHUDDrawer';
import { EditControlPanel } from './EditControlPanel';
import { AddMachineModal } from './AddMachineModal';
import { FloatingLabelsOverlay } from './FloatingLabelsOverlay';

// Utilities
import { parseTooltipFields, escapeHTML } from '../utils/formatUtils';
import { getStatusColor, getStatusLabel } from '../utils/statusUtils';

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

export const SimplePanel: React.FC<Props> = ({ options, data, width, height, onOptionsChange, fieldConfig }) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  // Stable Refs
  const optionsRef = useRef(options);
  const onOptionsChangeRef = useRef(onOptionsChange);
  const fieldConfigRef = useRef(fieldConfig);
  const themeRef = useRef(theme);

  useEffect(() => {
    optionsRef.current = options;
    onOptionsChangeRef.current = onOptionsChange;
    fieldConfigRef.current = fieldConfig;
    themeRef.current = theme;
  });

  // State
  const [hudMachine, setHudMachine] = useState<string | null>(null);

  // Telemetry Maps
  const sqlColumnsRef = useRef<Map<string, Map<string, number>>>(new Map());
  const statusRef = useRef<Map<string, number | undefined>>(new Map());
  const severityRef = useRef<Map<string, AlarmSeverity>>(new Map());
  const lotoRef = useRef<Map<string, boolean>>(new Map());
  const labelsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const tooltipFieldsParsed = parseTooltipFields(options.tooltipFields || '');

  // 1. Layout Management Hook
  const layout = useMachineLayout({
    optionsRef,
    onOptionsChangeRef,
    machinesRef: useRef(new Map()), // initialized below
    labelsRef,
    statusRef,
    severityRef,
    lotoRef,
    alarmRendererRef: useRef(null), // initialized below
  });

  // 2. Three.js Engine & Canvas Hook
  const scene = useThreeScene({
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
    selectMachine: layout.selectMachine,
    setHudMachine,
  });

  // Wire back Three.js refs to layout hook
  layout.handleAdjustProperty = layout.handleAdjustProperty; // bind methods
  const { machinesRef, meshesArrayRef, alarmRendererRef } = scene;

  // 3. DataFrame Data Sync Hook
  useDataFrameSync({
    data,
    options,
    sceneReady: scene.sceneReady,
    sceneRef: scene.sceneRef,
    machinesRef,
    meshesArrayRef,
    labelsRef,
    labelsContainerRef: scene.labelsContainerRef,
    alarmRendererRef,
    sqlColumnsRef,
    statusRef,
    severityRef,
    lotoRef,
    optionsRef,
    onOptionsChangeRef,
    fieldConfigRef,
    themeRef,
  });

  if (scene.webglError) {
    return (
      <div className={styles.wrapper} style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
        <div style={{ color: '#ef4444', padding: 24, textAlign: 'center', border: '1px solid #ef4444', borderRadius: 8 }}>
          <b>WebGL Error</b>
          <p>{escapeHTML(scene.webglError)}</p>
        </div>
      </div>
    );
  }

  const hudData = hudMachine ? sqlColumnsRef.current.get(hudMachine) : undefined;
  const hudStatus = hudMachine ? statusRef.current.get(hudMachine) : undefined;
  const hudSeverity = hudMachine ? severityRef.current.get(hudMachine) ?? 'None' : 'None';
  const hudLOTO = hudMachine ? lotoRef.current.get(hudMachine) ?? false : false;
  const hudColor = getStatusColor(hudStatus, fieldConfig, theme);

  return (
    <div className={cx(styles.wrapper, css`width: ${width}px; height: ${height}px;`)}>
      {/* 3D WebGL Canvas */}
      <div ref={scene.mountRef} />

      {/* 🌐 1. Floating Camera Toolbar */}
      {!options.enableEditMode && (
        <CameraToolbar
          currentMode={scene.camMode}
          onSwitchMode={scene.handleSwitchCamMode}
          onReset={scene.handleResetCamera}
        />
      )}

      {/* 🚶‍♂️ 2. Walkthrough Mode Instructions */}
      <WalkthroughHelp visible={scene.camMode === 'walkthrough' && !options.enableEditMode} />

      {/* 🏷️ 3. Floating 3D Labels Overlay */}
      <FloatingLabelsOverlay
        ref={scene.labelsContainerRef}
        visible={options.showLabels !== false}
      />

      {/* 📊 4. Machine HUD Drawer */}
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

      {/* ➕ 5. Add Machine Button & Modal (Edit Mode) */}
      {options.enableEditMode && (
        <AddMachineModal
          isOpen={layout.showAddPopup}
          machineName={layout.newMachineName}
          onMachineNameChange={layout.setNewMachineName}
          onConfirm={layout.handleAddMachine}
          onCancel={() => { layout.setShowAddPopup(false); layout.setNewMachineName(''); }}
          onOpen={() => layout.setShowAddPopup(true)}
        />
      )}

      {/* 🛠️ Edit Mode Active Badge */}
      {options.enableEditMode && <div className={styles.modeBadge}>🛠️ EDIT MODE ACTIVE</div>}

      {/* 🛠️ 6. Edit Control Panel (Rename, Size, Rotation, Delete) */}
      {options.enableEditMode && (
        <EditControlPanel
          selectedMachine={layout.selectedMachine}
          machineConfig={layout.selectedMachine ? options.machineConfigs?.[layout.selectedMachine] : undefined}
          renameInput={layout.renameInput}
          onRenameInputChange={layout.setRenameInput}
          onRename={layout.handleRenameMachine}
          onAdjustProperty={layout.handleAdjustProperty}
          onDelete={layout.handleDeleteSelected}
        />
      )}
    </div>
  );
};
