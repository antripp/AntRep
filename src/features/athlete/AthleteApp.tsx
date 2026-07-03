import { useState } from "react";
import { Icons, TabBar } from "../../components/ui";
import TodayPage from "./TodayPage";
import SchedulePage from "./SchedulePage";
import PlanPage from "./PlanPage";
import AthleteSettingsPage from "./AthleteSettingsPage";

export default function AthleteApp() {
  const [tab, setTab] = useState("today");
  return (
    <div className="pattern-bg min-h-dvh bg-bg">
      <main className="mx-auto max-w-md px-4 pb-28 pt-6 md:max-w-3xl md:pb-10 md:pl-28 lg:max-w-4xl">
        {tab === "today" && <TodayPage />}
        {tab === "schedule" && <SchedulePage />}
        {tab === "plan" && <PlanPage />}
        {tab === "settings" && <AthleteSettingsPage />}
      </main>
      <TabBar
        active={tab}
        onSelect={setTab}
        tabs={[
          { key: "today", label: "Today", icon: Icons.today },
          { key: "schedule", label: "Schedule", icon: Icons.week },
          { key: "plan", label: "Plan", icon: Icons.plan },
          { key: "settings", label: "Settings", icon: Icons.settings },
        ]}
      />
    </div>
  );
}
