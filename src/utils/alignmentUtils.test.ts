import {
  alignLeft,
  alignRight,
  alignTop,
  alignBottom,
  alignCenterH,
  distributeHorizontal,
  distributeVertical,
} from './alignmentUtils';
import { MachineLayoutConfig } from '../types';

describe('alignmentUtils', () => {
  const baseConfigs: Record<string, MachineLayoutConfig> = {
    'M1': { x: 10, z: 20, scaleX: 2, scaleY: 1, scaleZ: 2, rotationY: 0 },
    'M2': { x: 30, z: 40, scaleX: 4, scaleY: 1, scaleZ: 2, rotationY: 0 },
    'M3': { x: 50, z: 60, scaleX: 2, scaleY: 1, scaleZ: 6, rotationY: 0 },
  };

  describe('alignLeft', () => {
    it('aligns all selected machines to the leftmost bounding edge', () => {
      // M1 left = 10 - 2/2 = 9
      // M2 left = 30 - 4/2 = 28
      // Leftmost edge = 9
      const result = alignLeft(['M1', 'M2'], baseConfigs);
      expect(result['M1'].x).toBe(9 + 1); // 10
      expect(result['M2'].x).toBe(9 + 2); // 11
    });

    it('returns unchanged configs when fewer than 2 machines selected', () => {
      const result = alignLeft(['M1'], baseConfigs);
      expect(result).toEqual(baseConfigs);
    });
  });

  describe('alignRight', () => {
    it('aligns all selected machines to the rightmost bounding edge', () => {
      // M1 right = 10 + 1 = 11
      // M2 right = 30 + 2 = 32
      // Rightmost edge = 32
      const result = alignRight(['M1', 'M2'], baseConfigs);
      expect(result['M1'].x).toBe(32 - 1); // 31
      expect(result['M2'].x).toBe(32 - 2); // 30
    });
  });

  describe('alignTop', () => {
    it('aligns all selected machines to the topmost (lowest Z) edge', () => {
      // M1 top = 20 - 1 = 19
      // M2 top = 40 - 1 = 39
      // Topmost edge = 19
      const result = alignTop(['M1', 'M2'], baseConfigs);
      expect(result['M1'].z).toBe(19 + 1); // 20
      expect(result['M2'].z).toBe(19 + 1); // 20
    });
  });

  describe('alignBottom', () => {
    it('aligns all selected machines to the bottommost (highest Z) edge', () => {
      // M1 bottom = 20 + 1 = 21
      // M2 bottom = 40 + 1 = 41
      // Bottommost edge = 41
      const result = alignBottom(['M1', 'M2'], baseConfigs);
      expect(result['M1'].z).toBe(41 - 1); // 40
      expect(result['M2'].z).toBe(41 - 1); // 40
    });
  });

  describe('alignCenterH', () => {
    it('aligns selected machines to average X position', () => {
      const result = alignCenterH(['M1', 'M2'], baseConfigs);
      // (10 + 30) / 2 = 20
      expect(result['M1'].x).toBe(20);
      expect(result['M2'].x).toBe(20);
    });
  });

  describe('distributeHorizontal', () => {
    it('distributes 3+ machines evenly between outermost edges', () => {
      const configs: Record<string, MachineLayoutConfig> = {
        'A': { x: 0, z: 0, scaleX: 2, scaleY: 1, scaleZ: 2, rotationY: 0 },
        'B': { x: 10, z: 0, scaleX: 2, scaleY: 1, scaleZ: 2, rotationY: 0 },
        'C': { x: 30, z: 0, scaleX: 2, scaleY: 1, scaleZ: 2, rotationY: 0 },
      };
      // A left = -1, C right = 31. Total span = 32. Total width = 6. Gap = (32 - 6) / 2 = 13.
      const result = distributeHorizontal(['A', 'B', 'C'], configs);
      expect(result['A'].x).toBe(0);
      expect(result['B'].x).toBe(15);
      expect(result['C'].x).toBe(30);
    });

    it('distributes machines with non-uniform widths correctly', () => {
      const configs: Record<string, MachineLayoutConfig> = {
        'A': { x: 0, z: 0, scaleX: 2, scaleY: 1, scaleZ: 2, rotationY: 0 },
        'B': { x: 5, z: 0, scaleX: 4, scaleY: 1, scaleZ: 2, rotationY: 0 },
        'C': { x: 30, z: 0, scaleX: 6, scaleY: 1, scaleZ: 2, rotationY: 0 },
      };
      // A: left = -1, right = 1. w = 2
      // C: left = 27, right = 33. w = 6
      // Span = 33 - (-1) = 34. Total width = 2 + 4 + 6 = 12.
      // Gap = (34 - 12) / 2 = 11.
      // A.x = -1 + 1 = 0
      // B.x = -1 + 2 + 11 + 2 = 14
      // C.x = 14 + 2 + 11 + 3 = 30
      const result = distributeHorizontal(['A', 'B', 'C'], configs);
      expect(result['A'].x).toBe(0);
      expect(result['B'].x).toBe(14);
      expect(result['C'].x).toBe(30);
    });

    it('returns unchanged configs when fewer than 3 machines selected', () => {
      const result = distributeHorizontal(['M1', 'M2'], baseConfigs);
      expect(result).toEqual(baseConfigs);
    });
  });

  describe('distributeVertical', () => {
    it('distributes 3+ machines evenly along Z axis', () => {
      const configs: Record<string, MachineLayoutConfig> = {
        'A': { x: 0, z: 0, scaleX: 2, scaleY: 1, scaleZ: 2, rotationY: 0 },
        'B': { x: 0, z: 8, scaleX: 2, scaleY: 1, scaleZ: 2, rotationY: 0 },
        'C': { x: 0, z: 20, scaleX: 2, scaleY: 1, scaleZ: 2, rotationY: 0 },
      };
      const result = distributeVertical(['A', 'B', 'C'], configs);
      expect(result['A'].z).toBe(0);
      expect(result['B'].z).toBe(10);
      expect(result['C'].z).toBe(20);
    });

    it('distributes machines with non-uniform depths correctly', () => {
      const configs: Record<string, MachineLayoutConfig> = {
        'A': { x: 0, z: 0, scaleX: 2, scaleY: 1, scaleZ: 2, rotationY: 0 },
        'B': { x: 0, z: 5, scaleX: 2, scaleY: 1, scaleZ: 4, rotationY: 0 },
        'C': { x: 0, z: 30, scaleX: 2, scaleY: 1, scaleZ: 6, rotationY: 0 },
      };
      // A: top = -1, bottom = 1. d = 2
      // C: top = 27, bottom = 33. d = 6
      // Span = 34. Total depth = 12. Gap = 11.
      // A.z = 0, B.z = 14, C.z = 30
      const result = distributeVertical(['A', 'B', 'C'], configs);
      expect(result['A'].z).toBe(0);
      expect(result['B'].z).toBe(14);
      expect(result['C'].z).toBe(30);
    });

    it('returns unchanged configs when fewer than 3 machines selected', () => {
      const result = distributeVertical(['M1', 'M2'], baseConfigs);
      expect(result).toEqual(baseConfigs);
    });
  });

  describe('Defensive Edge Cases', () => {
    it('handles null, undefined, or empty inputs gracefully without throwing', () => {
      expect(alignLeft(null as any, null as any)).toEqual({});
      expect(alignRight(undefined as any, undefined as any)).toEqual({});
      expect(alignTop([], {})).toEqual({});
      expect(alignBottom([], {})).toEqual({});
      expect(alignCenterH([], {})).toEqual({});
      expect(distributeHorizontal([], {})).toEqual({});
      expect(distributeVertical([], {})).toEqual({});
    });

    it('ignores machine names not found in configs', () => {
      const result = alignLeft(['M1', 'NonExistent'], baseConfigs);
      // Only 1 valid machine found, so configs are returned unchanged
      expect(result).toEqual(baseConfigs);
    });
  });
});
