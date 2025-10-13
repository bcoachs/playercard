# Hintergrundfreistellung mit MediaPipe Selfie Segmentation

Die Playercard-App nutzt jetzt [MediaPipe Selfie Segmentation](https://developers.google.com/mediapipe/solutions/vision/selfie_segmentation), um den Hintergrund von Spielerporträts direkt im Browser zu entfernen. Die bisherigen IMG.LY-Modelle und das lokale Asset-Mirroring wurden vollständig entfernt.

## Architektur

- **Laufzeit nur im Browser:** Die Segmentierung wird erst nach dem Mounten der Client-Komponente geladen. Während der Initialisierung blendet die UI einen Ladezustand ein.
- **MediaPipe-CDN als Standard:** Ohne weitere Konfiguration lädt die App das Modell (`selfie_segmenter.tflite`) und die zugehörigen Assets von `cdn.jsdelivr.net`. Optional kann über eine Environment-Variable ein eigener Hosting-Pfad hinterlegt werden.
- **Einmalige Initialisierung:** Das MediaPipe-Modul wird gecacht. Nach erfolgreicher Initialisierung werden alle weiteren Bilder über dieselbe Instanz segmentiert.
- **Pixelgenaue Freistellung:** Die von MediaPipe erzeugte Maske wird auf den RGBA-Kanal des Originalbilds angewendet. Der Vordergrund bleibt erhalten, der Hintergrund wird transparent.

## Konfiguration

| Variable | Zweck | Standardwert |
| --- | --- | --- |
| `NEXT_PUBLIC_MEDIAPIPE_ASSET_BASE` | Optionaler Basis-Pfad für die MediaPipe Assets (z. B. eigenes CDN). | `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/` |

> Wichtig: Der Pfad muss auf einen Ordner zeigen, der die originalen MediaPipe-Dateien (`selfie_segmentation_solution_packed_assets.data`, `selfie_segmentation_binary.graph` usw.) enthält. Die App hängt automatisch den Dateinamen an und sorgt für den abschließenden Slash.

## Ablauf bei der Bildverarbeitung

1. Nutzer lädt ein Bild oder ein bestehendes Spielerfoto wird automatisch abgeholt.
2. Die Datei wird in ein `HTMLImageElement` geladen; temporäre Object-URLs werden nach der Verarbeitung wieder freigegeben.
3. MediaPipe erzeugt eine Segmentierungsmaske.
4. Die Maske wird in ein Canvas übertragen, in einen Alpha-Kanal umgerechnet und mit dem Originalbild kombiniert.
5. Das Ergebnis wird als PNG-Blob exportiert und per Object-URL in der Oberfläche angezeigt.
6. Bei Fehlern zeigt die App das Originalbild an und informiert den Nutzer mit einer deutschsprachigen Fehlermeldung.

## Fehlerbehandlung & Fallbacks

- Schlägt die Initialisierung des MediaPipe-Moduls fehl, wird dies in der UI angezeigt und das Originalfoto bleibt sichtbar.
- Kann die Segmentierung eines Bildes nicht durchgeführt werden, wird automatisch auf das Ausgangsbild zurückgefallen.
- Jede Fehlermeldung nutzt denselben deutschen Wortlaut ("Hintergrundfreistellung …"), damit Nutzer:innen konsistente Rückmeldungen erhalten.

## Entfernte Altlasten

- NPM-Abhängigkeiten `@imgly/background-removal` und `@imgly/background-removal-data`
- OnnxRuntime-basiertes Webpack-Tuning und das `public/imgly-assets` Mirror-Verzeichnis
- Eigene TypeScript-Deklarationen für die IMG.LY-API

Mit diesem Umbau ist kein zusätzliches Asset-Hosting mehr nötig und die Hintergrundfreistellung funktioniert komplett clientseitig mit einem leichtgewichtigen Modell von Google.
