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
          { color: 'semi-dark-blue', value: 0 },
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

      // ─── 🌡️ 2. Spatial Floor Heatmap (Industry 4.0) ──────────────────────
      .addBooleanSwitch({
        path: 'enableHeatmap',
        name: 'Enable Floor Heatmap',
        description: 'เปิดแผนที่ความร้อน/ความชื้น 3D ไล่เฉดสีบนพื้นโรงงาน (GLSL Shader)',
        defaultValue: false,
        category: ['🌡️ Spatial Floor Heatmap'],
      })
      .addTextInput({
        path: 'heatmapMetric',
        name: 'Heatmap Metric Column',
        description: 'ชื่อ Column ใน SQL ที่ใช้คำนวณ Heatmap (เช่น temperature, humidity)',
        defaultValue: 'temperature',
        category: ['🌡️ Spatial Floor Heatmap'],
      })
      .addNumberInput({
        path: 'heatmapMin',
        name: 'Min Value (Blue/Cool)',
        description: 'ค่าต่ำสุดสำหรับเฉดสีน้ำเงิน/เขียว (default: 20)',
        defaultValue: 20,
        category: ['🌡️ Spatial Floor Heatmap'],
      })
      .addNumberInput({
        path: 'heatmapMax',
        name: 'Max Value (Red/Hot)',
        description: 'ค่าสูงสุดสำหรับเฉดสีแดง/ร้อน (default: 30)',
        defaultValue: 30,
        category: ['🌡️ Spatial Floor Heatmap'],
      })
      .addNumberInput({
        path: 'heatmapRadius',
        name: 'Heat Dispersion Radius',
        description: 'รัศมีการกระจายตัวของความร้อนในพื้นที่ 3D (default: 10)',
        defaultValue: 10,
        category: ['🌡️ Spatial Floor Heatmap'],
      })

      // ─── 🤖 3. 3D Machine Models (GLTF / GLB) ──────────────────────────────
      .addTextInput({
        path: 'defaultModelUrl',
        name: 'Default 3D Model URL (.glb / .gltf)',
        description: 'URL ของไฟล์ 3D Model เครื่องจักรมาตรฐาน (ถ้าปล่อยว่างจะใช้กล่อง Cube อัตโนมัติ)',
        defaultValue: '',
        category: ['🤖 3D Machine Models'],
      })

      // ─── 🏢 4. Floorplan & Camera ──────────────────────────────────────────
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

      // ─── 🛠️ 5. Edit & Layout Mode ──────────────────────────────────────────
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

      // ─── 📊 6. Data Binding ───────────────────────────────────────────────
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

      // ─── 🚨 7. Visual Effects & Alarms ────────────────────────────────────
      .addBooleanSwitch({
        path: 'enableAlarmEffects',
        name: 'Alarm Strobe Beacon',
        description: 'เปิดไฟไซเรนสีแดง 360° กระพริบเตือนรอบเครื่องเมื่อเกิด Alarm (status=3)',
        defaultValue: true,
        category: ['🚨 Visual Effects & Alarms'],
      });
  });
