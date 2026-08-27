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
}

export interface SimpleOptions {
  // Floorplan & Camera
  floorplanUrl: string;
  floorSize: number;
  cameraPreset: 'perspective' | 'top';

  // Edit Mode
  enableEditMode: boolean;
  enableGrid: boolean;
  gridSize: number;
  enableSnap: boolean;

  // Auto Discovery
  boxWidth: number;
  boxHeight: number;
  boxDepth: number;

  // Data Binding (configurable field names)
  machineNameField: string;   // column ชื่อเครื่อง  (default: machine_name)
  statusFieldName: string;    // column สถานะ        (default: status)

  // Interaction
  enableTooltip: boolean;
  tooltipFields: string;      // e.g. temperature=Temp:C, humidity=Humidity:%
  dashboardUrlTemplate: string;
  showHUD: boolean;
  showLabels?: boolean;           // เปิด Machine Info Drawer เมื่อคลิก

  // Visual Effects
  enableAlarmEffects: boolean; // Strobe PointLight เมื่อ status = 3

  // Machine Configs (Layout)
  machineConfigs: Record<string, MachineLayoutConfig>;
}
