type SeriesSize = 'sm' | 'md' | 'lg';

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
  text: string;
  showSeriesCount: boolean;
  seriesCountSize: SeriesSize;
  floorplanUrl: string;

  // ─── Edit Mode ───
  enableEditMode: boolean;
  enableGrid: boolean;
  gridSize: number;
  enableSnap: boolean;

  // ─── Auto Discovery ───
  boxWidth: number;
  boxHeight: number;
  boxDepth: number;

  colorRunning: string;     
  colorProduction: string;  
  colorAlarm: string;       
  colorOff: string;         

  enableTooltip: boolean;
  tooltipFields: string;
  dashboardUrlTemplate: string;
  cameraPreset: 'perspective' | 'top';

  machineConfigs: {
    [machineName: string]: MachineLayoutConfig;
  };
}
