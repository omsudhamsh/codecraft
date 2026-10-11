import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, ShieldAlert, UserRound } from 'lucide-react';

import Button from '../ui/Button.jsx';
import { CLERK_ENABLED, SignInPrompt, SignUpPrompt, useIdentity } from '../../context/IdentityContext.jsx';

/**
 * Wraps the assessment surfaces. With Clerk configured, a signed-out visitor sees a
 * sign-in wall — an assessment round should have an identifiable candidate behind it.
 * Without a publishable key the gate is a no-op so the studio still works.
 */
export default function RequireAuth({ children }) {
  const { enabled, signedIn, loading, user } = useIdentity();

  if (!enabled || loading || signedIn) return children;

  return (
    <div className="flex h-full items-center justify-center px-4 py-10">
      <div className="panel w-full max-w-md p-6 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-2">
          {user ? <UserRound size={19} className="text-ink-faint" /> : <LogIn size={19} className="text-sky-400" />}
        </div>

        <h1 className="mt-4 text-[16px] font-semibold text-ink">Sign in to start a round</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-dim">
          {CLERK_ENABLED
            ? 'Your rounds, scores and token spend are recorded against your account, so a practice run and the real assessment look the same.'
            : 'Authentication is not configured in this build, so rounds are open.'}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <SignInPrompt size="lg" />
          <SignUpPrompt />
        </div>

        <Link
          to="/"
          className="mt-5 inline-block text-[12px] text-ink-faint transition-colors hover:text-ink-dim"
        >
          Back to the dashboard
        </Link>
      </div>
    </div>
  );
}

/** Inline banner explaining that auth is unavailable rather than silently doing nothing. */
export function AuthNotConfiguredNote() {
  const { enabled } = useIdentity();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem('codecraft.auth-note-dismissed') === '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (enabled || !dismissed) return;
    const handle = setTimeout(() => {
      try {
        window.localStorage.setItem('codecraft.auth-note-dismissed', '1');
      } catch {
        /* storage disabled */
      }
    }, 8000);
    return () => clearTimeout(handle);
  }, [enabled, dismissed]);

  if (enabled || dismissed) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] p-3">
      <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-400" />
      <p className="flex-1 text-[12px] leading-relaxed text-amber-100/90">
        Clerk is installed but no publishable key is set, so everyone is a local guest.{' '}
        <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[11px] text-amber-200">
          VITE_CLERK_PUBLISHABLE_KEY
        </code>{' '}
        in <code className="font-mono">.env.local</code> turns on real sign-in and gates the rounds.
      </p>
      <Button size="xs" variant="subtle" onClick={() => setDismissed(true)}>
        Dismiss
      </Button>
    </div>
  );
}
