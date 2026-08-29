import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type Phase = "available" | "downloading" | "ready" | "failed";

/** Prüft beim Start einmal auf eine neue Version und bietet das Update an.
 *
 *  Die Prüfung fragt `latest.json` aus dem jeweils neuesten GitHub-Release ab
 *  (Endpoint und Signaturschlüssel stehen in `tauri.conf.json`). Schlägt sie
 *  fehl — kein Netz, GitHub nicht erreichbar, noch gar kein Release —, bleibt
 *  das bewusst stumm: ein Schreibprogramm soll beim Start nicht meckern.
 *
 *  Im Entwicklungsmodus ist der Updater nicht eingebunden, dort passiert nichts. */
export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<Phase>("available");
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void check()
      .then((found) => {
        if (!cancelled && found) setUpdate(found);
      })
      .catch((e) => console.warn("Update-Prüfung fehlgeschlagen:", e));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update || dismissed) return null;

  const install = async () => {
    setPhase("downloading");
    setProgress(0);
    try {
      let total = 0;
      let done = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          done += event.data.chunkLength;
          if (total > 0) setProgress(Math.round((done / total) * 100));
        }
      });
      // Unter Windows startet der Installer und beendet die App selbst; der
      // Neustart hier greift für den Fall, dass sie noch läuft.
      setPhase("ready");
      await relaunch();
    } catch (e) {
      console.error("Update fehlgeschlagen:", e);
      setPhase("failed");
    }
  };

  if (phase === "downloading") {
    return (
      <div className="banner info">
        <span>
          Version {update.version} wird geladen{progress > 0 ? ` — ${progress} %` : "…"}
        </span>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="banner info">
        <span>Version {update.version} ist installiert. Gesabbel startet neu…</span>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="banner warning">
        <span>
          Das Update auf Version {update.version} hat nicht geklappt. Du kannst es erneut
          versuchen oder die Version später von Hand herunterladen.
        </span>
        <button onClick={() => void install()}>Erneut versuchen</button>
        <button onClick={() => setDismissed(true)}>Später</button>
      </div>
    );
  }

  return (
    <div className="banner info">
      <span>
        Version {update.version} ist verfügbar (installiert: {update.currentVersion}).
      </span>
      <button onClick={() => void install()}>Jetzt aktualisieren</button>
      <button onClick={() => setDismissed(true)}>Später</button>
    </div>
  );
}
