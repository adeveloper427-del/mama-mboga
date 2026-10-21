import { useCallback, useRef, useState } from 'react';

import { ApiError, toApiError } from '@/services';
import { useToast } from '@/store/ToastContext';
import { haptic } from '@/utils/haptics';

interface Options<R> {
  success?: string | ((result: R) => string | undefined);
  /** Show errors as a toast (default true). Turn off when a form shows them inline. */
  toastErrors?: boolean;
  onError?: (error: ApiError) => void;
}

/**
 * Wraps a service write with a busy flag, success/error toasts and haptics.
 * Returns the result, or undefined if it failed.
 */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>, opts: Options<R> = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const toast = useToast();
  const busyRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      if (busyRef.current) return undefined; // ignore double taps
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const result = await fn(...args);
        const { success } = optsRef.current;
        const msg = typeof success === 'function' ? success(result) : success;
        if (msg) {
          haptic.success();
          toast.show(msg, 'success');
        }
        return result;
      } catch (e) {
        const err = toApiError(e);
        setError(err);
        haptic.error();
        if (optsRef.current.toastErrors !== false) toast.show(err.message, 'error');
        optsRef.current.onError?.(err);
        return undefined;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [fn, toast],
  );

  return { run, busy, error, setError };
}
