import { useState } from "react";
import { Icons, TabBar } from "../../components/ui";
import TodayPage from "./TodayPage";
import WeekPage from "./WeekPage";
import AthleteSettingsPage from "./AthleteSettingsPage";

export default function AthleteApp() {
  const [tab, setTab] = useState("today");
  return (
    <div className="min-h-dvh bg-mint">
      <main className="mx-auto max-w-md px-4 pb-28 pt-6 md:max-w-2xl md:pb-10 md:pl-28 lg:max-w-3xl">
        {tab === "today" && <TodayPage />}
        {tab === "week" && <WeekPage />}
        {tab === "settings" && <AthleteSettingsPage />}
      </main>
      <TabBar
        active={tab}
        onSelect={setTab}
        tabs={[
          { key: "today", label: "Today", icon: Icons.today },
          { key: "week", label: "Week", icon: Icons.week },
          { key: "settings", label: "Settings", icon: Icons.settings },
        ]}
      />
    </div>
  );
}
