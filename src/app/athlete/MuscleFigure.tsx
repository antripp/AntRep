import { useEffect, useState } from "react";
import type { LibraryExercise, MuscleInfo } from "../../data/exerciseLibrary";

const BASE_FRONT = "https://wger.de/static/images/muscles/muscular_system_front.svg";
const BASE_BACK = "https://wger.de/static/images/muscles/muscular_system_back.svg";

const themedSvgCache = new Map<string, Promise<string>>();

function themedSvg(url: string, color: string): Promise<string> {
  const key = `${url}|${color}`;
  let value = themedSvgCache.get(key);
  if (!value) {
    value = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Muscle overlay unavailable");
        return response.text();
      })
      .then((svg) => {
        const themed = svg
          .replace(/#(?:fc0000|ff0000|f57900)/gi, color)
          .replace(/fill:\s*#[0-9a-f]{6}/gi, `fill:${color}`);
        return URL.createObjectURL(new Blob([themed], { type: "image/svg+xml" }));
      });
    themedSvgCache.set(key, value);
  }
  return value;
}

function MuscleLayer({ url, primary }: { url: string; primary: boolean }) {
  const [source, setSource] = useState(url);
  useEffect(() => {
    if (!url) return;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--t-accent").trim() || "#58cc02";
    let active = true;
    themedSvg(url, primary ? accent : "#ffc800")
      .then((value) => { if (active) setSource(value); })
      .catch(() => { if (active) setSource(url); });
    return () => { active = false; };
  }, [primary, url]);
  return <img src={source} alt="" className={`absolute inset-0 h-full w-full object-contain ${primary ? "opacity-90" : "opacity-70"}`} />;
}

function Figure({ front, primary, secondary }: { front: boolean; primary: MuscleInfo[]; secondary: MuscleInfo[] }) {
  const visible = (item: MuscleInfo) => item.isFront === front;
  return (
    <div className="relative mx-auto aspect-[200/369] h-full max-h-48 w-full" aria-hidden="true">
      <img src={front ? BASE_FRONT : BASE_BACK} alt="" className="absolute inset-0 h-full w-full object-contain opacity-55" />
      {secondary.filter(visible).map((item) => (
        <MuscleLayer key={`s-${item.id}`} url={item.imageURLSecondary || item.imageURLMain} primary={false} />
      ))}
      {primary.filter(visible).map((item) => (
        <MuscleLayer key={`p-${item.id}`} url={item.imageURLMain} primary />
      ))}
    </div>
  );
}

export function MuscleFigure({ exercise, compact = false }: { exercise: LibraryExercise; compact?: boolean }) {
  const hasMuscles = exercise.primaryMuscles.length + exercise.secondaryMuscles.length > 0;
  if (!hasMuscles) {
    return compact ? null : <p className="py-5 text-center text-sm font-semibold text-muted">No muscle data available.</p>;
  }
  return (
    <div className={`grid grid-cols-2 gap-2 ${compact ? "h-16 w-20 shrink-0" : "h-52"}`}>
      <Figure front primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles} />
      <Figure front={false} primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles} />
    </div>
  );
}
