import React from 'react';
import { BattleRoute } from '../routes/BattleRoute';
import { DummyAdapter } from '../engine/EngineAdapter';

export function BattleScreen(): React.ReactElement {
  // Use the DummyAdapter for now - you can replace this with your real engine adapter
  const adapter = React.useMemo(() => new DummyAdapter(), []);

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 4rem)' }}>
      <BattleRoute adapter={adapter} />
    </div>
  );
}
