export interface AnchorPoint {
  imageU: number;
  imageV: number;
  worldX: number;
  worldZ: number;
}

export interface CalibrationResult {
  scaleX: number;
  scaleZ: number;
  offsetX: number;
  offsetZ: number;
  isValid: boolean;
}

export function computeCalibration(
  anchorA: AnchorPoint | undefined,
  anchorB: AnchorPoint | undefined
): CalibrationResult {
  if (!anchorA || !anchorB) {
    return { scaleX: 1, scaleZ: 1, offsetX: 0, offsetZ: 0, isValid: false };
  }

  const uvDeltaU = anchorB.imageU - anchorA.imageU;
  const uvDeltaV = anchorB.imageV - anchorA.imageV;

  if (Math.abs(uvDeltaU) < 0.001 || Math.abs(uvDeltaV) < 0.001) {
    return { scaleX: 1, scaleZ: 1, offsetX: 0, offsetZ: 0, isValid: false };
  }

  const worldDeltaX = anchorB.worldX - anchorA.worldX;
  const worldDeltaZ = anchorB.worldZ - anchorA.worldZ;

  const scaleX = worldDeltaX / uvDeltaU;
  const scaleZ = worldDeltaZ / uvDeltaV;

  const offsetX = anchorA.worldX - anchorA.imageU * scaleX;
  const offsetZ = anchorA.worldZ - anchorA.imageV * scaleZ;

  return { scaleX, scaleZ, offsetX, offsetZ, isValid: true };
}

export function uvToWorld(
  u: number, v: number,
  cal: CalibrationResult
): { x: number; z: number } {
  if (!cal.isValid) return { x: 0, z: 0 };
  return {
    x: cal.offsetX + u * cal.scaleX,
    z: cal.offsetZ + v * cal.scaleZ,
  };
}
