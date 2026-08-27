import { useStore, type ResearchTab } from "../store";
import { EntityPanel } from "./EntityPanel";
import { NotesPanel } from "./NotesPanel";
import { TimelinePanel } from "./TimelinePanel";

const TABS: { id: ResearchTab; label: string }[] = [
  { id: "characters", label: "Personen" },
  { id: "locations", label: "Orte" },
  { id: "notes", label: "Notizen" },
  { id: "timeline", label: "Zeitstrahl" },
];

export function Research() {
  const tab = useStore((s) => s.researchTab);
  const setTab = useStore((s) => s.setResearchTab);

  return (
    <div className="research">
      <div className="research-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? "on" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "characters" && <EntityPanel kind="characters" />}
      {tab === "locations" && <EntityPanel kind="locations" />}
      {tab === "notes" && <NotesPanel />}
      {tab === "timeline" && <TimelinePanel />}
    </div>
  );
}
