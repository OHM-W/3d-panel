import { FieldConfigProperty, PanelPlugin, ThresholdsMode } from '@grafana/data';
import { SimpleOptions } from './types';
import { SimplePanel } from './components/SimplePanel';

export const plugin = new PanelPlugin<SimpleOptions>(SimplePanel)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Thresholds]: {},
    },
    useCustomConfig: (_builder) => {},
    defaults: {
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { color: 'semi-dark-gray', value: null as unknown as number },
          { color: 'semi-dark-yellow', value: 1 },
          { color: 'semi-dark-green', value: 2 },
          { color: 'dark-red', value: 3 },
          { color: 'semi-dark-blue', value: 4 }, // LOTO / Maintenance
        ],
      },
    },
  })
  .setPanelOptions((builder) => {
    return builder
      // ─── 🏷️ 1. Labels, ISA-101 Alarms & LOTO ──────────────────────────────
      .addBooleanSwitch({
        path: 'showLabels',
        name: '🏷️ Show Floating Labels',
        description: 'เปิด/ปิด ป้ายชื่อและสถานะลอยเหนือกล่อง 3D',
        defaultValue: true,
        category: ['🏷️ Labels, ISA-101 & LOTO'],
      })
      .addBooleanSwitch({
        path: 'enableISA101Alarms',
        name: '🚨 Show ISA-101 Alarm Badges',
        description: 'แสดงป้ายเตือนภัยสามเหลี่ยม Critical / Major ตามมาตรฐาน ISA-101',
        defaultValue: true,
        category: ['🏷️ Labels, ISA-101 & LOTO'],
      })
      .addBooleanSwitch({
        path: 'enableLOTO',
        name: '🔒 Show LOTO Maintenance Badges',
        description: 'แสดงป้ายแม่กุญแจและกรอบนิรภัย Lockout / Tagout เมื่อเครื่องซ่อมบำรุง',
        defaultValue: true,
        category: ['🏷️ Labels, ISA-101 & LOTO'],
      })
      .addBooleanSwitch({
        path: 'enableTooltip',
        name: 'Enable Hover Tooltip',
        description: 'แสดงกล่องรายละเอียดเมื่อเลื่อนเมาส์ชี้ตัวเครื่องจักร',
        defaultValue: true,
        category: ['🏷️ Labels, ISA-101 & LOTO'],
      })
      .addBooleanSwitch({
        path: 'showHUD',
        name: 'Show Machine HUD Drawer',
        description: 'เปิดแผงข้อมูลด่วนรายเครื่องเมื่อคลิกที่ตัวเครื่องจักร',
        defaultValue: true,
        category: ['🏷️ Labels, ISA-101 & LOTO'],
      })
      .addTextInput({
        path: 'tooltipFields',
        name: 'Tooltip Fields Mapping',
        description: 'เช่น temperature=Temp:°C, humidity=Humidity:%',
        defaultValue: '',
        category: ['🏷️ Labels, ISA-101 & LOTO'],
      })
      .addTextInput({
        path: 'dashboardUrlTemplate',
        name: 'Drilldown Dashboard URL',
        description: 'ลิงก์ตอนคลิก (ใช้ ${name} แทนชื่อเครื่อง)',
        defaultValue: '',
        category: ['🏷️ Labels, ISA-101 & LOTO'],
      })

      // ─── 🎮 2. Camera & Navigation ─────────────────────────────────────────
      .addRadio({
        path: 'cameraPreset',
        name: '🎮 Camera Navigation Mode',
        description: 'เลือกโหมดมุมกล้อง: 3D Orbit, 2D Top-Down หรือ เดินสำรวจด้วย WASD',
        defaultValue: 'perspective',
        settings: {
          options: [
            { value: 'perspective', label: '🌐 3D Orbit View' },
            { value: 'top', label: '📐 2D Top-Down View' },
            { value: 'walkthrough', label: '🚶‍♂️ WASD Walkthrough' },
          ],
        },
        category: ['🎮 Camera & Navigation'],
      })

      // ─── 🏢 3. Floorplan Plan ──────────────────────────────────────────────
      .addTextInput({
        path: 'floorplanUrl',
        name: 'Floorplan Image URL',
        description: 'URL รูปแปลนโรงงาน (ถ้าปล่อยว่างจะเป็นพื้นสีทึบเรียบๆ)',
        defaultValue: '',
        category: ['🏢 Floorplan Plan'],
      })
      .addNumberInput({
        path: 'floorSize',
        name: 'Floor Size',
        description: 'ขนาดพื้นที่โรงงาน (default: 50)',
        defaultValue: 50,
        category: ['🏢 Floorplan Plan'],
      })

      // ─── ⚡ 4. Real-time & Data Binding ────────────────────────────────────
      .addTextInput({
        path: 'machineNameField',
        name: 'Machine Name Column',
        description: 'ชื่อ Column ใน SQL ของชื่อเครื่องจักร (default: machine_name)',
        defaultValue: 'machine_name',
        category: ['⚡ Real-time & Data Binding'],
      })
      .addTextInput({
        path: 'statusFieldName',
        name: 'Status Column',
        description: 'ชื่อ Column ใน SQL ของสถานะ (default: status)',
        defaultValue: 'status',
        category: ['⚡ Real-time & Data Binding'],
      })
      .addTextInput({
        path: 'severityFieldName',
        name: 'Severity Column',
        description: 'ชื่อ Column ใน SQL ของความรุนแรง Alarm (default: severity)',
        defaultValue: 'severity',
        category: ['⚡ Real-time & Data Binding'],
      })
      .addTextInput({
        path: 'lotoFieldName',
        name: 'LOTO Column',
        description: 'ชื่อ Column ใน SQL ของสถานะ LOTO/ซ่อมบำรุง (default: is_loto)',
        defaultValue: 'is_loto',
        category: ['⚡ Real-time & Data Binding'],
      })
      .addBooleanSwitch({
        path: 'enableLiveStreaming',
        name: '⚡ Enable Live Stream',
        description: 'เปิดรับข้อมูล Real-time Sub-second Streaming',
        defaultValue: true,
        category: ['⚡ Real-time & Data Binding'],
      })

      // ─── 🛠️ 5. Edit & Layout Mode ──────────────────────────────────────────
      .addBooleanSwitch({
        path: 'enableEditMode',
        name: 'Enable Edit Mode',
        description: 'เปิดโหมดจัดวาง: จับลากย้ายกล่อง ปรับขนาด และหมุน',
        defaultValue: false,
        category: ['🛠️ Edit & Layout Mode'],
      })
      .addBooleanSwitch({
        path: 'enableGrid',
        name: 'Show Grid Floor',
        defaultValue: true,
        category: ['🛠️ Edit & Layout Mode'],
      })
      .addNumberInput({
        path: 'gridSize',
        name: 'Grid Spacing',
        defaultValue: 1,
        category: ['🛠️ Edit & Layout Mode'],
      })
      .addBooleanSwitch({
        path: 'enableSnap',
        name: 'Snap to Grid',
        defaultValue: false,
        category: ['🛠️ Edit & Layout Mode'],
      });
  });
