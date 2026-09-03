import { normalizeKey, buildAliasLookup, resolveDbToModel } from './matchingUtils';

describe('matchingUtils', () => {
  describe('normalizeKey', () => {
    it('normalizes machine names by lowercasing and stripping whitespace, dashes, and underscores', () => {
      expect(normalizeKey('LDI-001')).toBe('ldi001');
      expect(normalizeKey('ldi_001')).toBe('ldi001');
      expect(normalizeKey('LDI 001')).toBe('ldi001');
      expect(normalizeKey('  LDI--001_A  ')).toBe('ldi001a');
    });

    it('applies regex extraction before normalization when regex provided', () => {
      expect(normalizeKey('factoryA_ldi_001_status', '.*_(ldi_\\d+)_.*')).toBe('ldi001');
    });
  });

  describe('buildAliasLookup', () => {
    it('parses CSV aliases into exact and normalized key lookup mappings', () => {
      const csv = 'LDI-001=siteA_ldi_01, LDI-002=SMT_002';
      const map = buildAliasLookup(csv);

      expect(map.get('siteA_ldi_01')).toBe('LDI-001');
      expect(map.get('sitealdi01')).toBe('LDI-001');
      expect(map.get('SMT_002')).toBe('LDI-002');
      expect(map.get('smt002')).toBe('LDI-002');
    });

    it('handles empty or malformed CSV safely', () => {
      expect(buildAliasLookup('').size).toBe(0);
      expect(buildAliasLookup('   ').size).toBe(0);
      expect(buildAliasLookup('invalid_no_equal, =no_model, no_db=').size).toBe(0);
    });
  });

  describe('resolveDbToModel', () => {
    const lookup = buildAliasLookup('LDI-001=siteA_ldi_01, LDI-002=SMT_002');

    it('resolves exact DB matches', () => {
      expect(resolveDbToModel('siteA_ldi_01', lookup)).toBe('LDI-001');
    });

    it('resolves fuzzy/normalized matches', () => {
      expect(resolveDbToModel('SITEA-LDI-01', lookup)).toBe('LDI-001');
    });

    it('resolves with regex extraction', () => {
      expect(resolveDbToModel('raw_siteA_ldi_01_metrics', lookup, 'raw_(.*)_metrics')).toBe('LDI-001');
    });

    it('falls back to raw DB identifier when unmatched', () => {
      expect(resolveDbToModel('Unknown_Machine_99', lookup)).toBe('Unknown_Machine_99');
    });
  });
});
