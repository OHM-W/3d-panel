import React from 'react';
import { CameraMode } from '../types';
import { css, cx } from '@emotion/css';

interface Props {
  currentMode: CameraMode;
  onSwitchMode: (mode: CameraMode) => void;
  onReset: () => void;
}

const styles = {
  cameraToolbar: css`
    position: absolute; top: 15px; left: 15px; z-index: 30;
    display: flex; gap: 4px;
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 4px; border-radius: 8px;
    backdrop-filter: blur(10px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.6);
  `,
  camBtn: css`
    background: transparent; color: #94a3b8;
    border: none; border-radius: 6px;
    padding: 6px 12px; font-size: 12px; font-weight: 700;
    cursor: pointer; transition: all 0.2s;
    display: flex; align-items: center; gap: 6px;
    &:hover { background: rgba(255,255,255,0.1); color: #fff; }
  `,
  camBtnActive: css`
    background: #0284c7 !important; color: #fff !important;
    box-shadow: 0 2px 8px rgba(2, 132, 199, 0.5);
  `,
};

export const CameraToolbar: React.FC<Props> = ({ currentMode, onSwitchMode, onReset }) => {
  return (
    <div className={styles.cameraToolbar}>
      <button
        onClick={() => onSwitchMode('perspective')}
        className={cx(styles.camBtn, currentMode === 'perspective' && styles.camBtnActive)}
        title="มุมมอง 3D หมุน แพน ซูม ได้อิสระรอบทิศทาง"
      >
        🌐 3D Orbit
      </button>
      <button
        onClick={() => onSwitchMode('top')}
        className={cx(styles.camBtn, currentMode === 'top' && styles.camBtnActive)}
        title="มุมมองด้านบน 2D Top-Down แบบแปลนผังโรงงาน"
      >
        📐 2D Plan
      </button>
      <button
        onClick={() => onSwitchMode('walkthrough')}
        className={cx(styles.camBtn, currentMode === 'walkthrough' && styles.camBtnActive)}
        title="เดินชมโรงงาน (WASD)"
      >
        🚶‍♂️ Walk (WASD)
      </button>
      <button
        onClick={onReset}
        className={styles.camBtn}
        title="รีเซ็ตมุมกล้องกลับจุดเริ่มต้น"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 8 }}
      >
        🎯 ResetCamera
      </button>
    </div>
  );
};
