/**
 * 🚦 Utility functions for Machine Status & ISA-101 Threshold Mappings
 */
import { FieldConfigSource, getActiveThreshold } from '@grafana/data';

export function getStatusColor(status: number | undefined, fieldConfig: FieldConfigSource, theme: any): string {
  if (status === undefined || status === null || isNaN(Number(status))) {
    return theme.visualization.getColorByName('semi-dark-gray') || '#64748B';
  }
  if (status === 4) {
    return theme.visualization.getColorByName('semi-dark-blue') || '#38BDF8';
  }
  const steps = fieldConfig?.defaults?.thresholds?.steps ?? [];
  const threshold = getActiveThreshold(Number(status), steps);
  return theme.visualization.getColorByName(threshold.color);
}

export function getStatusLabel(status: number | undefined): string {
  if (status === undefined || status === null || isNaN(Number(status))) return '⚫ Off / No Data';
  if (status === 4) return '🔒 LOTO Maintenance';
  if (status === 3) return '🔴 Critical Alarm';
  if (status === 1) return '🟡 In Production';
  if (status === 2) return '🟢 Running';
  return '⚫ Off / No Data';
}
