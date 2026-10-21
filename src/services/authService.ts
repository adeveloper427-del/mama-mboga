/**
 * Authentication with Supabase Auth (email + password).
 *
 * Sign-up: when email confirmation is switched on in Supabase, the account is
 * created unconfirmed and a 6-digit code is emailed; verifySignup() confirms
 * it and signs the user in. Password reset works the same way with a
 * recovery code. (The email templates must include {{ .Token }}.)
 */
import { supabase } from '@/backend/supabase';
import type { Role, User } from '@/types/models';
import {
  normalizePhone,
  sanitizeText,
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
} from '@/utils/validation';

import { ApiError, fail, request, unwrap } from './api';
import { toUser } from './mappers';
import { requireUser, session } from './session';

export interface AuthResult {
  user: User;
}

type AuthErr = { message?: string; code?: string; status?: number } | null;

/** Supabase Auth errors → friendly ApiErrors. */
function authError(e: AuthErr, fallback: string): ApiError {
  const code = e?.code ?? '';
  const msg = e?.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg))
    return new ApiError('unauthenticated', 'Incorrect email or password.');
  if (code === 'email_not_confirmed') return new ApiError('unauthenticated', 'Confirm your email first: enter the code we sent you.', 'email');
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(msg))
    return new ApiError('conflict', 'An account with this email already exists.', 'email');
  if (code === 'weak_password') return new ApiError('validation', 'Choose a stronger password.', 'password');
  if (code === 'otp_expired' || /token has expired|invalid/i.test(msg) && /otp|token/i.test(msg))
    return new ApiError('validation', 'That code is invalid or has expired.', 'code');
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || e?.status === 429)
    return new ApiError('locked', 'Too many attempts. Please wait a few minutes and try again.');
  if (code === 'same_password') return new ApiError('validation', 'Choose a password you have not used here before.', 'next');
  if (/database error saving new user/i.test(msg))
    return new ApiError('conflict', 'An account with this phone number already exists.', 'phone');
  if (/failed to fetch|network request failed/i.test(msg))
    return new ApiError('offline', "You're offline. Check your internet connection and try again.");
  if (/error sending .*email/i.test(msg)) return new ApiError('not_configured', 'We could not send the email right now. Please try again later.');
  return new ApiError('unknown', fallback);
}

async function loadProfile(userId: string): Promise<User> {
  const row = unwrap(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle());
  if (!row) return fail('unauthenticated', 'Your account could not be found. Please sign up again.');
  return toUser(row);
}

/** Loads the profile for the current Supabase session and makes it the active user. */
async function activate(userId: string): Promise<User> {
  const user = await loadProfile(userId);
  if (user.status === 'suspended') {
    await supabase.auth.signOut({ scope: 'local' });
    session.setUser(null);
    return fail('forbidden', 'This account has been suspended. Please contact support.');
  }
  session.setUser(user);
  return user;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  return request(async () => {
    const id = email.trim().toLowerCase();
    if (!id || !password) fail('validation', 'Enter your email and password.');
    if (validateEmail(id)) fail('validation', 'Sign in with the email address on your account.', 'identifier');
    const { data, error } = await supabase.auth.signInWithPassword({ email: id, password });
    if (error || !data.user) throw authError(error, 'We could not sign you in. Please try again.');
    return { user: await activate(data.user.id) };
  });
}

/** Resume the saved session at app start. Returns null when there is none or it is no longer valid. */
export async function restoreSession(): Promise<User | null> {
  return request(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    try {
      return await activate(data.session.user.id);
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'unauthenticated' || e.code === 'forbidden')) {
        await supabase.auth.signOut({ scope: 'local' });
        return null;
      }
      throw e;
    }
  });
}

export async function logout(): Promise<void> {
  session.setUser(null);
  // Ends this device's session only; other devices stay signed in. Never fails locally.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

export interface RegisterInput {
  role: Exclude<Role, 'admin'>;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  area: string;
  shop?: { businessName: string; addressLine: string; landmark?: string };
}

/** Either signed in straight away, or waiting for the emailed code. */
export type RegisterResult = { user: User; needsVerification?: false } | { needsVerification: true; email: string };

export async function register(input: RegisterInput): Promise<RegisterResult> {
  return request(async () => {
    const checks: [string, string | undefined][] = [
      ['fullName', validateName(input.fullName)],
      ['email', validateEmail(input.email)],
      ['phone', validatePhone(input.phone)],
      ['password', validatePassword(input.password)],
    ];
    for (const [field, msg] of checks) if (msg) fail('validation', msg, field);
    if ((input.role as string) === 'admin') fail('forbidden', 'This account type cannot be created.');
    if (!input.area) fail('validation', 'Choose your area', 'area');
    if (input.role === 'seller' && (!input.shop?.businessName.trim() || !input.shop.addressLine.trim()))
      fail('validation', 'Business name and location are required', 'businessName');

    const email = input.email.trim().toLowerCase();
    // The database trigger creates the profile (and shop) from this metadata; it never grants admin.
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        data: {
          role: input.role,
          full_name: sanitizeText(input.fullName, 60),
          phone: normalizePhone(input.phone),
          area: input.area,
          ...(input.role === 'seller' && input.shop
            ? {
                business_name: sanitizeText(input.shop.businessName, 60),
                address_line: sanitizeText(input.shop.addressLine, 120),
                landmark: input.shop.landmark ? sanitizeText(input.shop.landmark, 120) : '',
              }
            : {}),
        },
      },
    });
    if (error) throw authError(error, 'We could not create your account. Please try again.');
    // With confirmation on, an existing email comes back as a user with no identities.
    if (data.user && !data.user.identities?.length) fail('conflict', 'An account with this email already exists.', 'email');
    if (!data.session || !data.user) return { needsVerification: true, email };
    return { user: await activate(data.user.id) };
  });
}

/** Confirms a new account with the 6-digit code from the sign-up email. */
export async function verifySignup(email: string, code: string): Promise<AuthResult> {
  return request(async () => {
    if (!/^\d{6}$/.test(code.trim())) fail('validation', 'Enter the 6-digit code', 'code');
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    if (error || !data.user) throw authError(error, 'That code is invalid or has expired.');
    return { user: await activate(data.user.id) };
  });
}

export async function resendSignupCode(email: string): Promise<void> {
  return request(async () => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
    if (error) throw authError(error, 'We could not resend the code. Please try again.');
  });
}

export interface ResetRequestResult {
  destination: string;
}

export async function requestPasswordReset(email: string): Promise<ResetRequestResult> {
  return request(async () => {
    const id = email.trim().toLowerCase();
    if (!id) fail('validation', 'Enter your email address', 'identifier');
    if (validateEmail(id)) fail('validation', 'Enter the email address on your account', 'identifier');
    const { error } = await supabase.auth.resetPasswordForEmail(id);
    // Same response whether or not the account exists (no account enumeration).
    if (error && (error.status === 429 || /network|fetch/i.test(error.message))) throw authError(error, 'Please try again.');
    return { destination: id.replace(/^(.{2}).*(@.*)$/, '$1•••$2') };
  });
}

/** Checks the emailed recovery code, sets the new password, then signs out everywhere. */
export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  return request(async () => {
    const pwError = validatePassword(newPassword);
    if (pwError) fail('validation', pwError, 'password');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'recovery' });
    if (error) throw new ApiError('validation', 'That code is invalid or has expired.', 'code');
    const upd = await supabase.auth.updateUser({ password: newPassword });
    if (upd.error) throw authError(upd.error, 'We could not update your password. Please try again.');
    await supabase.auth.signOut({ scope: 'global' });
    session.setUser(null);
  });
}

export async function changePassword(current: string, next: string): Promise<void> {
  return request(async () => {
    const me = requireUser();
    const pwError = validatePassword(next);
    if (pwError) fail('validation', pwError, 'next');
    if (current === next) fail('validation', 'Choose a password you have not used here before.', 'next');
    // Re-authenticate so a borrowed, unlocked phone can't change the password.
    const check = await supabase.auth.signInWithPassword({ email: me.email, password: current });
    if (check.error) {
      if (check.error.code === 'invalid_credentials') fail('validation', 'Your current password is incorrect.', 'current');
      throw authError(check.error, 'Please try again.');
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) throw authError(error, 'We could not update your password. Please try again.');
  });
}

export interface ProfileUpdate {
  fullName?: string;
  email?: string;
  phone?: string;
  area?: string;
  avatarUrl?: string | null;
}

export async function updateProfile(update: ProfileUpdate): Promise<User> {
  return request(async () => {
    const me = requireUser();
    const patch: Record<string, unknown> = {};
    if (update.fullName !== undefined) {
      const m = validateName(update.fullName);
      if (m) fail('validation', m, 'fullName');
      patch.full_name = sanitizeText(update.fullName, 60);
    }
    if (update.phone !== undefined) {
      const m = validatePhone(update.phone);
      if (m) fail('validation', m, 'phone');
      patch.phone = normalizePhone(update.phone);
    }
    if (update.area !== undefined) patch.area = update.area;
    if (update.avatarUrl !== undefined) patch.avatar_url = update.avatarUrl;

    if (update.email !== undefined && update.email.trim().toLowerCase() !== me.email) {
      const m = validateEmail(update.email);
      if (m) fail('validation', m, 'email');
      // Supabase emails a confirmation link to the new address; the profile follows once confirmed.
      const { error } = await supabase.auth.updateUser({ email: update.email.trim().toLowerCase() });
      if (error) throw authError(error, 'We could not change your email. Please try again.');
    }

    if (Object.keys(patch).length) {
      const { error } = await supabase.from('profiles').update(patch).eq('id', me.id);
      if (error) {
        if (error.code === '23505') fail('conflict', 'That phone number is used by another account.', 'phone');
        throw error;
      }
    }
    const user = await loadProfile(me.id);
    session.setUser(user);
    return user;
  });
}

export async function getMe(): Promise<User> {
  return request(async () => {
    const me = requireUser();
    const user = await loadProfile(me.id);
    session.setUser(user);
    if (user.status === 'suspended') fail('forbidden', 'This account has been suspended.');
    return user;
  });
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
