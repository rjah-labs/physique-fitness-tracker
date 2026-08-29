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

test("ships the v0.12b progression feature without starter remnants", async () => {
  const [page, workouts, repository, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/workouts.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/workout-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /V0\.12B/);
  assert.match(workouts, /ProgressionGuide/);
  assert.match(workouts, /Use \{guide\.suggestedWeight\} kg/);
  assert.match(repository, /progressionSuggestion/);
  assert.match(repository, /suggested increase is optional/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});
