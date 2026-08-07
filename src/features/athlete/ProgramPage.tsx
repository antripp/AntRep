import { useState } from "react";
import { Segmented } from "../../components/ui";
import SchedulePage from "./SchedulePage";
import PlanPage from "./PlanPage";

export default function ProgramPage() {
  const [view, setView] = useState<"schedule" | "plan">("schedule");

  return (
    <>
      <header className="mb-4">
        <h1 className="text-2xl font-black">Program</h1>
        <p className="text-sm font-semibold text-muted">Your schedule and plan board</p>
      </header>

      <div className="mb-4 w-full max-w-xs">
        <Segmented
          options={[
            { key: "schedule", label: "Schedule" },
            { key: "plan", label: "Plan" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {view === "schedule" ? <SchedulePage embedded /> : <PlanPage embedded />}
    </>
  );
}
