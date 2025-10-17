import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './ui/context/ThemeContext';
import { Layout } from './ui/components/layout/Layout';
import { Overview } from './ui/pages/Overview';
import { RunsManager } from './ui/pages/RunsManager';
import { EncounterExplorer } from './ui/pages/EncounterExplorer';
import { Settings } from './ui/pages/Settings';
import { Loading } from './ui/components/common/States';
import { useToast } from './ui/components/common/Toast';

// Lazy load battle route
const BattleScreen = React.lazy(() => import('./ui/pages/BattleScreen').then(module => ({ default: module.BattleScreen })));

function AppContent() {
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
            <Route path="/battle" element={<BattleScreen />} />
          </Routes>
        </Suspense>
      </Layout>
      <ToastContainer />
    </>
  );
}

export function App(): JSX.Element {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  );
}

