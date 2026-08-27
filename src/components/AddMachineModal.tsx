import React from 'react';
import { css } from '@emotion/css';

interface Props {
  isOpen: boolean;
  machineName: string;
  onMachineNameChange: (val: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onOpen: () => void;
}

const styles = {
  addBtn: css`
    background: #0072d3; color: white; border: none;
    border-radius: 8px; padding: 8px 16px;
    font-size: 13px; font-weight: bold; cursor: pointer;
    box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition: background 0.2s;
    &:hover { background: #005fba; }
  `,
};

export const AddMachineModal: React.FC<Props> = ({
  isOpen,
  machineName,
  onMachineNameChange,
  onConfirm,
  onCancel,
  onOpen,
}) => {
  return (
    <div style={{ position: 'absolute', top: 15, left: 15, zIndex: 30 }}>
      {!isOpen ? (
        <button className={styles.addBtn} onClick={onOpen} onPointerDown={(e) => e.stopPropagation()}>
          + สร้างกล่องใหม่
        </button>
      ) : (
        <div
          style={{
            background: 'rgba(25,25,35,0.95)', border: '1px solid #444',
            borderRadius: 8, padding: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: 8, width: 220,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <h5 style={{ margin: 0, color: '#fff', fontSize: 14 }}>สร้าง / กู้คืนกล่อง</h5>
          <input
            autoFocus
            type="text"
            value={machineName}
            onChange={(e) => onMachineNameChange(e.target.value)}
            placeholder="ระบุชื่อ (ต้องตรงกับ SQL)"
            style={{ padding: 8, borderRadius: 4, border: '1px solid #555', background: '#111', color: '#fff', fontSize: 13 }}
            onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={onConfirm}
              style={{ flex: 1, background: '#00cc44', color: 'white', border: 'none', borderRadius: 4, padding: 8, cursor: 'pointer', fontWeight: 'bold' }}
            >
              ตกลง
            </button>
            <button
              onClick={onCancel}
              style={{ flex: 1, background: '#555', color: 'white', border: 'none', borderRadius: 4, padding: 8, cursor: 'pointer', fontWeight: 'bold' }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
