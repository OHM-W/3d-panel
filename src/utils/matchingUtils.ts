/**
 * matchingUtils.ts
 * DB ↔ 3D Model Name Matching Pipeline
 *
 * Pipeline (in order):
 *   1. Direct alias lookup (CSV: "LDI-001=siteA_ldi_01")
 *   2. Normalized alias lookup (strip -_space, lowercase)
 *   3. Regex extraction then normalize
 *   4. Fallback: return original DB name
 */

/**
 * Normalize a key by stripping dashes, underscores, spaces
 * and lowercasing — so "LDI-001", "ldi_001", "LDI 001" all → "ldi001"
 * Optionally apply a regex capture group first.
 */
export function normalizeKey(name: string, regexPattern?: string): string {
  let normalized = name;
  if (regexPattern) {
    try {
      const rx = new RegExp(regexPattern, 'i');
      const match = name.match(rx);
      // Use first capture group if present, otherwise full match
      if (match) {
        normalized = match[1] ?? match[0];
      }
    } catch {
      console.warn('[matchingUtils] Invalid regex pattern:', regexPattern);
    }
  }
  return normalized.replace(/[-\s_]/g, '').toLowerCase();
}

/**
 * Build a reverse-lookup Map from the CSV alias string.
 * CSV format: "ModelName=dbName1, ModelName2=dbName2"
 * e.g. "LDI-001=siteA_ldi_01, LDI-002=SMT_002"
 *
 * The Map keys are both the raw dbName AND the normalized dbName,
 * both pointing to the modelName. This way both exact and fuzzy
 * lookups succeed in a single Map.get() call.
 */
export function buildAliasLookup(aliasesCsv: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!aliasesCsv?.trim()) { return map; }

  aliasesCsv.split(',').forEach((pair) => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) { return; }
    const modelName = pair.slice(0, eqIdx).trim();
    const dbName = pair.slice(eqIdx + 1).trim();
    if (!modelName || !dbName) { return; }

    // Store both raw and normalized keys
    map.set(dbName, modelName);
    map.set(normalizeKey(dbName), modelName);
  });
  return map;
}

/**
 * Resolve a raw DB identifier to the 3D model name.
 *
 * @param dbName      Raw value from the database column (e.g. "siteA_ldi_01_status")
 * @param lookup      Map built by buildAliasLookup()
 * @param regex       Optional regex to extract the core identifier first
 * @returns           The matched model name, or dbName as fallback
 */
export function resolveDbToModel(
  dbName: string,
  lookup: Map<string, string>,
  regex?: string
): string {
  // 1. Direct alias match (exact string)
  if (lookup.has(dbName)) { return lookup.get(dbName)!; }

  // 2. Normalized alias match (fuzzy strip)
  const norm = normalizeKey(dbName, regex);
  if (lookup.has(norm)) { return lookup.get(norm)!; }

  // 3. If regex was given, try the extracted + normalized form against model names directly
  if (regex) {
    const extracted = normalizeKey(dbName, regex);
    if (lookup.has(extracted)) { return lookup.get(extracted)!; }
  }

  // 4. Fallback: return original DB name unchanged
  return dbName;
}
