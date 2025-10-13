# Hintergrundfreistellung mit BodyPix

Die Playercard-App setzt auf [BodyPix](https://github.com/tensorflow/tfjs-models/tree/master/body-pix) in Kombination mit TensorFlow.js,
um Spielerporträts direkt im Browser freizustellen. Damit bleibt der Prozess vollständig clientseitig und unabhängig von externen CDN-Rewrites.

## Architekturüberblick

- **Hilfsmodul**: `src/lib/bodyPixSegmentation.ts` kapselt das Laden des BodyPix-Modells und die Maskenverarbeitung.
- **Lazy Loading**: `loadBodyPix()` wird beim Mount der Playercard-Komponente ausgeführt und cacht die Instanz für weitere Aufrufe.
- **Bildaufbereitung**: `removeBackground()` erzeugt aus den BodyPix-Segmentierungsdaten ein PNG mit transparentem Hintergrund. Optional kann ein Farbverlauf, eine Farbe oder ein Hintergrundbild eingeblendet werden.
- **Client-only**: Die gesamte Verarbeitung findet im Browser statt. Auf dem Server werden keine Modelle initialisiert.

## Ablauf bei der Bildverarbeitung

1. Nutzer:innen laden ein Bild hoch oder das vorhandene Spielerfoto wird von der App abgeholt.
2. Beim ersten Aufruf lädt die App das BodyPix-Modell (`MobileNetV1`) sowie die TensorFlow.js-Laufzeit.
3. `removeBackground()` erstellt ein `ImageBitmap`, segmentiert das Motiv und kombiniert Maske, optionalen Hintergrund und Originalbild auf einem Canvas.
4. Das Ergebnis wird als PNG-Blob exportiert und über eine Object-URL in der Oberfläche angezeigt.
5. Nach der Verwendung werden temporäre Ressourcen (Object-URLs, ImageBitmaps) freigegeben.

## Konfiguration & Abhängigkeiten

- `@tensorflow-models/body-pix@^2.2.0` und `@tensorflow/tfjs@^4.15.0` sind die Laufzeitabhängigkeiten für die Segmentierung.
- Es sind keine Environment-Variablen oder Rewrites notwendig. Die Assets werden lokal vom Bundle geladen.

## Fehlerbehandlung

- Scheitert das Vorladen des Modells, protokolliert die App `Fehler beim Laden des BodyPix-Modells` und zeigt den Hinweis „Freistellung nicht möglich. Originalfoto wird angezeigt.“ an.
- Tritt während der Segmentierung ein Fehler auf, wird `Freistellung mit BodyPix fehlgeschlagen` im Log ausgegeben. Die UI fällt auf das Originalbild zurück und blendet dieselbe Fehlermeldung ein.
- Nutzer:innen können die Freistellung jederzeit erneut anstoßen; das Modell bleibt dabei im Cache und muss nicht erneut geladen werden.

Mit diesem Ansatz bleibt die Hintergrundentfernung komplett clientseitig, performant und wartungsarm.
