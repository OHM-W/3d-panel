/**
 * 🛡️ Utility functions for HTML sanitization and Telemetry formatting
 */

export function escapeHTML(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatTelemetryValue(val: any): string {
  if (typeof val === 'number') {
    if (isNaN(val)) return '—';
    return Number.isInteger(val)
      ? val.toLocaleString()
      : val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return escapeHTML(val ?? '—');
}

export interface TooltipFieldDef {
  column: string;
  label: string;
  unit: string;
}

export function parseTooltipFields(str: string): TooltipFieldDef[] {
  if (!str?.trim()) return [];
  return str.split(',').map(part => {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return null;
    const column = trimmed.slice(0, eqIdx).trim();
    const rest = trimmed.slice(eqIdx + 1).trim();
    const colonIdx = rest.indexOf(':');
    const label = colonIdx === -1 ? rest : rest.slice(0, colonIdx).trim();
    const unit = colonIdx === -1 ? '' : rest.slice(colonIdx + 1).trim();
    return { column, label, unit };
  }).filter(Boolean) as TooltipFieldDef[];
}
