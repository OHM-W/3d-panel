import React from 'react';
import { AlarmSeverity } from '../types';

interface Props {
  machineName: string | null;
  status: number | undefined;
  severity: AlarmSeverity;
  isLOTO: boolean;
  hudColor: string;
  statusLabel: string;
  telemetryData?: Map<string, number>;
  tooltipFields: Array<{ column: string; label: string; unit: string }>;
  statusFieldName?: string;
  dashboardUrlTemplate?: string;
  onClose: () => void;
}

function escapeHTML(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatVal(val: any): string {
  if (typeof val === 'number') {
    if (isNaN(val)) return '—';
    return Number.isInteger(val) ? val.toLocaleString() : val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return escapeHTML(val ?? '—');
}

export const MachineHUDDrawer: React.FC<Props> = ({
  machineName,
  severity,
  isLOTO,
  hudColor,
  statusLabel,
  telemetryData,
  tooltipFields,
  statusFieldName = 'status',
  dashboardUrlTemplate,
  onClose,
}) => {
  if (!machineName) return null;

  const declaredCols = new Set(tooltipFields.map(f => f.column));
  const extraCols: React.ReactNode[] = [];

  if (telemetryData) {
    for (const [col, val] of telemetryData.entries()) {
      if (declaredCols.has(col) || col === statusFieldName || col === 'value') continue;
      extraCols.push(
        <div key={col} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: 11 }}>{col}</span>
          <span style={{ color: '#cbd5e1', fontWeight: 500, fontSize: 12 }}>{formatVal(val)}</span>
        </div>
      );
    }
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 270, zIndex: 50,
        background: 'rgba(12, 16, 26, 0.97)',
        borderLeft: `2px solid ${hudColor}`,
        boxShadow: `-6px 0 32px rgba(0,0,0,0.75)`,
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        padding: 18, gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 0.5 }}>MACHINE DETAIL</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 2 }}>{machineName}</div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}
        >✕</button>
      </div>

      <div style={{ background: `${hudColor}1a`, border: `1px solid ${hudColor}88`, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: hudColor, boxShadow: `0 0 8px ${hudColor}` }} />
          <span style={{ color: hudColor, fontWeight: 700, fontSize: 13 }}>{statusLabel}</span>
        </div>
        {isLOTO && <span style={{ background: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 'bold' }}>🔒 LOTO</span>}
        {!isLOTO && severity === 'Critical' && <span style={{ background: '#dc2626', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 'bold' }}>▲ CRIT</span>}
        {!isLOTO && severity === 'Major' && <span style={{ background: '#d97706', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 'bold' }}>◆ MAJOR</span>}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

      {tooltipFields.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tooltipFields.map(f => {
            const val = telemetryData?.get(f.column);
            if (val === undefined) return null;
            return (
              <div key={f.column} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>{f.label}</span>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{formatVal(val)}{f.unit ? ` ${f.unit}` : ''}</span>
              </div>
            );
          })}
        </div>
      )}

      {extraCols.length > 0 && (
        <>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, fontSize: 10, color: '#64748b', fontWeight: 600 }}>ข้อมูล Telemetry เพิ่มเติม</div>
          {extraCols}
        </>
      )}

      <div style={{ flex: 1 }} />

      {dashboardUrlTemplate?.trim() && (
        <button
          onClick={() => {
            const url = dashboardUrlTemplate.replace(/\${name}/g, encodeURIComponent(machineName));
            window.open(url, '_blank', 'noopener');
          }}
          style={{
            background: hudColor, color: '#000', border: 'none',
            borderRadius: 8, padding: '10px 14px',
            fontWeight: 800, fontSize: 13, cursor: 'pointer',
            width: '100%',
          }}
        >
          เปิด Dashboard เครื่องนี้ →
        </button>
      )}
    </div>
  );
};
