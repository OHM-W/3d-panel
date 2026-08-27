// ─── Machine Status & ISA-101 Standards ─────────────────────────────────────
// 0 = NO_DATA / OFF (Gray)
// 1 = IDLE / IN_PRODUCTION (Amber)
// 2 = RUNNING (Green)
// 3 = ALARM (Red)
// 4 = LOTO / MAINTENANCE (Blue/Lock)
export type MachineStatus = 0 | 1 | 2 | 3 | 4;

export type AlarmSeverity = 'Critical' | 'Major' | 'Minor' | 'None';

export type CameraMode = 'perspective' | 'top' | 'walkthrough';

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
  // ─── 🏷️ 1. Labels, ISA-101 Alarms & LOTO ─────────────────────────────────
  showLabels: boolean;             // เปิด/ปิด ป้ายชื่อลอยเหนือเครื่อง
  enableISA101Alarms: boolean;     // แสดงป้ายเตือนภัย ISA-101 (Critical/Major/Minor)
  enableLOTO: boolean;             // แสดงป้ายแม่กุญแจ Lockout/Tagout ตอนซ่อมบำรุง
  enableTooltip: boolean;          // แสดง Tooltip ตอน Hover เมาส์
  showHUD: boolean;                // เปิด Machine HUD Drawer ตอนคลิกเครื่อง
  tooltipFields: string;           // e.g. temperature=Temp:°C, humidity=Humidity:%
  dashboardUrlTemplate: string;    // ลิงก์เจาะลึกตอนคลิก

  // ─── 🎮 2. Camera & Navigation ───────────────────────────────────────────
  cameraPreset: CameraMode;        // 'perspective' | 'top' | 'walkthrough'

  // ─── 🏢 3. Floorplan Plan ────────────────────────────────────────────────
  floorplanUrl: string;            // URL รูปแปลนโรงงาน (ว่าง = พื้นสีทึบ)
  floorSize: number;               // ขนาดพื้นที่โรงงาน (default: 50)

  // ─── ⚡ 4. Real-time & Data Binding ──────────────────────────────────────
  machineNameField: string;        // column ชื่อเครื่อง (default: machine_name)
  statusFieldName: string;         // column สถานะ      (default: status)
  severityFieldName: string;       // column ระดับ Alarm (default: severity)
  lotoFieldName: string;           // column สถานะ LOTO  (default: is_loto)
  enableLiveStreaming: boolean;    // สตรีมข้อมูล Real-time ผ่าน WebSocket

  // ─── 🛠️ 5. Edit & Layout Mode ────────────────────────────────────────────
  enableEditMode: boolean;
  enableGrid: boolean;
  gridSize: number;
  enableSnap: boolean;
  boxWidth: number;
  boxHeight: number;
  boxDepth: number;

  // ─── 📦 Machine Layout Configs ───────────────────────────────────────────
  machineConfigs: Record<string, MachineLayoutConfig>;
}
