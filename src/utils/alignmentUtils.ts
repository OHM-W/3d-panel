import { MachineLayoutConfig } from '../types';

type AlignConfigs = Record<string, MachineLayoutConfig>;

function getBounds(name: string, configs: AlignConfigs) {
  const cfg = configs[name];
  return {
    left:   cfg.x - (cfg.scaleX || 2) / 2,
    right:  cfg.x + (cfg.scaleX || 2) / 2,
    top:    cfg.z - (cfg.scaleZ || 2) / 2,
    bottom: cfg.z + (cfg.scaleZ || 2) / 2,
    cx: cfg.x,
    cz: cfg.z,
    w: cfg.scaleX || 2,
    d: cfg.scaleZ || 2,
  };
}

export function alignLeft(selectedNames: string[], configs: AlignConfigs): AlignConfigs {
  if (selectedNames.length < 2) return configs;
  const newConfigs = { ...configs };
  const leftmost = Math.min(...selectedNames.map(n => getBounds(n, configs).left));
  for (const name of selectedNames) {
    const b = getBounds(name, configs);
    newConfigs[name] = { ...configs[name], x: leftmost + b.w / 2 };
  }
  return newConfigs;
}

export function alignRight(selectedNames: string[], configs: AlignConfigs): AlignConfigs {
  if (selectedNames.length < 2) return configs;
  const newConfigs = { ...configs };
  const rightmost = Math.max(...selectedNames.map(n => getBounds(n, configs).right));
  for (const name of selectedNames) {
    const b = getBounds(name, configs);
    newConfigs[name] = { ...configs[name], x: rightmost - b.w / 2 };
  }
  return newConfigs;
}

export function alignTop(selectedNames: string[], configs: AlignConfigs): AlignConfigs {
  if (selectedNames.length < 2) return configs;
  const newConfigs = { ...configs };
  const topmost = Math.min(...selectedNames.map(n => getBounds(n, configs).top));
  for (const name of selectedNames) {
    const b = getBounds(name, configs);
    newConfigs[name] = { ...configs[name], z: topmost + b.d / 2 };
  }
  return newConfigs;
}

export function alignBottom(selectedNames: string[], configs: AlignConfigs): AlignConfigs {
  if (selectedNames.length < 2) return configs;
  const newConfigs = { ...configs };
  const bottommost = Math.max(...selectedNames.map(n => getBounds(n, configs).bottom));
  for (const name of selectedNames) {
    const b = getBounds(name, configs);
    newConfigs[name] = { ...configs[name], z: bottommost - b.d / 2 };
  }
  return newConfigs;
}

export function alignCenterH(selectedNames: string[], configs: AlignConfigs): AlignConfigs {
  if (selectedNames.length < 2) return configs;
  const newConfigs = { ...configs };
  const avgX = selectedNames.reduce((sum, n) => sum + configs[n].x, 0) / selectedNames.length;
  for (const name of selectedNames) {
    newConfigs[name] = { ...configs[name], x: avgX };
  }
  return newConfigs;
}

export function distributeHorizontal(selectedNames: string[], configs: AlignConfigs): AlignConfigs {
  if (selectedNames.length < 3) return configs;
  const newConfigs = { ...configs };
  const sorted = [...selectedNames].sort((a, b) => configs[a].x - configs[b].x);
  
  const firstB = getBounds(sorted[0], configs);
  const lastB = getBounds(sorted[sorted.length - 1], configs);
  
  const leftEdge = firstB.left;
  const rightEdge = lastB.right;
  const totalWidth = sorted.reduce((sum, n) => sum + (configs[n].scaleX || 2), 0);
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
  if (selectedNames.length < 3) return configs;
  const newConfigs = { ...configs };
  const sorted = [...selectedNames].sort((a, b) => configs[a].z - configs[b].z);
  
  const firstB = getBounds(sorted[0], configs);
  const lastB = getBounds(sorted[sorted.length - 1], configs);
  
  const topEdge = firstB.top;
  const bottomEdge = lastB.bottom;
  const totalDepth = sorted.reduce((sum, n) => sum + (configs[n].scaleZ || 2), 0);
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
