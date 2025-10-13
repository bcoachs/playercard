const fs = require('fs');
const path = require('path');

// Quelle: Modelldatei im Mediapipe-Paket
const rootDir = path.join(__dirname, '..')
const candidateSources = [
  path.join(rootDir, 'node_modules', '@mediapipe', 'selfie_segmentation', 'selfie_segmentation_landscape.tflite'),
  path.join(rootDir, 'app', 'node_modules', '@mediapipe', 'selfie_segmentation', 'selfie_segmentation_landscape.tflite'),
]
const src = candidateSources.find(fs.existsSync)
if (!src) {
  throw new Error('Konnte Mediapipe-Modell nicht finden. Bitte zuerst Abhängigkeiten installieren.')
}
// Ziel: public/models
const destDir = path.join(__dirname, '..', 'public', 'models');
const dest = path.join(destDir, 'selfie_segmentation_landscape.tflite');

// Zielordner erstellen
fs.mkdirSync(destDir, { recursive: true });
// Datei kopieren
fs.copyFileSync(src, dest);
console.log(`Copied ${src} → ${dest}`);
