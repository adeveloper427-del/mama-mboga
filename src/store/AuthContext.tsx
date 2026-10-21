import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { clearQueryCache } from '@/hooks/useQuery';
import { auth } from '@/services';
import type { RegisterInput } from '@/services/authService';
import { onTablesChanged } from '@/services/realtime';
import type { User } from '@/types/models';
import { localStore, storageKeys } from '@/utils/storage';

type Status = 'loading' | 'signedOut' | 'signedIn';

/** Sign-up either signs the user in, or asks for the code emailed to them. */
export type SignUpOutcome = { user: User } | { verifyEmail: string };

interface AuthContextValue {
  status: Status;
  user: User | null;
  /** True the very first time the app runs on this device. */
  needsOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (input: RegisterInput) => Promise<SignUpOutcome>;
  verifySignUp: (email: string, code: string) => Promise<User>;
  signOut: () => Promise<void>;
  /** Startup failure (e.g. storage unavailable). */
  bootError: string | null;
  retryBoot: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);

  // Restore session on launch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBootError(null);
      const minSplash = new Promise((r) => setTimeout(r, 900)); // let the brand splash breathe
      try {
        const onboarded = await localStore.get<boolean>(storageKeys.onboardingDone, false);
        let restored: User | null = null;
        try {
          restored = await auth.restoreSession();
        } catch {
          restored = null; // offline at launch etc. → ask to sign in again
        }
        await minSplash;
        if (cancelled) return;
        setNeedsOnboarding(!onboarded);
        setUser(restored);
        setStatus(restored ? 'signedIn' : 'signedOut');
      } catch {
        if (!cancelled) setBootError('We could not start the app. Please try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootAttempt]);

  const endSession = useCallback(() => {
    clearQueryCache();
    setUser(null);
    setStatus('signedOut');
  }, []);

  // Keep the signed-in user fresh (profile edits, admin suspension).
  useEffect(() => {
    if (status !== 'signedIn') return;
    return onTablesChanged(['users'], async () => {
      try {
        setUser(await auth.getMe());
      } catch (e) {
        if (auth.isApiError(e) && (e.code === 'unauthenticated' || e.code === 'forbidden')) {
          await auth.logout();
          endSession();
        }
      }
    });
  }, [status, endSession]);

  const completeOnboarding = useCallback(async () => {
    await localStore.set(storageKeys.onboardingDone, true);
    setNeedsOnboarding(false);
  }, []);

  const finish = useCallback(async (next: User) => {
    await localStore.set(storageKeys.onboardingDone, true);
    clearQueryCache();
    setNeedsOnboarding(false);
    setUser(next);
    setStatus('signedIn');
    return next;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => finish((await auth.login(email, password)).user), [finish]);

  const signUp = useCallback(
    async (input: RegisterInput): Promise<SignUpOutcome> => {
      const res = await auth.register(input);
      if (res.needsVerification) return { verifyEmail: res.email };
      return { user: await finish(res.user) };
    },
    [finish],
  );

  const verifySignUp = useCallback(
    async (email: string, code: string) => finish((await auth.verifySignup(email, code)).user),
    [finish],
  );

  const signOut = useCallback(async () => {
    await auth.logout();
    endSession();
  }, [endSession]);

  const value = useMemo(
    () => ({
      status, user, needsOnboarding, completeOnboarding, signIn, signUp, verifySignUp, signOut, bootError,
      retryBoot: () => setBootAttempt((n) => n + 1),
    }),
    [status, user, needsOnboarding, completeOnboarding, signIn, signUp, verifySignUp, signOut, bootError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
