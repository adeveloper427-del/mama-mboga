import { appConfig } from '@/config';

/**
 * Form validators. Each returns an error message, or undefined when valid.
 * The same rules are re-applied inside the services, because the UI can never
 * be trusted to have validated its input.
 */

export type Validator = (value: string) => string | undefined;

export const required =
  (label: string): Validator =>
  (v) =>
    v.trim() ? undefined : `${label} is required`;

export const validateName: Validator = (v) => {
  const t = v.trim();
  if (!t) return 'Name is required';
  if (t.length < 3) return 'Name is too short';
  if (t.length > 60) return 'Name is too long';
  if (!/^[\p{L}\s'.-]+$/u.test(t)) return 'Use letters only';
  return undefined;
};

export const validateEmail: Validator = (v) => {
  const t = v.trim();
  if (!t) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) return 'Enter a valid email address';
  return undefined;
};

/** Accepts 07XXXXXXXX, 01XXXXXXXX, 7XXXXXXXX, +2547XXXXXXXX, 2547XXXXXXXX. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, '');
  const m = digits.match(/^(?:\+?254|0)?([17]\d{8})$/);
  return m ? `+254${m[1]}` : null;
}

export const validatePhone: Validator = (v) => {
  if (!v.trim()) return 'Phone number is required';
  return normalizePhone(v) ? undefined : 'Enter a valid Kenyan number, e.g. 0712 345 678';
};

export const validatePassword: Validator = (v) => {
  if (!v) return 'Password is required';
  if (v.length < appConfig.security.minPasswordLength)
    return `Use at least ${appConfig.security.minPasswordLength} characters`;
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Use both letters and numbers';
  return undefined;
};

export function passwordStrength(v: string): { score: 0 | 1 | 2 | 3; label: string } {
  let score = 0;
  if (v.length >= 8) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v)) score++;
  if (v.length >= 12 || /[^A-Za-z0-9]/.test(v)) score++;
  const s = Math.min(score, 3) as 0 | 1 | 2 | 3;
  return { score: s, label: ['Too weak', 'Fair', 'Good', 'Strong'][s] };
}

export const validatePrice: Validator = (v) => {
  if (!v.trim()) return 'Price is required';
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 'Enter a price above 0';
  if (n > 100_000) return 'Price looks too high';
  return undefined;
};

export const validateWholeNumber =
  (label: string, { min = 0, max = 100_000 } = {}): Validator =>
  (v) => {
    if (!v.trim()) return `${label} is required`;
    const n = Number(v);
    if (!Number.isInteger(n)) return `${label} must be a whole number`;
    if (n < min) return `${label} must be at least ${min}`;
    if (n > max) return `${label} must be at most ${max}`;
    return undefined;
  };

export const validateTime: Validator = (v) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? undefined : 'Use 24-hour time, e.g. 06:30';

/** Strip control characters and trim free text before it is stored. */
export function sanitizeText(v: string, maxLength = 500): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

/** Run a map of validators against a values object; returns only the failing fields. */
export function validateForm<T extends Record<string, string>>(
  values: T,
  rules: Partial<Record<keyof T, Validator>>,
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};
  for (const key of Object.keys(rules) as (keyof T)[]) {
    const msg = rules[key]?.(values[key] ?? '');
    if (msg) errors[key] = msg;
  }
  return errors;
}
