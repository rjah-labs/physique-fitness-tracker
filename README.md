# Physique v0.2

A mobile-first fitness tracking PWA for body measurements, workouts and structured goals. Goals can track bodyweight, body size, strength, exercise performance or weekly training consistency. Private user data is synced through Supabase.

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
