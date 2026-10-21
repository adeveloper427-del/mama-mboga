/**
 * Who is calling? Holds the signed-in user's profile so services can give a
 * clear message before a request (wrong role, suspended). The database
 * enforces the same rules with Row-Level Security, so these checks are for
 * friendliness, not security.
 */
import type { Role, User } from '@/types/models';

import { fail } from './api';

let current: User | null = null;
const listeners = new Set<() => void>();

export const session = {
  setUser(user: User | null) {
    const changed = user?.id !== current?.id;
    current = user;
    if (changed) listeners.forEach((l) => l());
  },
  /** Notified when the signed-in user changes (sign-in, restore, sign-out). */
  onChange(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  userId() {
    return current?.id ?? null;
  },
};

export function requireUser(...roles: Role[]): User {
  if (!current) return fail('unauthenticated', 'Please log in to continue.');
  if (current.status === 'suspended') return fail('forbidden', 'Your account has been suspended. Contact support for help.');
  if (roles.length && !roles.includes(current.role)) return fail('forbidden', "You don't have permission to do that.");
  return current;
}

export function optionalUser(): User | null {
  return current;
}
