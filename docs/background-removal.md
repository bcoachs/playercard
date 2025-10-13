# Hintergrundfreistellung mit MediaPipe Tasks Vision

Die Playercard-App nutzt [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/selfie_segmentation) für die Freistellung von Spielerporträts direkt im Browser. Damit entfallen zusätzliche IMG.LY-Abhängigkeiten oder ein eigenes Asset-Hosting.

## Architekturüberblick

- **Hilfsmodul**: `src/lib/mediapipeSegmentation.ts` kapselt das Laden des MediaPipe-Image-Segmenters und die Maskenverarbeitung.
- **Lazy Loading**: `loadImageSegmenter()` wird beim Mount der Playercard-Komponente ausgeführt und cacht die Instanz für weitere Aufrufe.
- **Bildaufbereitung**: `removeBackgroundWithMediapipe()` erzeugt aus der Mediapipe-Maske ein PNG mit transparentem Hintergrund. Optional kann ein Farbverlauf oder ein vorab geladenes Hintergrundbild eingeblendet werden.
- **Client-only**: Die gesamte Verarbeitung findet im Browser statt. Auf dem Server werden keine Modelle initialisiert.

## Ablauf bei der Bildverarbeitung

1. Nutzer:innen laden ein Bild hoch oder das vorhandene Spielerfoto wird von der App abgeholt.
2. Beim ersten Aufruf lädt die App das MediaPipe-WASM-Paket sowie das Selfie-Segmenter-Modell (`selfie_segmenter_landscape.tflite`).
3. `removeBackgroundWithMediapipe()` erstellt ein `ImageBitmap`, segmentiert das Motiv und kombiniert Maske, optionalen Hintergrund und Originalbild auf einem Canvas.
4. Das Ergebnis wird als PNG-Blob exportiert und über eine Object-URL in der Oberfläche angezeigt.
5. Nach der Verwendung werden temporäre Ressourcen (Object-URLs, ImageBitmaps) freigegeben.

## Konfiguration & Abhängigkeiten

- `@mediapipe/tasks-vision@^0.10.0` ist die einzige Laufzeitabhängigkeit für die Segmentierung.
- Es sind keine Environment-Variablen oder Rewrites mehr notwendig. Die Assets werden über das offizielle CDN von jsDelivr geladen.

## Fehlerbehandlung

- Scheitert das Vorladen des Modells, protokolliert die App `Fehler beim Laden des Mediapipe-Modells` und zeigt den Hinweis „Freistellung nicht möglich. Originalfoto wird angezeigt.“ an.
- Tritt während der Segmentierung ein Fehler auf, wird `Freistellung mit Mediapipe fehlgeschlagen` im Log ausgegeben. Die UI fällt auf das Originalbild zurück und blendet dieselbe Fehlermeldung ein.
- Nutzer:innen können die Freistellung jederzeit erneut anstoßen; das Modell bleibt dabei im Cache und muss nicht erneut geladen werden.

Mit diesem Ansatz bleibt die Hintergrundentfernung komplett clientseitig, performant und wartungsarm.
