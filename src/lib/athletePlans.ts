import { supabase } from "./supabase";
import { isSchemaOutdated } from "../components/MigrationNotice";
import {
  effectiveStart,
  type AthletePlan,
  type Plan,
  type PlanAssignment,
  type Profile,
} from "./types";

export interface AthletePlansResult {
  plans: AthletePlan[];
  coachNames: Map<string, string>;
  schemaOld: boolean;
}

/**
 * Everything the athlete is assigned to: plans via plan_assignments with
 * each assignment's effective start date, plus coach display names.
 * (Pick "what applies today" with activeAthletePlans().)
 */
export async function fetchAthletePlans(athleteId: string): Promise<AthletePlansResult> {
  const empty = { plans: [], coachNames: new Map<string, string>(), schemaOld: false };

  const { data: aRows, error } = await supabase
    .from("plan_assignments")
    .select("*")
    .eq("athlete_id", athleteId);
  if (error) return { ...empty, schemaOld: isSchemaOutdated(error) };

  const assignments = (aRows as PlanAssignment[]) ?? [];
  if (assignments.length === 0) return empty;

  const { data: planRows } = await supabase
    .from("plans")
    .select("*")
    .in("id", assignments.map((a) => a.plan_id))
    .eq("is_active", true);
  const plans = (planRows as Plan[]) ?? [];

  const athletePlans: AthletePlan[] = plans.map((plan) => {
    const assignment = assignments.find((a) => a.plan_id === plan.id)!;
    return { plan, assignment, start: effectiveStart(plan, assignment) };
  });

  let coachNames = new Map<string, string>();
  if (plans.length > 0) {
    const { data: coaches } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", [...new Set(plans.map((p) => p.trainer_id))]);
    coachNames = new Map(((coaches as Profile[]) ?? []).map((c) => [c.id, c.display_name]));
  }

  return { plans: athletePlans, coachNames, schemaOld: false };
}
