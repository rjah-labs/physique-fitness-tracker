# Physique v0.2

A mobile-first fitness tracking PWA for body measurements, workouts and structured goals. Goals can track bodyweight, body size, strength, exercise performance or weekly training consistency, with editable targets, primary focus and trade-off guidance. Private user data is synced through Supabase.

v0.2 adds complete 14-field check-ins, editable history, progress charts, date-to-date comparisons, notes, safe deletion and a progress-photo interface prepared for private Supabase Storage.

## Run locally

1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the local address shown in the terminal.

## Install on iPhone

Open the deployed site in Safari, tap **Share**, choose **Add to Home Screen**, then open **Physique** from its new icon. The service worker caches the app shell after the first visit.

## Deploy to GitHub Pages

Create a GitHub repository, push this folder to its `main` branch, then open **Settings → Pages** and choose **GitHub Actions** as the source. The included workflow publishes every push to `main`.

The Pages build converts asset links to relative paths, so it works both at a `username.github.io` root and inside a normal repository path.

## Data and future Supabase integration

v0.1 uses browser local storage and needs no account or credentials. Screens use the `FitnessRepository` interface in `lib/fitness-repository.ts`. A future Supabase adapter can implement the same interface without changing the screens.

Suggested tables are in `docs/supabase-plan.md`. Never expose a service-role key in the client; use Supabase Row Level Security.

## Workout cards and calendar (v0.17.1)

- Train → Workouts stores reusable cards; Start copies a card into a separate active session.
- Train → Calendar assigns a workout or rest day to a date. Choose weekly or fortnightly repeats and enter 1–104 weeks or fortnights, including the selected date. Repeats fill empty dates only, preserving existing plans. Missed sessions stay on their original dates and can be skipped or moved.
- Today recommends only today's planned session. Choosing another card can replace today's plan or start an extra session.
- Approved programs import once into account-owned cards and approximately 12 weeks of dated plans. Existing dates and completed history are preserved.
- Finish uses an authenticated, security-invoker database transaction and a stable client session ID. Retries return the original result. Completed workouts cannot be advanced by duplicate history counts.

Apply `supabase/migrations/20260924125011_workout_cards_calendar_atomic_sessions.sql` before deploying this frontend to another environment. It is already applied to the production project. The migration uses account ownership policies and composite owner/card references.

Verification: `node --test tests/program-calendar.test.mjs tests/rendered-html.test.mjs` after building. `supabase/tests/workout_calendar_smoke.sql` runs inside a rollback transaction with an authenticated test account. `tests/planner-browser.test.mjs` exercises the mobile interface using isolated fixtures; it requires Playwright (set `CODEX_PRIMARY_RUNTIME_NODE_MODULES` to its modules directory) and a Chromium install, or a `CHROMIUM_MODULE` exporting executablePath/args.

The recurrence controls also require `supabase/migrations/20260924130945_workout_weekly_fortnightly_recurrence.sql` (applied in production). The original weekly RPC remains available for older installed clients.
