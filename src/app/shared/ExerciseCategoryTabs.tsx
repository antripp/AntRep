import type { ExerciseCategory } from "../../data/types";

export type ExerciseCategoryFilter = "all" | ExerciseCategory;

const OPTIONS: { value: ExerciseCategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "legs", label: "Legs" },
  { value: "core", label: "Core" },
  { value: "cardio", label: "Cardio" },
];

export function ExerciseCategoryTabs({
  value,
  onChange,
  counts,
}: {
  value: ExerciseCategoryFilter;
  onChange: (value: ExerciseCategoryFilter) => void;
  counts?: Partial<Record<ExerciseCategoryFilter, number>>;
}) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition-colors ${
            value === option.value
              ? "bg-accent text-white"
              : "border border-line bg-surface text-muted"
          }`}
        >
          {option.label}
          {counts?.[option.value] !== undefined && ` ${counts[option.value]}`}
        </button>
      ))}
    </div>
  );
}
