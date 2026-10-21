/**
 * Shared plumbing for every service call.
 *
 * `request()` is the single point where the app talks to the backend. It
 * refuses to start while offline and turns every Supabase / Postgres error
 * into an ApiError with a stable code, so screens never deal with raw
 * backend errors.
 *
 * Database functions raise errors as 'code|message' (see the migrations);
 * those are passed through with their code and user-facing message.
 */
import { network } from '@/backend/network';
import { supabase } from '@/backend/supabase';

export type ErrorCode =
  | 'offline'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'out_of_stock'
  | 'locked'
  | 'not_configured'
  | 'unknown';

const CODES: ErrorCode[] = ['offline', 'unauthenticated', 'forbidden', 'not_found', 'validation', 'conflict', 'out_of_stock', 'locked', 'not_configured'];

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    /** Which form field the error belongs to, when it's a validation error. */
    public field?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const GENERIC = 'Something went wrong. Please try again.';
const OFFLINE = "You're offline. Check your internet connection and try again.";

/** Validation messages raised by database functions, and the form field each belongs to. */
const FIELD_BY_MESSAGE: [RegExp, string][] = [
  [/delivery address/i, 'address'],
  [/tell the customer why/i, 'reason'],
  [/quantity|whole number|in stock$/i, 'quantity'],
  [/rating from/i, 'rating'],
];

interface BackendError {
  code?: string;
  message?: string;
  status?: number;
  name?: string;
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const err = (e ?? {}) as BackendError;
  const message = String(err.message ?? '');

  const piped = /^([a-z_]+)\|([\s\S]+)$/.exec(message);
  if (piped && CODES.includes(piped[1] as ErrorCode)) {
    const code = piped[1] as ErrorCode;
    const field = code === 'validation' ? FIELD_BY_MESSAGE.find(([re]) => re.test(piped[2]))?.[1] : undefined;
    return new ApiError(code, piped[2], field);
  }
  if (/failed to fetch|network request failed|networkerror|load failed/i.test(message)) return new ApiError('offline', OFFLINE);
  switch (err.code) {
    case '23505':
      return new ApiError('conflict', 'That already exists.');
    case '23514':
    case '22P02':
      return new ApiError('validation', 'Please check the details and try again.');
    case '42501':
      return new ApiError('forbidden', "You don't have permission to do that.");
    case 'PGRST116':
      return new ApiError('not_found', 'Not found.');
    case 'PGRST301':
    case 'PGRST303':
      return new ApiError('unauthenticated', 'Your session has expired. Please log in again.');
  }
  if (err.status === 401) return new ApiError('unauthenticated', 'Your session has expired. Please log in again.');
  if (err.status === 429) return new ApiError('locked', 'Too many attempts. Please wait a few minutes and try again.');
  return new ApiError('unknown', GENERIC);
}

export async function request<T>(handler: () => T | Promise<T>): Promise<T> {
  if (!network.isOnline()) throw new ApiError('offline', OFFLINE);
  try {
    return await handler();
  } catch (e) {
    const api = toApiError(e);
    if (api.code === 'unknown') console.warn('[api] unexpected error', e);
    throw api;
  }
}

/** List results are never null once the error is ruled out; single-row results may still be. */
type Unwrapped<T> = [T] extends [readonly unknown[] | null] ? NonNullable<T> : T;

/** Unwraps a supabase-js result, throwing its error. */
export function unwrap<T>(result: { data: T; error: unknown }): Unwrapped<T> {
  if (result.error) throw result.error;
  return result.data as Unwrapped<T>;
}

/** Calls a database function (RPC) and returns its result. */
export async function rpc<T = void>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const fail = (code: ErrorCode, message: string, field?: string): never => {
  throw new ApiError(code, message, field);
};

export const nowIso = () => new Date().toISOString();
