import { useCallback, useEffect, useState } from "react";
import { loadExerciseLibrary, type LibraryExercise } from "../../data/exerciseLibrary";

export function useExerciseLibrary() {
  const [exercises, setExercises] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      setExercises(await loadExerciseLibrary(force));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the exercise database");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { exercises, loading, error, retry: () => load(true) };
}
