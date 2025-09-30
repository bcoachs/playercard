# Playercard Starter Overlay (App Router, TypeScript)

## Verwendung
1. Neues Next.js Projekt erstellen:
   ```bash
   npx create-next-app@latest playercard --ts --eslint
   cd playercard
   ```

2. Overlay in das Projekt kopieren (entpacken und Inhalte **überschreiben/ergänzen**).

3. Abhängigkeiten installieren:
   ```bash
   npm i @supabase/supabase-js @supabase/ssr react-hook-form zod qrcode
   ```

4. `.env.local` anlegen (siehe `.env.example`).

5. Lokal starten:
   ```bash
   npm run dev
   ```

6. In Vercel importieren. Environment Variables setzen und (optional) Password Protection aktivieren.

## Routen (MVP)
- `/` – Start
- `/projects/new` – Projekt anlegen (Name, Datum, Logo)
- `/join/[projectId]` – Self-Signup (Skeleton)
- `/capture` – Stations-Erfassung (Skeleton + QR-Param Handling)
- `/leaderboard` – Rangliste (Skeleton)
- API: `POST /api/projects` – legt Projekt + 6 Stationen an

> Hinweis: Policies/Tabellen müssen vorher in Supabase angelegt werden.
