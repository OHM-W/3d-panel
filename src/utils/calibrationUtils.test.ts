import { computeCalibration, uvToWorld } from './calibrationUtils';

describe('calibrationUtils', () => {
  describe('computeCalibration', () => {
    it('returns invalid calibration when anchors are missing or undefined', () => {
      const res1 = computeCalibration(undefined, undefined);
      expect(res1.isValid).toBe(false);
      expect(res1.scaleX).toBe(1);
      expect(res1.scaleZ).toBe(1);

      const anchorA = { imageU: 0.1, imageV: 0.1, worldX: 10, worldZ: 10 };
      const res2 = computeCalibration(anchorA, undefined);
      expect(res2.isValid).toBe(false);

      const res3 = computeCalibration(undefined, anchorA);
      expect(res3.isValid).toBe(false);
    });

    it('returns invalid calibration when UV delta is near zero (< 0.001)', () => {
      const anchorA = { imageU: 0.5, imageV: 0.5, worldX: 10, worldZ: 10 };
      const anchorB = { imageU: 0.50005, imageV: 0.5, worldX: 20, worldZ: 20 };

      const res = computeCalibration(anchorA, anchorB);
      expect(res.isValid).toBe(false);
    });

    it('computes scale and offset accurately for valid anchor pairs', () => {
      // U in [0.2, 0.8] -> WorldX in [10, 40] -> DeltaU = 0.6, DeltaX = 30 -> ScaleX = 50, OffsetX = 10 - 0.2 * 50 = 0
      // V in [0.1, 0.6] -> WorldZ in [-20, 30] -> DeltaV = 0.5, DeltaZ = 50 -> ScaleZ = 100, OffsetZ = -20 - 0.1 * 100 = -30
      const anchorA = { imageU: 0.2, imageV: 0.1, worldX: 10, worldZ: -20 };
      const anchorB = { imageU: 0.8, imageV: 0.6, worldX: 40, worldZ: 30 };

      const cal = computeCalibration(anchorA, anchorB);
      expect(cal.isValid).toBe(true);
      expect(cal.scaleX).toBeCloseTo(50);
      expect(cal.scaleZ).toBeCloseTo(100);
      expect(cal.offsetX).toBeCloseTo(0);
      expect(cal.offsetZ).toBeCloseTo(-30);
    });
  });

  describe('uvToWorld', () => {
    it('returns (0,0) when calibration is invalid', () => {
      const invalidCal = { scaleX: 1, scaleZ: 1, offsetX: 0, offsetZ: 0, isValid: false };
      expect(uvToWorld(0.5, 0.5, invalidCal)).toEqual({ x: 0, z: 0 });
    });

    it('maps UV coordinates to world coordinates correctly', () => {
      const cal = { scaleX: 50, scaleZ: 100, offsetX: 5, offsetZ: -10, isValid: true };
      const pos = uvToWorld(0.4, 0.3, cal);

      expect(pos.x).toBeCloseTo(5 + 0.4 * 50); // 25
      expect(pos.z).toBeCloseTo(-10 + 0.3 * 100); // 20
    });
  });
});
