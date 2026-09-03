import { escapeHTML, formatTelemetryValue, parseTooltipFields } from './formatUtils';

describe('formatUtils', () => {
  describe('escapeHTML', () => {
    it('escapes HTML special characters', () => {
      expect(escapeHTML('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(escapeHTML("Tom & Jerry's")).toBe('Tom &amp; Jerry&#039;s');
    });

    it('handles null and undefined safely', () => {
      expect(escapeHTML(null)).toBe('');
      expect(escapeHTML(undefined)).toBe('');
      expect(escapeHTML(123)).toBe('123');
    });
  });

  describe('formatTelemetryValue', () => {
    it('formats integers with locale separators', () => {
      expect(formatTelemetryValue(1000)).toBe('1,000');
      expect(formatTelemetryValue(0)).toBe('0');
    });

    it('formats floats to at most 2 decimal places', () => {
      expect(formatTelemetryValue(123.456)).toBe('123.46');
      expect(formatTelemetryValue(50.5)).toBe('50.5');
    });

    it('handles NaN, null, undefined gracefully', () => {
      expect(formatTelemetryValue(NaN)).toBe('—');
      expect(formatTelemetryValue(null)).toBe('—');
      expect(formatTelemetryValue(undefined)).toBe('—');
    });
  });

  describe('parseTooltipFields', () => {
    it('parses comma-separated field definitions with label and unit', () => {
      const input = 'temperature=Temperature:°C, humidity=Humidity:%, pressure=Pressure:kPa';
      const parsed = parseTooltipFields(input);

      expect(parsed).toEqual([
        { column: 'temperature', label: 'Temperature', unit: '°C' },
        { column: 'humidity', label: 'Humidity', unit: '%' },
        { column: 'pressure', label: 'Pressure', unit: 'kPa' },
      ]);
    });

    it('parses field definitions without units', () => {
      const input = 'count=Machine Count, status_code=Status';
      const parsed = parseTooltipFields(input);

      expect(parsed).toEqual([
        { column: 'count', label: 'Machine Count', unit: '' },
        { column: 'status_code', label: 'Status', unit: '' },
      ]);
    });

    it('handles empty string or malformed definitions safely', () => {
      expect(parseTooltipFields('')).toEqual([]);
      expect(parseTooltipFields('   ')).toEqual([]);
      expect(parseTooltipFields('invalid_no_equal')).toEqual([]);
    });
  });
});
