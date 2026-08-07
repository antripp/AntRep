import type { PlanProgramMismatch } from "../../lib/planSync";
import { Button, Card } from "../../components/ui";

export default function PlanProgramBanner({
  mismatch,
  onSync,
  busy,
}: {
  mismatch: PlanProgramMismatch;
  onSync: () => void;
  busy?: boolean;
}) {
  const parts: string[] = [];
  if (mismatch.durationMismatch) {
    parts.push(`Plan is ${mismatch.planWeeks} weeks but program is set to ${mismatch.programWeeks}`);
  }
  if (mismatch.startMismatch) {
    parts.push(`Start dates differ (plan ${mismatch.planStart} vs program ${mismatch.programStart})`);
  }
  if (mismatch.onlyInPlan.length > 0) {
    parts.push(`On plan only: ${mismatch.onlyInPlan.join(", ")}`);
  }
  if (mismatch.onlyInProgression.length > 0) {
    parts.push(`Tracked but not on plan: ${mismatch.onlyInProgression.join(", ")}`);
  }

  return (
    <Card className="border-accent/40 bg-accent-soft">
      <p className="text-sm font-extrabold text-accent">Plan & program out of sync</p>
      <p className="mt-1 text-xs font-semibold text-muted">
        The weekly plan and progression tracking can show different exercises or timelines.
      </p>
      <ul className="mt-2 flex flex-col gap-0.5 text-xs font-semibold text-muted">
        {parts.map((p) => (
          <li key={p}>• {p}</li>
        ))}
      </ul>
      <Button className="mt-3 text-xs" onClick={onSync} disabled={busy}>
        {busy ? "Syncing…" : "Sync program from plan"}
      </Button>
    </Card>
  );
}
