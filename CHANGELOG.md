# Changelog

Alle nennenswerten Änderungen an Gesabbel, neueste zuerst.

Der Abschnitt zur jeweiligen Version wird beim Release automatisch in die
GitHub-Release-Notes übernommen (siehe `.github/workflows/release.yml`). Die
Überschrift muss deshalb genau `## <Version>` lauten und zum Tag passen —
ohne passenden Abschnitt bricht der Release-Workflow ab.

Die Versionierung folgt der üblichen Lesart für 0.x: Die mittlere Zahl steigt
bei neuen Funktionen, die letzte bei Fehlerbehebungen.

## 0.2.0 — 2026-08-30

### Neu

- **Hintergrundbild für Dokumente.** Unter „Einstellungen → Darstellung" lässt
  sich ein Bild als Hintergrund der Dokumentenfläche wählen — wahlweise
  proportional füllend oder in Originalgröße gekachelt. Über einen eigenen
  Regler bestimmt die Deckkraft des Bildes, wie stark der Theme-Hintergrund
  darunter durchscheint.
- **Deckkraft der Schreibfläche.** Die Manuskriptseite lässt sich durchsichtig
  stellen, so dass das Hintergrundbild hinter dem Text sichtbar wird.
  Voreinstellung bleibt 100 % — am Schriftbild ändert sich ohne bewusste
  Entscheidung nichts.
- **Landing Page** unter `docs/` für GitHub Pages, mit Impressum,
  ECG-Offenlegung, Datenschutz- und KI-Hinweis.

### Hinweise

Das Hintergrundbild gehört zur App, nicht zum Projekt: Es liegt im
App-Config-Verzeichnis neben der `settings.json` und gilt daher für alle
Projekte. Bestehende Einstellungen bleiben gültig; die neuen Schlüssel werden
beim Laden aus den Voreinstellungen ergänzt.

## 0.1.1 — 2026-08-30

### Neu

- Die Versionsnummer steht jetzt im Startbildschirm — ohne sie ließ sich nicht
  feststellen, welcher Stand installiert ist.

### Dokumentation

- README: Workflow-Rechte als Voraussetzung fürs Release ergänzt.

## 0.1.0 — 2026-08-30

Erste veröffentlichte Fassung.

### Schreiben

- Editor auf TipTap-Basis mit Markdown als Speicherformat, Auszeichnungen,
  Überschriften, Textausrichtung und Bildern im Fließtext.
- Manuskriptseite mit einstellbarer Satzbreite, Schrift, Zeilenabstand,
  Blocksatz und automatischer Silbentrennung.
- Fokusmodus und Schreibmaschinen-Modus.

### Ordnen

- Projektformat `.autorproj` mit Binder aus Kapiteln und Szenen, per
  Drag & Drop umsortierbar.
- Corkboard mit Kurzfassungen, Status, Farben, Schlagworten und Kartenbildern.
- Schnellnavigation und Volltextsuche über das ganze Projekt.

### Planen

- Personen, Orte und Notizen als eigene Dokumente, mit Zeitstrahl.
- Planungs-Tags verlinken diese Einträge im Fließtext und zeigen alle
  Fundstellen zurück.
- Split-Layouts: bis zu vier Bereiche nebeneinander.

### Sichern und Ausgeben

- Interne Versionierung über Git mit Verlauf, Vergleich und Wiederherstellen
  einzelner Fassungen.
- Export nach DOCX, PDF, ePub, Markdown und TXT über Formatierungsvorlagen.

### Einrichten

- Themes (Papier, Nachtpapier, Sepia, Mitternacht, eigenes Theme), Editor- und
  Layout-Einstellungen sowie frei belegbare Tastaturkürzel.
- Selbst-Update über GitHub Releases.
