import { useCallback, useEffect, useState } from 'react';

import { localStore } from '@/utils/storage';

/**
 * A small most-recent-first list stored on the device (recently viewed
 * products, search history). Shared across screens through a module cache.
 */
const memory = new Map<string, string[]>();
const listeners = new Map<string, Set<(v: string[]) => void>>();

function emit(key: string, value: string[]) {
  memory.set(key, value);
  listeners.get(key)?.forEach((l) => l(value));
}

export function useLocalList(key: string | null, max = 12) {
  const [items, setItems] = useState<string[]>(() => (key ? (memory.get(key) ?? []) : []));

  useEffect(() => {
    if (!key) return;
    const set = listeners.get(key) ?? new Set();
    set.add(setItems);
    listeners.set(key, set);
    if (!memory.has(key)) {
      localStore.get<string[]>(key, []).then((v) => emit(key, Array.isArray(v) ? v : []));
    } else {
      setItems(memory.get(key)!);
    }
    return () => {
      set.delete(setItems);
    };
  }, [key]);

  const push = useCallback(
    (value: string) => {
      if (!key || !value.trim()) return;
      const next = [value, ...(memory.get(key) ?? []).filter((v) => v.toLowerCase() !== value.toLowerCase())].slice(0, max);
      emit(key, next);
      localStore.set(key, next);
    },
    [key, max],
  );

  const removeItem = useCallback(
    (value: string) => {
      if (!key) return;
      const next = (memory.get(key) ?? []).filter((v) => v !== value);
      emit(key, next);
      localStore.set(key, next);
    },
    [key],
  );

  const clear = useCallback(() => {
    if (!key) return;
    emit(key, []);
    localStore.set(key, []);
  }, [key]);

  return { items, push, removeItem, clear };
}
