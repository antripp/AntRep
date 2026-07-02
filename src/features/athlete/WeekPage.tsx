import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  DAY_TYPE_COLORS,
  isoWeekday,
  localDateString,
  WEEKDAY_LABELS,
  type PlanDay,
  type Session,
} from "../../lib/types";
import { Card, Chip, EmptyState, Spinner } from "../../components/ui";
import { useAuth } from "../auth/useAuth";

/** This week at a glance: plan days + completion state per day. */
export default function WeekPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    (async () => {
      if (!profile) return;
      const { data: plans } = await supabase
        .from("plans")
        .select("id")
        .eq("athlete_id", profile.id)
        .eq("is_active", true)
        .limit(1);
      if (plans && plans.length > 0) {
        const { data } = await supabase
          .from("plan_days")
          .select("*")
          .eq("plan_id", plans[0].id)
          .order("weekday");
        setDays((data as PlanDay[]) ?? []);
      }
      const monday = new Date();
      monday.setDate(monday.getDate() - (isoWeekday(monday) - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const { data: sess } = await supabase
        .from("sessions")
        .select("*")
        .eq("athlete_id", profile.id)
        .gte("date", localDateString(monday))
        .lte("date", localDateString(sunday));
      setSessions((sess as Session[]) ?? []);
      setLoading(false);
    })();
  }, [profile]);

  if (loading) return <Spinner />;

  const todayWd = isoWeekday(new Date());

  return (
    <>
      <h1 className="mb-4 text-2xl font-black">This week</h1>
      {days.length === 0 ? (
        <Card>
          <EmptyState mascot title="No plan yet" subtitle="Once your coach builds your plan, your week shows up here." />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
            const day = days.find((d) => d.weekday === wd);
            const session = sessions.find((s) => s.plan_day_id != null && s.plan_day_id === day?.id);
            const isToday = wd === todayWd;
            return (
              <Card
                key={wd}
                className={`flex items-center gap-3 ${isToday ? "ring-2 ring-mint-deep" : ""}`}
              >
                <span
                  className={`w-11 shrink-0 text-center text-sm font-black ${isToday ? "text-mint-deep" : "text-chip"}`}
                >
                  {WEEKDAY_LABELS[wd - 1]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{day?.title || "Rest"}</p>
                  {session?.status === "complete" && (
                    <p className="text-xs font-bold text-done-back">✓ Completed</p>
                  )}
                  {session?.status === "in_progress" && (
                    <p className="text-xs font-bold text-star">In progress…</p>
                  )}
                </div>
                <Chip
                  label={day?.day_type ?? "rest"}
                  color={DAY_TYPE_COLORS[day?.day_type ?? "rest"]}
                />
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
