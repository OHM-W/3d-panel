import { MachineLayoutConfig } from '../types';

type AlignConfigs = Record<string, MachineLayoutConfig>;

function getBounds(name: string, configs: AlignConfigs) {
  const cfg = configs[name] || { x: 0, z: 0, scaleX: 2, scaleY: 1, scaleZ: 2, rotationY: 0 };
  const w = typeof cfg.scaleX === 'number' && Number.isFinite(cfg.scaleX) ? cfg.scaleX : 2;
  const d = typeof cfg.scaleZ === 'number' && Number.isFinite(cfg.scaleZ) ? cfg.scaleZ : 2;
  const x = typeof cfg.x === 'number' && Number.isFinite(cfg.x) ? cfg.x : 0;
  const z = typeof cfg.z === 'number' && Number.isFinite(cfg.z) ? cfg.z : 0;

  return {
    left:   x - w / 2,
    right:  x + w / 2,
    top:    z - d / 2,
    bottom: z + d / 2,
    cx: x,
    cz: z,
    w,
    d,
  };
}

export function alignLeft(selectedNames: string[], configs: AlignConfigs): AlignConfigs {
  if (!selectedNames || !configs) return configs || {};
  const validNames = selectedNames.filter(n => configs[n]);
  if (validNames.length < 2) return configs;
  const newConfigs = { ...configs };
  const leftmost = Math.min(...validNames.map(n => getBounds(n, configs).left));
  for (const name of validNames) {
    const b = getBounds(name, configs);
    newConfigs[name] = { ...configs[name], x: leftmost + b.w / 2 };
  }
  return newConfigs;
}

export function alignRight(selectedNames: string[], configs: AlignConfigs): AlignConfigs {
  if (!selectedNames || !configs) return configs || {};
  const validNames = selectedNames.filter(n => configs[n]);
  if (validNames.length < 2) return configs;
  const newConfigs = { ...configs };
  const rightmost = Math.max(...validNames.map(n => getBounds(n, configs).right));
  for (const name of validNames) {
    const b = getBounds(name, configs);
    newConfigs[name] = { ...configs[name], x: rightmost - b.w / 2 };
  }
  return newConfigs;
}

export function alignTop(selectedNames: string[], configs: AlignConfigs): AlignConfigs {
  if (!selectedNames || !configs) return configs || {};
  const validNames = selectedNames.filter(n => configs[n]);
  if (validNames.length < 2) return configs;
  const newConfigs = { ...configs };
  const topmost = Math.min(...validNames.map(n => getBounds(n, configs).top));
  for (const name of validNames) {
    const b = getBounds(name, configs);
    newConfigs[name] = { ...configs[name], z: topmost + b.d / 2 };
  }
  return newConfigs;
}

export function alignBottom(selectedNames: string[], configs: AlignConfigs): AlignConfigs {
  if (!selectedNames || !configs) return configs || {};
  const validNames = selectedNames.filter(n => configs[n]);
  if (validNames.length < 2) return configs;
  const newConfigs = { ...configs };
  const bottommost = Math.max(...validNames.map(n => getBounds(n, configs).bottom));
  for (const name of validNames) {
    const b = getBounds(name, configs);
    newConfigs[name] = { ...configs[name], z: bottommost - b.d / 2 };
  }
  return newConfigs;
}

export function alignCenterH(selectedNames: string[], configs: AlignConfigs): AlignConfigs {
  if (!selectedNames || !configs) return configs || {};
  const validNames = selectedNames.filter(n => configs[n]);
  if (validNames.length < 2) return configs;
  const newConfigs = { ...configs };
  const avgX = validNames.reduce((sum, n) => sum + configs[n].x, 0) / validNames.length;
  for (const name of validNames) {
    newConfigs[name] = { ...configs[name], x: avgX };
  }
  return newConfigs;
}

export function distributeHorizontal(selectedNames: string[], configs: AlignConfigs): AlignConfigs {
  if (!selectedNames || !configs) return configs || {};
  const validNames = selectedNames.filter(n => configs[n]);
  if (validNames.length < 3) return configs;
  const newConfigs = { ...configs };
  const sorted = [...validNames].sort((a, b) => configs[a].x - configs[b].x);
  
  const firstB = getBounds(sorted[0], configs);
  const lastB = getBounds(sorted[sorted.length - 1], configs);
  
  const leftEdge = firstB.left;
  const rightEdge = lastB.right;
  const totalWidth = sorted.reduce((sum, n) => sum + getBounds(n, configs).w, 0);
  let gap = (rightEdge - leftEdge - totalWidth) / (sorted.length - 1);
  if (gap < 0) gap = 0;
  
  let currentX = leftEdge;
  for (const name of sorted) {
    const b = getBounds(name, configs);
    newConfigs[name] = { ...configs[name], x: currentX + b.w / 2 };
    currentX += b.w + gap;
  }
  return newConfigs;
}

export function distributeVertical(selectedNames: string[], configs: AlignConfigs): AlignConfigs {
  if (!selectedNames || !configs) return configs || {};
  const validNames = selectedNames.filter(n => configs[n]);
  if (validNames.length < 3) return configs;
  const newConfigs = { ...configs };
  const sorted = [...validNames].sort((a, b) => configs[a].z - configs[b].z);
  
  const firstB = getBounds(sorted[0], configs);
  const lastB = getBounds(sorted[sorted.length - 1], configs);
  
  const topEdge = firstB.top;
  const bottomEdge = lastB.bottom;
  const totalDepth = sorted.reduce((sum, n) => sum + getBounds(n, configs).d, 0);
  let gap = (bottomEdge - topEdge - totalDepth) / (sorted.length - 1);
  if (gap < 0) gap = 0;
  
  let currentZ = topEdge;
  for (const name of sorted) {
    const b = getBounds(name, configs);
    newConfigs[name] = { ...configs[name], z: currentZ + b.d / 2 };
    currentZ += b.d + gap;
  }
  return newConfigs;
}
