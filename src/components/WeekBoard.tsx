import { useRef, useState, type ReactNode } from "react";
import { isoWeekday, WEEKDAY_FULL } from "../lib/types";

/**
 * Trello-style week layout: on md+ screens all seven days render as
 * horizontal board columns; on smaller screens one day shows at a time
 * with arrow buttons and swipe gestures for fast navigation.
 * `renderDay` returns the full column content (header included).
 */
export default function WeekBoard({
  renderDay,
  highlightWeekday,
}: {
  renderDay: (weekday: number) => ReactNode;
  /** Weekday (1–7) to mark as "today"; also the initial mobile day. */
  highlightWeekday?: number | null;
}) {
  const [mobileDay, setMobileDay] = useState(highlightWeekday ?? isoWeekday(new Date()));
  const touchX = useRef<number | null>(null);

  function step(dir: -1 | 1) {
    setMobileDay((d) => ((d - 1 + dir + 7) % 7) + 1);
  }

  return (
    <>
      {/* Mobile: single day + arrows + swipe */}
      <div
        className="md:hidden"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1);
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <NavArrow dir="prev" onClick={() => step(-1)} />
          <span className={`text-sm font-black ${mobileDay === highlightWeekday ? "text-accent" : ""}`}>
            {WEEKDAY_FULL[mobileDay - 1]}
            {mobileDay === highlightWeekday && " · today"}
          </span>
          <NavArrow dir="next" onClick={() => step(1)} />
        </div>
        <div className="flex flex-col gap-2">{renderDay(mobileDay)}</div>
        <div className="mt-3 flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
            <button
              key={wd}
              type="button"
              aria-label={WEEKDAY_FULL[wd - 1]}
              onClick={() => setMobileDay(wd)}
              className={`h-2 rounded-full transition-all ${
                wd === mobileDay ? "w-5 bg-accent" : "w-2 bg-line"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Desktop: trello columns */}
      <div className="hidden items-start gap-3 overflow-x-auto pb-3 md:flex">
        {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
          <div
            key={wd}
            className={`flex w-60 shrink-0 flex-col gap-2 rounded-2xl p-2 ${
              wd === highlightWeekday ? "bg-accent-soft" : "bg-inset/60"
            }`}
          >
            {renderDay(wd)}
          </div>
        ))}
      </div>
    </>
  );
}

function NavArrow({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={dir === "prev" ? "previous day" : "next day"}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-b-4 border-line bg-surface font-black text-accent active:translate-y-[2px] active:border-b-2"
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
  );
}
