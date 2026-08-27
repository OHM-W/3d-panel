// --- Machine Status -------------------------------------------------------
// 0 = NO_DATA (Gray)  -- ไม่มีข้อมูล / เครื่องดับ
// 1 = IDLE    (Amber) -- เครื่องพร้อมแต่ไม่ได้ผลิต
// 2 = RUNNING (Green) -- กำลังผลิต
// 3 = ALARM   (Red)   -- มี Alarm วิกฤต
export type MachineStatus = 0 | 1 | 2 | 3;

export interface MachineLayoutConfig {
  x: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotationY: number;
  hidden?: boolean;
  modelUrl?: string; // Custom GLTF/GLB 3D model for this specific machine
}

export interface SimpleOptions {
  // ─── 🏷️ Labels & Tooltips ───────────────────────────────────────────────
  showLabels?: boolean;
  enableTooltip: boolean;
  tooltipFields: string;
  showHUD: boolean;
  dashboardUrlTemplate: string;

  // ─── 🏢 Floorplan & Camera ──────────────────────────────────────────────
  floorplanUrl: string;
  floorSize: number;
  cameraPreset: 'perspective' | 'top';

  // ─── 🌡️ Spatial Floor Heatmap (Industry 4.0) ────────────────────────────
  enableHeatmap: boolean;
  heatmapMetric: string; // e.g. 'temperature' or 'humidity'
  heatmapMin: number;    // e.g. 20
  heatmapMax: number;    // e.g. 30
  heatmapRadius: number; // Influence radius (default: 10)

  // ─── 🤖 3D Models ────────────────────────────────────────────────────────
  defaultModelUrl: string; // Default .glb / .gltf model URL

  // ─── 🛠️ Edit Mode ────────────────────────────────────────────────────────
  enableEditMode: boolean;
  enableGrid: boolean;
  gridSize: number;
  enableSnap: boolean;
  boxWidth: number;
  boxHeight: number;
  boxDepth: number;

  // ─── 📊 Data Binding ─────────────────────────────────────────────────────
  machineNameField: string;
  statusFieldName: string;

  // ─── 🚨 Visual Effects ───────────────────────────────────────────────────
  enableAlarmEffects: boolean;

  // ─── 📦 Machine Layout Configs ───────────────────────────────────────────
  machineConfigs: Record<string, MachineLayoutConfig>;
}
