/** Athlete portal shell: Home · Plans · Progress · Library · Settings. */

import { usePersisted } from "../usePersisted";
import type { Profile, Role } from "../../data/types";
import { Icon, LoadingScreen, Screen, TabBar, Toast } from "../../ui/kit";
import SettingsScreen from "../shared/SettingsScreen";
import { DataSection } from "./DataSection";
import { DbFaultBanner } from "../shared/DbFaultBanner";
import ProgressScreen from "../progress/ProgressScreen";
import { useWorkspace, WorkspaceProvider } from "../workspace";
import CoachScreen from "./CoachScreen";
import ExercisesScreen from "./ExercisesScreen";
import HomeScreen from "./HomeScreen";
import PlansScreen from "./PlansScreen";

const TABS = [
  { key: "home", label: "Home", icon: Icon.home },
  { key: "plans", label: "Plans", icon: Icon.plan },
  { key: "coach", label: "Coach", icon: Icon.people },
  { key: "progress", label: "Progress", icon: Icon.progress },
  { key: "exercises", label: "Library", icon: Icon.dumbbell },
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
  const { loading, profile, workspace, reload, toast, clearToast } = useWorkspace();
  const [tab, setTab] = usePersisted("athlete-tab", "home");

  if (loading) return <LoadingScreen />;

  return (
    <>
      <DbFaultBanner />
      <Screen>
        {tab === "home" && <HomeScreen onGoPlans={() => setTab("plans")} />}
        {tab === "plans" && <PlansScreen />}
        {tab === "coach" && <CoachScreen />}
        {tab === "progress" && <ProgressScreen />}
        {tab === "exercises" && <ExercisesScreen />}
        {tab === "settings" && (
          <SettingsScreen
            profile={profile}
            coaches={workspace.coaches}
            onReload={reload}
            onSwitchPortal={onSwitchPortal}
            extra={<DataSection />}
          />
        )}
      </Screen>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      <Toast message={toast} onDone={clearToast} />
    </>
  );
}
