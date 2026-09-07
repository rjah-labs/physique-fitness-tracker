import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Physique application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Physique — Fitness Tracker<\/title>/i);
  assert.match(html, /Loading Physique…/);
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships v0.14b.2 advanced immutable daily supplement doses", async () => {
  const [page, workouts, repository, generator, profile, ownerAnalytics, migration, supplementMigration, weekdayMigration, advancedMigration, supplements, dispatch, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/workouts.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/workout-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/program-generator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/program-profile.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/owner-analytics.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260901090000_add_owner_analytics.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260907100000_improve_supplement_reminders.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260907120000_add_supplement_weekdays.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260907143000_add_advanced_supplement_doses.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/supplements.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/notification-dispatch/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /V0\.14B\.2/);
  assert.match(page, /Measurements, weight and progress photos are optional/);
  assert.match(page, /Start training/);
  assert.match(page, /No baseline required/);
  assert.doesNotMatch(page, /checkIns\.length===0\?<Onboarding/);
  assert.match(workouts, /ProgressionGuide/);
  assert.match(workouts, /Use \{guide\.suggestedWeight\} kg/);
  assert.match(workouts, /ExerciseProgress/);
  assert.match(workouts, /Completed sessions/);
  assert.match(workouts, /Estimated strength/);
  assert.match(repository, /progressionSuggestion/);
  assert.match(repository, /workout_sets\(set_number,weight_kg,reps,completed\)/);
  assert.match(repository, /active_workout_drafts/);
  assert.match(repository, /saveDraft/);
  assert.match(workouts, /Autosaved securely/);
  assert.match(workouts, /RestTimer/);
  assert.match(workouts, /REST COMPLETE/);
  assert.match(workouts, /visibilitychange/);
  assert.match(generator, /ProgramReview/);
  assert.match(generator, /PROGRAM REVIEW · V0\.13C/);
  assert.match(generator, /Your active program remains unchanged until you explicitly activate the revision/);
  assert.match(profile, /COACHING BRIEF · V0\.14A/);
  assert.match(profile, /Preparation only—AI remains off/);
  assert.match(profile, /It will not receive progress photos/);
  assert.match(page, /record_app_launch/);
  assert.match(page, /OwnerAnalytics/);
  assert.match(ownerAnalytics, /OWNER ANALYTICS · PRIVATE/);
  assert.match(ownerAnalytics, /get_owner_analytics/);
  assert.match(ownerAnalytics, /Installed-mode users/);
  assert.match(migration, /alter table public\.app_user_activity enable row level security/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /revoke execute on function public\.get_owner_analytics\(\) from public, anon/i);
  assert.match(page, /NOTIFICATIONS · OPT IN/);
  assert.match(page, /notifications_enabled:false/);
  assert.match(supplements, /Follow-up if still unrecorded/);
  assert.match(supplements, /taken as scheduled/);
  assert.match(supplements, /reminder_enabled/);
  assert.match(supplementMigration, /follow_up_minutes/);
  assert.match(supplements, /Days taken/);
  assert.match(supplements, /scheduled_weekdays/);
  assert.match(weekdayMigration, /Sunday=0 through Saturday=6/);
  assert.match(dispatch, /scheduled_weekdays\.includes\(localWeekday\)/);
  assert.match(page, /Advanced supplement tracking/);
  assert.match(page, /advanced_supplement_tracking: false/);
  assert.match(supplements, /Concentration/);
  assert.match(supplements, /Record actual dose/);
  assert.match(supplements, /preset_dose_value/);
  assert.match(advancedMigration, /Immutable snapshot/);
  assert.match(dispatch, /preset \$\{item\.dose_value\}/);
  assert.match(repository, /suggested increase is optional/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});
