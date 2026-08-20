import { PanelPlugin } from '@grafana/data';
import { SimpleOptions } from './types';
import { SimplePanel } from './components/SimplePanel';

export const plugin = new PanelPlugin<SimpleOptions>(SimplePanel).setPanelOptions((builder) => {
  return builder
    .addTextInput({
      path: 'floorplanUrl',
      name: 'Floorplan URL',
      description: 'URL รูปแปลนโรงงาน (ปล่อยว่างเพื่อใช้รูป default)',
      defaultValue: '',
      category: ['🖼️ Floorplan & Camera'],
    })
    .addRadio({
      path: 'cameraPreset',
      name: 'Camera View',
      defaultValue: 'perspective',
      settings: {
        options: [
          { value: 'perspective', label: '🎥 3D View' },
          { value: 'top', label: '🗺️ Top-Down' },
        ],
      },
      category: ['🖼️ Floorplan & Camera'],
    })

    .addBooleanSwitch({
      path: 'enableEditMode',
      name: '🛠️ Enable Edit Mode',
      description: 'เปิดเพื่อจับลากย้ายกล่อง และปรับขนาด/หมุนผ่านแผงควบคุมบนหน้าจอ',
      defaultValue: false,
      category: ['🛠️ Edit Mode'],
    })
    .addBooleanSwitch({
      path: 'enableGrid',
      name: '📏 Show Grid Lines',
      defaultValue: true,
      category: ['🛠️ Edit Mode'],
    })
    .addNumberInput({
      path: 'gridSize',
      name: 'Grid Size',
      defaultValue: 1,
      category: ['🛠️ Edit Mode'],
    })
    .addBooleanSwitch({
      path: 'enableSnap',
      name: '🧲 Enable Grid Snap',
      defaultValue: false,
      category: ['🛠️ Edit Mode'],
    })

    .addNumberInput({
      path: 'boxWidth',
      name: 'Default Width (New Auto-Discovery)',
      defaultValue: 2,
      category: ['📦 Auto-Discovery Setup'],
    })
    .addNumberInput({
      path: 'boxHeight',
      name: 'Default Height (New Auto-Discovery)',
      defaultValue: 1,
      category: ['📦 Auto-Discovery Setup'],
    })
    .addNumberInput({
      path: 'boxDepth',
      name: 'Default Depth (New Auto-Discovery)',
      defaultValue: 2,
      category: ['📦 Auto-Discovery Setup'],
    })

    .addColorPicker({
      path: 'colorRunning',
      name: '🟢 Running (status = 1)',
      defaultValue: '#00cc44',
      category: ['🎨 Colors'],
    })
    .addColorPicker({
      path: 'colorProduction',
      name: '🟡 In Production (status = 2)',
      defaultValue: '#ffaa00',
      category: ['🎨 Colors'],
    })
    .addColorPicker({
      path: 'colorAlarm',
      name: '🔴 Alarm (status = 0)',
      defaultValue: '#ff2222',
      category: ['🎨 Colors'],
    })
    .addColorPicker({
      path: 'colorOff',
      name: '⚫ Off / No Data',
      defaultValue: '#1a1a2e',
      category: ['🎨 Colors'],
    })

    .addBooleanSwitch({
      path: 'enableTooltip',
      name: '💬 Enable Tooltip',
      defaultValue: true,
      category: ['💬 Tooltip & Click Actions'],
    })
    .addTextInput({
      path: 'tooltipFields',
      name: 'Tooltip Fields',
      description: 'เช่น temperature=อุณหภูมิ:°C, humidity=ความชื้น:%',
      defaultValue: '',
      category: ['💬 Tooltip & Click Actions'],
    })
    .addTextInput({
      path: 'dashboardUrlTemplate',
      name: 'Click → Dashboard URL',
      description: 'ลิงก์ตอนคลิกกล่อง (ทำงานเมื่อล็อค Edit Mode) ใช้ ${name} แทนชื่อ',
      defaultValue: '',
      category: ['💬 Tooltip & Click Actions'],
    });
});
