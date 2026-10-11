/**
 * Identity adapter.
 *
 * Everything in the app reads identity from `useIdentity()` and never touches Clerk
 * directly. That keeps two realities in one place:
 *
 *   - Clerk configured  → real sign-in, and rounds are gated behind it
 *   - no publishable key → a local guest identity, so the studio still runs for anyone
 *                         who clones the repo or opens a preview before env vars are set
 *
 * The bridges are separate components rather than branches inside one component, so the
 * Clerk hooks are never called outside their provider.
 */

import { createContext, useContext, useMemo } from 'react';
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from '@clerk/react';

const IdentityContext = createContext(null);

export const CLERK_ENABLED = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

/** Matches the app's AMOLED palette so the auth surfaces do not feel bolted on. */
const appearance = {
  variables: {
    colorBackground: '#0a0a0b',
    colorInputBackground: '#121214',
    colorInputText: '#f2f2f3',
    colorText: '#f2f2f3',
    colorTextSecondary: '#a1a1a6',
    colorPrimary: '#38bdf8',
    colorPrimaryText: '#000000',
    colorDanger: '#fb7185',
    colorSuccess: '#34d399',
    colorNeutral: '#1a1a1d',
    borderRadius: '0.5rem',
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    card: 'cc-clerk-card',
    cardBox: 'cc-clerk-card',
    headerTitle: 'cc-clerk-title',
    headerSubtitle: 'cc-clerk-subtitle',
    formButtonPrimary: 'cc-clerk-primary',
    footerActionLink: 'cc-clerk-link',
    socialButtonsBlockButton: 'cc-clerk-social',
  },
};

function ClerkBridge({ children }) {
  const { user, isSignedIn, isLoaded } = useUser();

  const value = useMemo(
    () => ({
      enabled: true,
      loading: !isLoaded,
      signedIn: isSignedIn,
      user: user
        ? {
            id: user.id,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Candidate',
            email: [user.primaryEmailAddress?.emailAddress].filter(Boolean)[0] ?? null,
            image: user.imageUrl ?? null,
          }
        : null,
    }),
    [user, isSignedIn, isLoaded],
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

function GuestBridge({ children }) {
  const value = useMemo(
    () => ({
      enabled: false,
      loading: false,
      signedIn: false,
      user: null,
    }),
    [],
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function IdentityProvider({ children }) {
  if (!CLERK_ENABLED) return <GuestBridge>{children}</GuestBridge>;

  return (
    <ClerkProvider appearance={appearance} afterSignOutUrl="/">
      <ClerkBridge>{children}</ClerkBridge>
    </ClerkProvider>
  );
}

export function useIdentity() {
  const value = useContext(IdentityContext);
  if (!value) throw new Error('useIdentity must be used inside <IdentityProvider>');
  return value;
}

/* ------------------------------------------------------------------ controls */

/**
 * Sign-in / sign-up / user controls for the top bar.
 * Falls back to an explanatory chip when Clerk is not configured, so the state is
 * visible rather than mysterious.
 */
export function AuthControls() {
  if (!CLERK_ENABLED) {
    return (
      <span
        title="Set VITE_CLERK_PUBLISHABLE_KEY to enable sign-in"
        className="hidden items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[11px] text-ink-faint lg:flex"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Auth not configured
      </span>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <SignUpButton mode="modal">
          <button
            type="button"
            className="h-8 rounded-lg px-3 text-xs font-medium text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Sign up
          </button>
        </SignUpButton>
        <SignInButton mode="modal">
          <button
            type="button"
            className="h-8 rounded-lg bg-sky-500 px-3 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'cc-clerk-avatar',
              userButtonPopoverCard: 'cc-clerk-card',
              userButtonPopoverList: 'cc-clerk-card',
              userButtonPopoverActionButton: 'cc-clerk-popover-action',
            },
          }}
        />
      </Show>
    </>
  );
}

/** Modal trigger used by the gate screen. */
export function SignInPrompt({ size = 'md' }) {
  if (!CLERK_ENABLED) return null;

  const big = size === 'lg';
  return (
    <SignInButton mode="modal">
      <button
        type="button"
        className={`inline-flex items-center gap-2 rounded-lg bg-sky-500 font-semibold text-slate-950 transition-colors hover:bg-sky-400 ${
          big ? 'h-11 px-5 text-sm' : 'h-9 px-4 text-[13px]'
        }`}
      >
        Sign in to continue
      </button>
    </SignInButton>
  );
}

export function SignUpPrompt() {
  if (!CLERK_ENABLED) return null;
  return (
    <SignUpButton mode="modal">
      <button
        type="button"
        className="inline-flex h-9 items-center rounded-lg border border-line bg-surface-2 px-4 text-[13px] font-medium text-ink-dim transition-colors hover:border-sky-500/40 hover:text-ink"
      >
        Create an account
      </button>
    </SignUpButton>
  );
}
