/**
 * The horizontal day board shared by the plan builder and the plan view.
 *
 * A split is a sequence of days, and a vertical list of nine of them buries the
 * end of the split below the fold. Columns side by side show the shape of the
 * week — how push/pull/rest fall against each other — and put one swipe between
 * any two days.
 *
 * Native overflow scrolling does the swiping, so there is no drag library and no
 * touch handling of our own: it inherits momentum, trackpads, shift-wheel and
 * screen readers for free. CSS scroll-snap makes it land on a column.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../ui/kit";

export interface BoardColumn {
  key: string;
  /** Short label for the jump chips — "D1", "Mon". */
  chip: string;
  /** Marks the column as carrying nothing yet, so its chip reads as muted. */
  empty?: boolean;
  content: React.ReactNode;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export function DayBoard({
  columns,
  label = "Plan days",
  tint = "var(--t-accent)",
}: {
  columns: BoardColumn[];
  label?: string;
  /** Colour for the active jump chip. */
  tint?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [overflows, setOverflows] = useState(false);

  /** Which column is under the left edge — the one the board has landed on. */
  const syncActive = useCallback(() => {
    const box = scroller.current;
    if (!box) return;
    setOverflows(box.scrollWidth > box.clientWidth + 4);

    let nearest = 0;
    let best = Infinity;
    items.current.forEach((el, i) => {
      if (!el) return;
      const delta = Math.abs(el.offsetLeft - box.scrollLeft);
      if (delta < best) {
        best = delta;
        nearest = i;
      }
    });
    setActive(nearest);
  }, []);

  useEffect(() => {
    syncActive();
    const box = scroller.current;
    if (!box) return;
    // Column widths are viewport-relative, so a resize changes how many fit and
    // therefore which one counts as active.
    const observer = new ResizeObserver(syncActive);
    observer.observe(box);
    return () => observer.disconnect();
  }, [syncActive, columns.length]);

  const goTo = useCallback((index: number) => {
    const el = items.current[index];
    if (!el) return;
    el.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      inline: "start",
      // Never drag the page vertically just to bring a column into view.
      block: "nearest",
    });
  }, []);

  const step = (delta: number) => goTo(Math.min(columns.length - 1, Math.max(0, active + delta)));

  return (
    <div>
      {/* Jump chips: the whole split at a glance, and one tap to any day. */}
      <div className="mb-2 flex items-center gap-1.5">
        <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {columns.map((column, index) => (
            <button
              key={column.key}
              onClick={() => goTo(index)}
              aria-current={index === active}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black transition-colors ${
                index === active
                  ? "text-white"
                  : column.empty
                    ? "border border-line bg-surface text-muted/60"
                    : "border border-line bg-surface text-muted"
              }`}
              style={index === active ? { background: tint } : undefined}
            >
              {column.chip}
            </button>
          ))}
        </div>

        {overflows && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => step(-1)}
              disabled={active === 0}
              aria-label="Previous day"
              className="rounded-full border border-line bg-surface p-1.5 text-muted disabled:opacity-30"
            >
              <Icon.back className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => step(1)}
              disabled={active >= columns.length - 1}
              aria-label="Next day"
              className="rounded-full border border-line bg-surface p-1.5 text-muted disabled:opacity-30"
            >
              <Icon.chevron className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scroller}
        onScroll={syncActive}
        role="group"
        aria-label={label}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            step(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            step(-1);
          }
        }}
        // `relative` makes the columns' offsetLeft relative to this box, which
        // is what syncActive measures against.
        className="relative -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-scrollbar]:hidden"
      >
        {columns.map((column, index) => (
          <div
            key={column.key}
            ref={(el) => {
              items.current[index] = el;
            }}
            // One column fills a phone; more come into view as the screen grows,
            // which is what turns the same markup into a board on a desktop.
            className="w-[82%] shrink-0 snap-start sm:w-[46%] lg:w-[31.5%] xl:w-[24%]"
          >
            {column.content}
          </div>
        ))}
      </div>
    </div>
  );
}
