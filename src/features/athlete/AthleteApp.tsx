import { useState } from "react";
import { Icons, TabBar } from "../../components/ui";
import DashboardPage from "./DashboardPage";
import ProgramPage from "./ProgramPage";
import ProgressPage from "./ProgressPage";
import AthleteSettingsPage from "./AthleteSettingsPage";
import InboxPage from "../shared/InboxPage";

export default function AthleteApp() {
  const [tab, setTab] = useState("home");
  const [inboxLinkId, setInboxLinkId] = useState<string | null>(null);

  function openInbox(linkId?: string) {
    setInboxLinkId(linkId ?? null);
    setTab("inbox");
  }

  return (
    <div className="pattern-bg min-h-dvh bg-bg">
      <main className="mx-auto max-w-md px-4 pb-28 pt-6 md:max-w-3xl md:pb-10 md:pl-28 lg:max-w-4xl">
        {tab === "home" && (
          <DashboardPage onGoProgress={() => setTab("progress")} onGoInbox={() => openInbox()} />
        )}
        {tab === "program" && <ProgramPage />}
        {tab === "progress" && <ProgressPage onOpenInbox={openInbox} />}
        {tab === "inbox" && (
          <InboxPage role="athlete" initialLinkId={inboxLinkId} onLinkOpened={() => setInboxLinkId(null)} />
        )}
        {tab === "settings" && <AthleteSettingsPage />}
      </main>
      <TabBar
        active={tab}
        onSelect={setTab}
        tabs={[
          { key: "home", label: "Home", icon: Icons.home },
          { key: "program", label: "Program", icon: Icons.plan },
          { key: "progress", label: "Progress", icon: Icons.progress },
          { key: "inbox", label: "Inbox", icon: Icons.inbox },
          { key: "settings", label: "Settings", icon: Icons.settings },
        ]}
      />
    </div>
  );
}
