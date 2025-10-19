import React from 'react';

interface Opts {
  enabled: boolean;
  onCancel?: () => void;
}

export function useMenuInput({ enabled, onCancel }: Opts) {
  React.useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCancel?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, onCancel]);
}

