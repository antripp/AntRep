/** Athlete portal shell: Home · Plans · Progress · Exercises · Settings. */

import { useState } from "react";
import type { Profile, Role } from "../../data/types";
import { Icon, LoadingScreen, Screen, SectionHeader, TabBar, Toast } from "../../ui/kit";
import SettingsScreen from "../shared/SettingsScreen";
import { SessionList } from "../shared/SessionHistory";
import { useWorkspace, WorkspaceProvider } from "../workspace";
import CoachScreen from "./CoachScreen";
import LibrarySection from "./LibrarySection";
import ExercisesScreen from "./ExercisesScreen";
import HomeScreen from "./HomeScreen";
import PlansScreen from "./PlansScreen";
import ProgressScreen from "./ProgressScreen";

const TABS = [
  { key: "home", label: "Home", icon: Icon.home },
  { key: "plans", label: "Plans", icon: Icon.plan },
  { key: "coach", label: "Coach", icon: Icon.people },
  { key: "progress", label: "Progress", icon: Icon.progress },
  { key: "exercises", label: "Exercises", icon: Icon.dumbbell },
  { key: "settings", label: "Settings", icon: Icon.settings },
];

export default function AthleteApp({
  profile,
  onSwitchPortal,
}: {
  profile: Profile;
  onSwitchPortal: (role: Role) => void;
}) {
  return (
    <WorkspaceProvider profile={profile}>
      <AthleteShell onSwitchPortal={onSwitchPortal} />
    </WorkspaceProvider>
  );
}

function AthleteShell({ onSwitchPortal }: { onSwitchPortal: (role: Role) => void }) {
  const { loading, profile, workspace, sessions, logs, reload, toast, clearToast } = useWorkspace();
  const [tab, setTab] = useState("home");

  if (loading) return <LoadingScreen />;

  return (
    <>
      <Screen>
        {tab === "home" && <HomeScreen onGoPlans={() => setTab("plans")} />}
        {tab === "plans" && <PlansScreen />}
        {tab === "coach" && <CoachScreen />}
        {tab === "progress" && (
          <>
            <ProgressScreen />
            <SectionHeader title="Recent sessions" />
            <SessionList sessions={sessions} logs={logs} limit={12} />
          </>
        )}
        {tab === "exercises" && <ExercisesScreen />}
        {tab === "settings" && (
          <SettingsScreen
            profile={profile}
            coaches={workspace.coaches}
            onReload={reload}
            onSwitchPortal={onSwitchPortal}
            extra={<LibrarySection />}
          />
        )}
      </Screen>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      <Toast message={toast} onDone={clearToast} />
    </>
  );
}
