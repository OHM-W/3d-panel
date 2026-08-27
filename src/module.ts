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
        ],
      },
    },
  })
  .setPanelOptions((builder) => {
    return builder
      // ─── 🏷️ 1. Labels & Tooltips ──────────────────────────────────────────
      .addBooleanSwitch({
        path: 'showLabels',
        name: '🏷️ Show Floating Labels',
        description: 'เปิด/ปิด ป้ายชื่อและสถานะลอยเหนือกล่อง 3D (ปิดเพื่อไม่ให้บังแปลนโรงงาน)',
        defaultValue: true,
        category: ['🏷️ Labels & Tooltips'],
      })
      .addBooleanSwitch({
        path: 'enableTooltip',
        name: 'Enable Hover Tooltip',
        description: 'แสดงกล่องรายละเอียดเมื่อเลื่อนเมาส์ไปชี้ที่เครื่องจักร',
        defaultValue: true,
        category: ['🏷️ Labels & Tooltips'],
      })
      .addTextInput({
        path: 'tooltipFields',
        name: 'Tooltip Fields Mapping',
        description: 'เช่น temperature=Temp:°C, humidity=Humidity:%',
        defaultValue: '',
        category: ['🏷️ Labels & Tooltips'],
      })
      .addBooleanSwitch({
        path: 'showHUD',
        name: 'Show Machine HUD Drawer',
        description: 'เปิดแผงข้อมูลด่วนรายเครื่องเมื่อคลิกที่ตัวเครื่องจักร',
        defaultValue: true,
        category: ['🏷️ Labels & Tooltips'],
      })
      .addTextInput({
        path: 'dashboardUrlTemplate',
        name: 'Drilldown Dashboard URL',
        description: 'ลิงก์เจาะลึกตอนคลิก (เช่น /d/single-machine?var-machine=${name})',
        defaultValue: '',
        category: ['🏷️ Labels & Tooltips'],
      })

      // ─── 🏢 2. Floorplan & Camera ──────────────────────────────────────────
      .addTextInput({
        path: 'floorplanUrl',
        name: 'Floorplan Image URL',
        description: 'URL รูปแปลนโรงงาน (ปล่อยว่างเพื่อใช้รูปมาตรฐาน)',
        defaultValue: '',
        category: ['🏢 Floorplan & Camera'],
      })
      .addNumberInput({
        path: 'floorSize',
        name: 'Floor Size (Width/Length)',
        description: 'ขนาดพื้นที่โรงงาน (default: 50)',
        defaultValue: 50,
        category: ['🏢 Floorplan & Camera'],
      })
      .addRadio({
        path: 'cameraPreset',
        name: 'Default Camera Angle',
        defaultValue: 'perspective',
        settings: {
          options: [
            { value: 'perspective', label: '3D Isometric View' },
            { value: 'top', label: 'Top-Down 2D Plan' },
          ],
        },
        category: ['🏢 Floorplan & Camera'],
      })

      // ─── 🛠️ 3. Edit & Layout Mode ──────────────────────────────────────────
      .addBooleanSwitch({
        path: 'enableEditMode',
        name: 'Enable Edit Mode',
        description: 'เปิดโหมดจัดวาง: จับลากย้ายกล่อง ปรับขนาด และหมุนองศา',
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
      })
      .addNumberInput({
        path: 'boxWidth',
        name: 'Default Machine Width',
        defaultValue: 2,
        category: ['🛠️ Edit & Layout Mode'],
      })
      .addNumberInput({
        path: 'boxHeight',
        name: 'Default Machine Height',
        defaultValue: 1,
        category: ['🛠️ Edit & Layout Mode'],
      })
      .addNumberInput({
        path: 'boxDepth',
        name: 'Default Machine Depth',
        defaultValue: 2,
        category: ['🛠️ Edit & Layout Mode'],
      })

      // ─── 📊 4. Data Binding ───────────────────────────────────────────────
      .addTextInput({
        path: 'machineNameField',
        name: 'Machine Name Column',
        description: 'ชื่อ Column ใน SQL ที่เป็นชื่อเครื่องจักร (default: machine_name)',
        defaultValue: 'machine_name',
        category: ['📊 Data Binding'],
      })
      .addTextInput({
        path: 'statusFieldName',
        name: 'Status Column',
        description: 'ชื่อ Column ใน SQL ที่เป็นค่าสถานะ (default: status)',
        defaultValue: 'status',
        category: ['📊 Data Binding'],
      })

      // ─── 🚨 5. Visual Effects & Alarms ────────────────────────────────────
      .addBooleanSwitch({
        path: 'enableAlarmEffects',
        name: 'Alarm Strobe Beacon',
        description: 'เปิดไฟไซเรนสีแดง 360° กระพริบเตือนรอบเครื่องเมื่อเกิด Alarm (status=3)',
        defaultValue: true,
        category: ['🚨 Visual Effects & Alarms'],
      });
  });
