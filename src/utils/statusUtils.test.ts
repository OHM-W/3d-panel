import { getStatusColor, getStatusLabel } from './statusUtils';
import { FieldConfigSource, GrafanaTheme2 } from '@grafana/data';

describe('statusUtils', () => {
  const mockTheme = {
    visualization: {
      getColorByName: (name: string) => {
        if (name === 'semi-dark-gray') return '#64748B';
        if (name === 'semi-dark-blue') return '#38BDF8';
        if (name === 'red') return '#EF4444';
        if (name === 'green') return '#22C55E';
        return name;
      },
    },
  } as unknown as GrafanaTheme2;

  const mockFieldConfig: FieldConfigSource = {
    defaults: {
      thresholds: {
        mode: 'absolute' as any,
        steps: [
          { value: 0, color: 'semi-dark-gray' },
          { value: 1, color: 'green' },
          { value: 3, color: 'red' },
        ],
      },
    },
    overrides: [],
  };

  describe('getStatusColor', () => {
    it('returns gray fallback when status is undefined, null, or NaN', () => {
      expect(getStatusColor(undefined, mockFieldConfig, mockTheme)).toBe('#64748B');
      expect(getStatusColor(null as any, mockFieldConfig, mockTheme)).toBe('#64748B');
      expect(getStatusColor(NaN, mockFieldConfig, mockTheme)).toBe('#64748B');
    });

    it('returns blue color for LOTO maintenance status (4)', () => {
      expect(getStatusColor(4, mockFieldConfig, mockTheme)).toBe('#38BDF8');
    });

    it('resolves active threshold color for normal status values', () => {
      expect(getStatusColor(1, mockFieldConfig, mockTheme)).toBe('#22C55E');
      expect(getStatusColor(3, mockFieldConfig, mockTheme)).toBe('#EF4444');
    });
  });

  describe('getStatusLabel', () => {
    it('returns Off / No Data for missing or invalid status', () => {
      expect(getStatusLabel(undefined)).toBe('⚫ Off / No Data');
      expect(getStatusLabel(null as any)).toBe('⚫ Off / No Data');
      expect(getStatusLabel(NaN)).toBe('⚫ Off / No Data');
      expect(getStatusLabel(99)).toBe('⚫ Off / No Data');
    });

    it('returns standard status labels for recognized codes', () => {
      expect(getStatusLabel(1)).toBe('🟡 In Production');
      expect(getStatusLabel(2)).toBe('🟢 Running');
      expect(getStatusLabel(3)).toBe('🔴 Critical Alarm');
      expect(getStatusLabel(4)).toBe('🔒 LOTO Maintenance');
    });
  });
});
