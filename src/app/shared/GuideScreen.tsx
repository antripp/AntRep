/**
 * The onboarding guide, in the app.
 *
 * Content comes from `src/content/guide.json`, which is also what builds the
 * PDF (`npm run guide:pdf`) — one source, so the two can't drift apart.
 */

import { useState } from "react";
import guide from "../../content/guide.json";
import { Card, Icon, IconButton, Pill, SectionHeader } from "../../ui/kit";

interface GuideTable {
  head: string[];
  rows: string[][];
}

interface GuideSection {
  title: string;
  body?: string[];
  steps?: string[];
  table?: GuideTable;
  /** Paragraphs that read after the table. */
  body2?: string[];
  tip?: string;
  /** Current demo UI, shared by the in-app and PDF tutorial. */
  screenshots?: { name: string; caption: string }[];
}

interface GuidePart {
  id: string;
  title: string;
  audience: string;
  intro: string;
  sections: GuideSection[];
}

const PARTS = guide.parts as GuidePart[];

export default function GuideScreen({ onBack }: { onBack: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const part = PARTS.find((p) => p.id === openId) ?? null;

  if (part) {
    return (
      <>
        <div className="mb-4 flex items-center gap-2">
          <IconButton label="Back to contents" onClick={() => setOpenId(null)}>
            <Icon.back className="h-4 w-4" />
          </IconButton>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-black leading-tight text-ink">{part.title}</h1>
            <p className="truncate text-xs font-bold text-muted">{part.audience}</p>
          </div>
        </div>

        <p className="mb-4 text-sm font-semibold leading-relaxed text-muted">{part.intro}</p>

        {part.sections.map((section) => (
          <Section key={section.title} section={section} />
        ))}

        <PartNav current={part} onGo={setOpenId} />
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Back to settings" onClick={onBack}>
          <Icon.back className="h-4 w-4" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black leading-tight text-ink">{guide.title}</h1>
          <p className="truncate text-xs font-bold text-muted">{guide.edition}</p>
        </div>
      </div>

      <p className="mb-4 text-sm font-semibold leading-relaxed text-muted">{guide.subtitle}</p>

      <div className="space-y-2">
        {PARTS.map((p) => (
          <Card key={p.id} onClick={() => setOpenId(p.id)}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-ink">{p.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-muted">{p.intro}</p>
              </div>
              <Pill tint="var(--t-accent)">{p.audience}</Pill>
              <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function Section({ section }: { section: GuideSection }) {
  return (
    <>
      <SectionHeader title={section.title} />

      {section.body && section.body.length > 0 && (
        <Card className="mb-2">
          <div className="space-y-2">
            {section.body.map((line, i) => (
              <p key={i} className="text-sm font-semibold leading-relaxed text-ink">
                {line}
              </p>
            ))}
          </div>
        </Card>
      )}

      {section.steps && section.steps.length > 0 && (
        <Card className="mb-2">
          <ol className="space-y-2">
            {section.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-black text-white">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold leading-relaxed text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {section.table && (
        <div className="mb-2 overflow-hidden rounded-card border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {section.table.head.map((cell) => (
                    <th
                      key={cell}
                      className="border-b border-line px-3 py-2 text-[10px] font-black uppercase tracking-wide text-muted"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.table.rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      background:
                        i % 2 === 1
                          ? "color-mix(in srgb, var(--t-inset) 45%, var(--t-surface))"
                          : "var(--t-surface)",
                    }}
                  >
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className={`border-b border-line px-3 py-2 align-top text-[12px] leading-snug ${
                          j === 0 ? "font-black text-ink" : "font-semibold text-muted"
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section.body2 && section.body2.length > 0 && (
        <Card className="mb-2">
          <div className="space-y-2">
            {section.body2.map((line, i) => (
              <p key={i} className="text-sm font-semibold leading-relaxed text-ink">
                {line}
              </p>
            ))}
          </div>
        </Card>
      )}

      {section.screenshots && section.screenshots.length > 0 && (
        <div className="mb-2 space-y-2">
          {section.screenshots.map((screenshot) => (
            <GuideScreenshot key={screenshot.name} screenshot={screenshot} />
          ))}
        </div>
      )}

      {section.tip && (
        <div
          className="mb-2 flex gap-2.5 rounded-card px-3 py-2.5"
          style={{ background: "color-mix(in srgb, var(--t-accent) 12%, transparent)" }}
        >
          <Icon.star className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <p className="text-xs font-semibold leading-relaxed text-ink">{section.tip}</p>
        </div>
      )}
    </>
  );
}

function GuideScreenshot({ screenshot }: { screenshot: { name: string; caption: string } }) {
  const [portrait, setPortrait] = useState(true);

  return (
    <figure className="overflow-hidden rounded-card border border-line bg-inset p-2">
      <img
        src={`${import.meta.env.BASE_URL}guide/${screenshot.name}.png`}
        alt={screenshot.caption}
        loading="lazy"
        onLoad={(event) => {
          const image = event.currentTarget;
          setPortrait(image.naturalHeight / image.naturalWidth > 1.4);
        }}
        className={`mx-auto block w-full rounded-2xl border border-line ${portrait ? "max-w-sm" : ""}`}
      />
      <figcaption className="px-1 pb-1 pt-2 text-[10px] font-semibold leading-relaxed text-muted">
        {screenshot.caption}
      </figcaption>
    </figure>
  );
}

/** Straight on to the next part, so the guide reads end to end. */
function PartNav({ current, onGo }: { current: GuidePart; onGo: (id: string | null) => void }) {
  const index = PARTS.findIndex((p) => p.id === current.id);
  const previous = PARTS[index - 1] ?? null;
  const next = PARTS[index + 1] ?? null;

  return (
    <div className="mt-6 space-y-2">
      {next && (
        <Card onClick={() => onGo(next.id)}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-wide text-muted">Next</p>
              <p className="truncate text-sm font-black text-ink">{next.title}</p>
            </div>
            <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
          </div>
        </Card>
      )}
      <div className="flex gap-2">
        {previous && (
          <button
            className="flex-1 rounded-full border border-line bg-surface py-2.5 text-xs font-black text-ink"
            onClick={() => onGo(previous.id)}
          >
            ← {previous.title}
          </button>
        )}
        <button
          className="flex-1 rounded-full border border-line bg-surface py-2.5 text-xs font-black text-ink"
          onClick={() => onGo(null)}
        >
          All parts
        </button>
      </div>
    </div>
  );
}
