import React, { forwardRef } from 'react';

interface Props {
  visible: boolean;
}

export const FloatingLabelsOverlay = forwardRef<HTMLDivElement, Props>(({ visible }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: 0, left: 0,
        pointerEvents: 'none', width: '100%', height: '100%',
        zIndex: 5, display: visible ? 'block' : 'none',
      }}
    />
  );
});
FloatingLabelsOverlay.displayName = 'FloatingLabelsOverlay';
