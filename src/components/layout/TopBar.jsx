import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, HelpCircle, Hexagon, LayoutDashboard, RotateCcw, Wrench, Swords } from 'lucide-react';

import TokenMeter from './TokenMeter.jsx';
import Button from '../ui/Button.jsx';
import { AuthControls } from '../../context/IdentityContext.jsx';
import { useStudio } from '../../context/StudioContext.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, end: true },
  { to: '/questions', label: 'Questions', short: 'Questions', icon: HelpCircle },
  { to: '/arena/A', label: 'Debugging', short: 'Debug', icon: Wrench },
  { to: '/arena/B', label: 'Feature', short: 'Feature', icon: Swords },
  { to: '/analytics', label: 'Analytics', short: 'Stats', icon: BarChart3 },
];

export default function TopBar({ onExhausted }) {
  const { actions } = useStudio();
  const location = useLocation();

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface/80 px-5 backdrop-blur">
      <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-cyan-500 text-slate-950 shadow-[0_0_18px_-4px_rgba(56,189,248,0.8)]">
          <Hexagon size={17} strokeWidth={2.4} />
        </div>
        <div className="hidden leading-none sm:block">
          <div className="text-[13.5px] font-semibold tracking-tight text-ink">CapEx-AI Practice Studio</div>
          <div className="mt-0.5 text-[10.5px] text-ink-faint">
            Exceller Round 2 · AI-Assisted Full-Stack · 13–16 LPA
          </div>
        </div>
      </NavLink>

      <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium transition-colors ${
                    isActive
                      ? 'bg-surface-3 text-ink'
                      : 'text-ink-faint hover:bg-surface-2 hover:text-ink-dim'
                  }`
                }
              >
                <Icon size={14} />
                {item.label}
              </NavLink>
            );
          })}
      </nav>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="w-56">
          <TokenMeter onExhausted={onExhausted} />
        </div>
        <AuthControls />
        <Button
          size="sm"
          variant="subtle"
          title="Clear all progress, budgets and sessions"
          onClick={() => {
            if (window.confirm('Reset all progress, token budget and both sessions?')) actions.resetEverything();
          }}
        >
          <RotateCcw size={13} />
          <span className="hidden lg:inline">Reset</span>
        </Button>
      </div>

      <MobileNav currentPath={location.pathname} />
    </header>
  );
}

function MobileNav({ currentPath }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur md:hidden">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = item.end ? currentPath === item.to : currentPath.startsWith(item.to);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
              active ? 'text-sky-400' : 'text-ink-faint'
            }`}
          >
            <Icon size={16} />
            {item.short}
          </NavLink>
        );
      })}
    </nav>
  );
}
