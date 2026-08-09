/**
 * Rest countdown between sets — entirely opt-in.
 *
 * The plan's `rest_sec` is a suggestion, so this never starts on its own and
 * nothing waits on it: it's a stopwatch you press if you want one, and the
 * logger behaves identically whether you do or not.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration } from "../../domain/dates";
import { Icon } from "../../ui/kit";

export interface RestTimerState {
  /** Seconds left, 0 when idle or finished. */
  remaining: number;
  running: boolean;
  /** Reached zero and not yet dismissed. */
  finished: boolean;
  start: (seconds?: number) => void;
  extend: (seconds: number) => void;
  stop: () => void;
}

/**
 * Counts down against the wall clock rather than by decrementing a counter.
 *
 * Rest is exactly when a phone gets put down and the screen locks, which is
 * when `setInterval` gets throttled or suspended — an interval that has ticked
 * 40 times in 90 seconds would report a minute of rest as most of two. Only the
 * end timestamp is state; the interval merely re-renders.
 */
export function useRestTimer(defaultSeconds: number): RestTimerState {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null || now >= endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt, now]);

  const remaining = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));
  const running = endsAt !== null && remaining > 0;
  const finished = endsAt !== null && remaining === 0;

  // One buzz as it lands, if the device does that and the user hasn't opted out
  // of motion. Re-armed on the next start.
  const buzzed = useRef(false);
  useEffect(() => {
    if (running) buzzed.current = false;
  }, [running]);
  useEffect(() => {
    if (!finished || buzzed.current) return;
    buzzed.current = true;
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([120, 60, 120]);
    }
  }, [finished]);

  // Both halves of the countdown come from ONE reading of the clock. Taking
  // `now` and `endsAt` from separate `Date.now()` calls leaves a sub-millisecond
  // gap, which `Math.ceil` rounds up into a whole extra second — a 90s rest
  // opening on "1:31".
  const start = useCallback(
    (seconds = defaultSeconds) => {
      const at = Date.now();
      setNow(at);
      setEndsAt(at + Math.max(1, seconds) * 1000);
    },
    [defaultSeconds],
  );

  const extend = useCallback((seconds: number) => {
    const at = Date.now();
    setNow(at);
    setEndsAt((prev) => Math.max(prev ?? at, at) + seconds * 1000);
  }, []);

  const stop = useCallback(() => setEndsAt(null), []);

  return { remaining, running, finished, start, extend, stop };
}

/** mm:ss for a countdown — `formatDuration` handles the padding. */
function clock(seconds: number): string {
  return formatDuration(Math.max(0, seconds));
}

/** The compact readout for a collapsed card, so a running timer stays visible. */
export function RestTimerPill({ timer, tint }: { timer: RestTimerState; tint: string }) {
  if (!timer.running && !timer.finished) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums"
      style={{
        background: timer.finished ? tint : `${tint}22`,
        color: timer.finished ? "#fff" : tint,
      }}
    >
      <Icon.clock className="h-3 w-3" />
      {timer.finished ? "Rest done" : clock(timer.remaining)}
    </span>
  );
}

/** Start / countdown / done, in one control that stays the same size throughout. */
export function RestTimerBar({
  timer,
  seconds,
  tint,
}: {
  timer: RestTimerState;
  /** The plan's suggested rest. */
  seconds: number;
  tint: string;
}) {
  if (timer.finished) {
    return (
      <button
        onClick={timer.stop}
        className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black text-white"
        style={{ background: tint }}
      >
        <Icon.check className="h-3.5 w-3.5" /> Rest done
      </button>
    );
  }

  if (timer.running) {
    const pct = seconds > 0 ? (timer.remaining / seconds) * 100 : 0;
    return (
      <span className="ml-auto inline-flex items-center gap-1.5">
        <span className="relative inline-flex h-7 items-center gap-1.5 overflow-hidden rounded-full border border-line bg-inset px-2.5">
          <span
            className="absolute inset-y-0 left-0 transition-[width] duration-300"
            style={{ width: `${Math.min(100, pct)}%`, background: `${tint}26` }}
          />
          <Icon.clock className="relative h-3.5 w-3.5" style={{ color: tint }} />
          <span className="relative text-[12px] font-black tabular-nums" style={{ color: tint }}>
            {clock(timer.remaining)}
          </span>
        </span>
        <button
          onClick={() => timer.extend(30)}
          className="rounded-full border border-line bg-inset px-2 py-1 text-[11px] font-black text-muted active:text-ink"
        >
          +30s
        </button>
        <button
          onClick={timer.stop}
          aria-label="Stop rest timer"
          className="rounded-full border border-line bg-inset px-2 py-1 text-[11px] font-black text-muted active:text-ink"
        >
          Skip
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => timer.start(seconds)}
      className="ml-auto inline-flex items-center gap-1 rounded-full border border-line bg-inset px-3 py-1.5 text-[11px] font-bold text-muted active:text-ink"
      title={`Start a ${clock(seconds)} rest`}
    >
      <Icon.clock className="h-3.5 w-3.5" /> {clock(seconds)} rest
    </button>
  );
}
