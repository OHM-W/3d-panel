import React from 'react';
import { MachineLayoutConfig } from '../types';
import { css } from '@emotion/css';

interface Props {
  selectedMachine: string | null;
  machineConfig?: MachineLayoutConfig;
  renameInput: string;
  onRenameInputChange: (val: string) => void;
  onRename: () => void;
  onAdjustProperty: (prop: 'scaleX' | 'scaleY' | 'scaleZ' | 'rotationY', delta: number) => void;
  onDelete: () => void;
}

const styles = {
  iconBtn: css`
    background: #333; border: 1px solid #555; color: white;
    border-radius: 4px; width: 28px; height: 28px;
    cursor: pointer; font-weight: bold;
    display: flex; align-items: center; justify-content: center;
    &:hover { background: #444; } &:active { background: #222; }
  `,
  deleteBtn: css`
    width: 100%; margin-top: 16px; background: #e63946; color: white;
    border: none; border-radius: 8px; padding: 10px;
    font-size: 14px; font-weight: bold; cursor: pointer; transition: background 0.2s;
    &:hover { background: #ff4d5a; }
  `,
};

export const EditControlPanel: React.FC<Props> = ({
  selectedMachine,
  machineConfig,
  renameInput,
  onRenameInputChange,
  onRename,
  onAdjustProperty,
  onDelete,
}) => {
  if (!selectedMachine) return null;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', bottom: 20, right: 20, zIndex: 30,
        background: 'rgba(25,25,35,0.95)', border: '1px solid #444',
        borderRadius: 12, padding: 16, color: '#fff',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
        width: 270,
      }}
    >
      <h4 style={{ margin: '0 0 12px 0', fontSize: 15, borderBottom: '1px solid #555', paddingBottom: 8, color: '#ffaa00' }}>
        🛠️ ตั้งค่า: {selectedMachine}
      </h4>

      {/* ✏️ Rename Machine Section */}
      <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>✏️ เปลี่ยนชื่อเครื่องจักร:</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={renameInput}
            onChange={(e) => onRenameInputChange(e.target.value)}
            placeholder="ระบุชื่อใหม่ (เช่น LDI-88)"
            onKeyDown={(e) => e.key === 'Enter' && onRename()}
            style={{
              flex: 1, padding: '6px 8px', borderRadius: 4,
              border: '1px solid #555', background: '#111', color: '#fff', fontSize: 12
            }}
          />
          <button
            onClick={onRename}
            style={{
              background: '#0284c7', color: '#fff', border: 'none',
              borderRadius: 4, padding: '6px 10px', fontSize: 12,
              fontWeight: 'bold', cursor: 'pointer'
            }}
            title="เปลี่ยนชื่อและผูกข้อมูลกับเครื่องนี้ทันที"
          >
            บันทึก
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 9 }}>
        {[
          { label: 'กว้าง (X)', prop: 'scaleX' as const, delta: 0.5 },
          { label: 'สูง (Y)', prop: 'scaleY' as const, delta: 0.5 },
          { label: 'ลึก (Z)', prop: 'scaleZ' as const, delta: 0.5 },
        ].map(item => (
          <div key={item.prop} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#bbb' }}>{item.label}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => onAdjustProperty(item.prop, -item.delta)} className={styles.iconBtn}>-</button>
              <span style={{ display: 'inline-block', width: 35, textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>
                {(machineConfig as any)?.[item.prop] || 1}
              </span>
              <button onClick={() => onAdjustProperty(item.prop, item.delta)} className={styles.iconBtn}>+</button>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <span style={{ fontSize: 12, color: '#bbb' }}>หมุน (องศา)</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => onAdjustProperty('rotationY', -Math.PI / 8)} className={styles.iconBtn}>↺</button>
            <span style={{ display: 'inline-block', width: 35, textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>
              {Math.round(((machineConfig?.rotationY) || 0) * (180 / Math.PI))}°
            </span>
            <button onClick={() => onAdjustProperty('rotationY', Math.PI / 8)} className={styles.iconBtn}>↻</button>
          </div>
        </div>
      </div>
      <button className={styles.deleteBtn} onClick={onDelete}>🗑️ ลบกล่องนี้</button>
    </div>
  );
};
