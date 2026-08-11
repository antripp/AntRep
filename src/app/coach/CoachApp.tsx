/** Coach portal shell: Athletes · Plans · My training · Settings. */

import { useCallback, useEffect, useState } from "react";
import { usePersisted } from "../usePersisted";
import { api } from "../../data";
import type { CoachWorkspace } from "../../data/api";
import type { Profile, Role } from "../../data/types";
import { Button, Card, Icon, LoadingScreen, Screen, ScreenTitle, TabBar, Toast } from "../../ui/kit";
import { useAuth } from "../auth";
import SettingsScreen from "../shared/SettingsScreen";
import { DbFaultBanner } from "../shared/DbFaultBanner";
import HomeScreen from "../athlete/HomeScreen";
import { ExerciseLibraryScreen } from "../athlete/ExercisesScreen";
import PlansScreen from "../athlete/PlansScreen";
import ProgressScreen from "../progress/ProgressScreen";
import { WorkspaceProvider, useWorkspace } from "../workspace";
import AthleteDetailScreen from "./AthleteDetailScreen";
import AthletesScreen from "./AthletesScreen";
import CoachPlansScreen from "./CoachPlansScreen";
import { BatchLogPage } from "../shared/BatchLogSheet";

const TABS = [
  { key: "athletes", label: "Athletes", icon: Icon.people },
  { key: "plans", label: "Plans", icon: Icon.plan },
  { key: "exercises", label: "Exercises", icon: Icon.dumbbell },
  { key: "training", label: "My training", icon: Icon.dumbbell },
  { key: "settings", label: "Settings", icon: Icon.settings },
];

const emptyWorkspace: CoachWorkspace = {
  plans: [],
  presets: [],
  athletes: [],
  selfAthlete: null,
  pendingInvites: [],
  assignments: [],
};

export default function CoachApp({
  profile,
  onSwitchPortal,
}: {
  profile: Profile;
  onSwitchPortal: (role: Role) => void;
}) {
  const { profiles, refresh } = useAuth();
  const [tab, setTab] = usePersisted("coach-tab", "athletes");
  const [workspace, setWorkspace] = useState<CoachWorkspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [openAthlete, setOpenAthlete] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setWorkspace(await api.coachWorkspace(profile));
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const athleteProfile = profiles.find((p) => p.role === "athlete") ?? null;
  const detail = workspace.athletes.find((a) => a.profile.id === openAthlete) ?? null;

  if (loading) return <LoadingScreen />;

  return (
    <>
      <DbFaultBanner />
      {tab === "training" && athleteProfile ? (
        <WorkspaceProvider profile={athleteProfile}>
          <CoachTraining />
        </WorkspaceProvider>
      ) : (
        <Screen>
          {tab === "athletes" &&
            (detail ? (
              <AthleteDetailScreen
                athlete={detail}
                coach={profile}
                workspace={workspace}
                onBack={() => setOpenAthlete(null)}
                onChanged={reload}
                onToast={setToast}
              />
            ) : (
              <AthletesScreen
                workspace={workspace}
                onOpen={setOpenAthlete}
                onReload={reload}
                onToast={setToast}
              />
            ))}

          {tab === "plans" && (
            <CoachPlansScreen coach={profile} workspace={workspace} onReload={reload} onToast={setToast} />
          )}

          {tab === "exercises" && (
            <ExerciseLibraryScreen
              profile={profile}
              presets={workspace.presets}
              reload={reload}
              showToast={setToast}
              title="Exercises"
              usage="coach"
            />
          )}

          {tab === "training" && !athleteProfile && (
            <>
              <ScreenTitle title="My training" />
              <Card>
                <p className="text-sm font-black text-ink">Train with AntRep too</p>
                <p className="mt-1 text-xs font-semibold leading-snug text-muted">
                  Turn on your athlete side to log your own workouts against your own plan. Same account.
                </p>
                <Button
                  className="mt-3"
                  full
                  onClick={async () => {
                    await api.enableRole("athlete", profile.display_name);
                    await refresh();
                  }}
                >
                  Enable my athlete profile
                </Button>
              </Card>
            </>
          )}

          {tab === "settings" && (
            <SettingsScreen profile={profile} onReload={reload} onSwitchPortal={onSwitchPortal} />
          )}
        </Screen>
      )}

      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}

/** The coach's own Home + plans, powered by their athlete profile. */
function CoachTraining() {
  const {
    loading,
    profile,
    planViews,
    pastViews,
    sessions,
    logs,
    reload,
    showToast,
    toast,
    clearToast,
  } = useWorkspace();
  const [view, setView] = useState<"home" | "plans" | "progress">("home");
  const [batchPlanId, setBatchPlanId] = useState<string | null | undefined>(undefined);

  if (loading) return <LoadingScreen />;

  if (batchPlanId !== undefined) {
    return (
      <>
        <Screen className="ui-batch-log-screen">
          <BatchLogPage
            onBack={() => setBatchPlanId(undefined)}
            athleteId={profile.id}
            initialPlanId={batchPlanId}
            plans={[...planViews, ...pastViews].map((item) => ({
              bundle: item.bundle,
              start: item.start,
              end: item.end,
            }))}
            sessions={sessions}
            logs={logs}
            onSaved={reload}
            onToast={showToast}
          />
        </Screen>
        <Toast message={toast} onDone={clearToast} />
      </>
    );
  }

  return (
    <>
      <Screen>
        <div className="mb-4 flex gap-1.5">
          {(["home", "plans", "progress"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-black ${
                view === key ? "bg-accent text-white" : "border border-line bg-surface text-muted"
              }`}
            >
              {key === "home" ? "Today" : key === "plans" ? "My plans" : "Progress"}
            </button>
          ))}
        </div>
        {view === "home" && <HomeScreen onGoPlans={() => setView("plans")} />}
        {view === "plans" && <PlansScreen onBatchLog={setBatchPlanId} context="coach-training" />}
        {view === "progress" && <ProgressScreen onBatchLog={setBatchPlanId} />}
      </Screen>
      <Toast message={toast} onDone={clearToast} />
    </>
  );
}
