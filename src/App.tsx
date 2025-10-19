import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './ui/components/layout/Layout';
import { Overview } from './ui/pages/Overview';
import { RunsManager } from './ui/pages/RunsManager';
import { EncounterExplorer } from './ui/pages/EncounterExplorer';
import { Settings } from './ui/pages/Settings';
import { Loading } from './ui/components/common/States';
import { useToast } from './ui/components/common/Toast';
import { BattleRoute } from './ui/routes/BattleRoute';
import { DummyAdapter } from './ui/engine/EngineAdapter';

// Lazy load old battle screen (keeping for reference)
const BattleScreen = lazy(() => import('./ui/pages/BattleScreen').then(module => ({ default: module.BattleScreen })));

function AppContent(): React.ReactElement {
  const { ToastContainer } = useToast();

  return (
    <>
      <Layout>
        <Suspense fallback={<Loading message="Loading battle..." />}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/runs" element={<RunsManager />} />
            <Route path="/encounters" element={<EncounterExplorer />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/battle" element={<BattleRoute adapter={new DummyAdapter()} />} />
            <Route path="/battle-old" element={<BattleScreen />} />
          </Routes>
        </Suspense>
      </Layout>
      <ToastContainer />
    </>
  );
}

export function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

