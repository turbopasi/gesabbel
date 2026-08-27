import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [backendStatus, setBackendStatus] = useState("Verbinde mit Backend …");

  useEffect(() => {
    invoke<string>("app_info")
      .then(setBackendStatus)
      .catch((e) => setBackendStatus(`Backend-Fehler: ${e}`));
  }, []);

  return (
    <main className="container">
      <h1>Schreibsoftware</h1>
      <p>Desktop-Schreibsoftware für Autoren — Phase 0: Grundgerüst</p>
      <p className="status">{backendStatus}</p>
    </main>
  );
}

export default App;
