# Schriften

Lokal gebündelt, damit die App ohne Netzzugriff läuft. Eingebunden in
`src/styles/fonts.css`, Subsets `latin` und `latin-ext` (Google-Fonts-Zuschnitt,
bezogen über die Fontsource-Pakete).

| Familie | Rolle | Lizenz |
| --- | --- | --- |
| Literata | Manuskript- und Titelschrift | SIL Open Font License 1.1 |
| IBM Plex Sans | Oberflächenschrift | SIL Open Font License 1.1 |
| IBM Plex Mono | Zahlen, Zeitstempel, Kürzel, Pfade | SIL Open Font License 1.1 |

Die OFL erlaubt Weitergabe und Bündelung; die Dateien bleiben unverändert. Sie
verlangt aber, dass Copyright-Zeile und Lizenztext mitgeliefert werden — beides
liegt darum hier und wandert mit `public/` ins Bundle:

- `OFL-Literata.txt` — Copyright 2017 The Literata Project Authors
- `OFL-IBM-Plex.txt` — Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"

Beide Dateien sind unveränderte Kopien aus den Upstream-Repositories und dürfen
nicht gelöscht werden. Quellen:
<https://github.com/googlefonts/literata>, <https://github.com/IBM/plex>.

Der Verkauf der Schriftdateien für sich genommen ist untersagt; als Bestandteil
der Anwendung ist die Weitergabe ausdrücklich erlaubt. Dokumente, die mit den
Schriften gesetzt werden, unterliegen der OFL nicht.

Der Symbolsatz (Lucide, ISC) liegt nicht hier, sondern eingebettet in
`src/components/Icon.tsx`.
