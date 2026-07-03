import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

/**
 * Live sync: re-runs `onChange` whenever rows in any of the given tables
 * change. Events are debounced so a burst of writes (e.g. importing a
 * pasted plan) triggers a single silent refetch instead of many.
 *
 * Requires the tables to be in the Supabase realtime publication.
 */
export function useRealtime(channelKey: string, tables: string[], onChange: () => void) {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel(`live-${channelKey}`);
    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => cb.current(), 250);
      });
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey, tables.join(",")]);
}
