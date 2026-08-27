import React from 'react';
import { css } from '@emotion/css';

interface Props {
  visible: boolean;
}

const styles = {
  badge: css`
    position: absolute; bottom: 20px; left: 20px; z-index: 25;
    background: rgba(15, 23, 42, 0.92); color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.5);
    padding: 10px 18px; border-radius: 10px;
    font-size: 13px; font-weight: 600;
    box-shadow: 0 8px 24px rgba(0,0,0,0.7);
    backdrop-filter: blur(10px); pointer-events: none;
    display: flex; align-items: center; gap: 8px;
  `,
};

export const WalkthroughHelp: React.FC<Props> = ({ visible }) => {
  if (!visible) return null;
  return (
    <div className={styles.badge}>
      <span style={{ fontSize: 16 }}>🚶‍♂️</span>
      <span><b>โหมดเดินสำรวจ:</b> กด <b>W, A, S, D</b> เพื่อเดิน | คลิกซ้ายค้างแล้วเลื่อนเมาส์เพื่อหันมุมมอง</span>
    </div>
  );
};
