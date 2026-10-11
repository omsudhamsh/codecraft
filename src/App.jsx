import { useEffect, useRef, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Compass } from 'lucide-react';

import TopBar from './components/layout/TopBar.jsx';
import TokenExhaustedModal from './components/common/TokenExhaustedModal.jsx';
import DashboardView from './views/DashboardView.jsx';
import ArenaView from './views/ArenaView.jsx';
import AnalyticsView from './views/AnalyticsView.jsx';
import QuestionsView from './views/QuestionsView.jsx';
import { StudioProvider, useStudio } from './context/StudioContext.jsx';

export default function App() {
  return (
    <StudioProvider>
      <Shell />
    </StudioProvider>
  );
}

function Shell() {
  const { budget } = useStudio();
  const [showExhausted, setShowExhausted] = useState(false);
  const announcedRef = useRef(false);

  useEffect(() => {
    if (!budget.locked) {
      announcedRef.current = false;
      return;
    }
    if (announcedRef.current) return;
    announcedRef.current = true;
    setShowExhausted(true);
  }, [budget.locked]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <TopBar onExhausted={() => setShowExhausted(true)} />

      <main className="relative min-h-0 flex-1 pb-14 md:pb-0">
        <Routes>
          <Route path="/" element={<DashboardView onExhausted={() => setShowExhausted(true)} />} />
          <Route path="/questions" element={<QuestionsView />} />
          <Route path="/arena/:mode" element={<ArenaView onExhausted={() => setShowExhausted(true)} />} />
          <Route path="/analytics" element={<AnalyticsView />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <TokenExhaustedModal open={showExhausted} onClose={() => setShowExhausted(false)} budget={budget} />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
      <Compass size={28} className="text-ink-faint" />
      <h1 className="text-lg font-semibold text-ink">No such view</h1>
      <p className="max-w-sm text-[13px] text-ink-dim">
        That route does not exist in the practice studio. Head back to the dashboard and pick a round.
      </p>
    </div>
  );
}
