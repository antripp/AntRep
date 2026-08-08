/**
 * State that survives a reload.
 *
 * Two flavours, both backed by localStorage and both safe when storage is
 * unavailable (private windows, quota exceeded) — they degrade to ordinary
 * `useState` rather than throwing.
 *
 *   usePersisted   small, cheap values: which tab you were on
 *   useDraft       work in progress that would hurt to lose: a half-built plan
 *
 * Drafts carry a timestamp and are ignored once stale, so a plan abandoned
 * weeks ago doesn't reappear over a fresh one. They are scoped per profile, so
 * two accounts in one browser can't read each other's work.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "antrep:";

/** Drafts older than this are treated as abandoned. */
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface Envelope<T> {
  at: number;
  value: T;
}

function read<T>(key: string): Envelope<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (typeof parsed?.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* storage full or blocked — the app still works, it just won't remember */
  }
}

function clear(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/**
 * `useState` that remembers. For navigation and view preferences — anything
 * where coming back to where you were beats starting over.
 */
export function usePersisted<T>(key: string, initial: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => read<T>(key)?.value ?? initial);

  const set = useCallback(
    (value: T) => {
      setState(value);
      write(key, value);
    },
    [key],
  );

  return [state, set];
}

export interface Draft<T> {
  value: T | null;
  /** Replaces the draft and saves it. */
  set: (value: T | null) => void;
  /** Saved without a reload having happened — i.e. restored from a previous visit. */
  restored: boolean;
  /** Throw the draft away, e.g. once it has been saved to the server. */
  discard: () => void;
}

/**
 * A single piece of in-progress work, kept across reloads.
 *
 * Writes are debounced so typing doesn't hammer localStorage, and flushed on
 * unmount and on `pagehide` — the latter is what catches a tab being closed or
 * the browser killing a backgrounded page, where no React cleanup runs.
 */
export function useDraft<T>(key: string, options?: { ttlMs?: number }): Draft<T> {
  const ttl = options?.ttlMs ?? DRAFT_TTL_MS;

  const [value, setValue] = useState<T | null>(() => {
    const stored = read<T>(key);
    if (!stored) return null;
    if (Date.now() - stored.at > ttl) {
      clear(key);
      return null;
    }
    return stored.value;
  });

  // True only if there was something waiting when this mounted.
  const [restored] = useState(() => {
    const stored = read<T>(key);
    return Boolean(stored && Date.now() - stored.at <= ttl);
  });

  const latest = useRef<T | null>(value);
  latest.current = value;

  const flush = useCallback(() => {
    if (latest.current === null) clear(key);
    else write(key, latest.current);
  }, [key]);

  const set = useCallback((next: T | null) => setValue(next), []);

  const discard = useCallback(() => {
    latest.current = null;
    setValue(null);
    clear(key);
  }, [key]);

  // Debounced save while editing.
  useEffect(() => {
    const timer = setTimeout(flush, 400);
    return () => clearTimeout(timer);
  }, [value, flush]);

  // A closing tab never runs React cleanup, so catch it at the browser level.
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return { value, set, restored, discard };
}
