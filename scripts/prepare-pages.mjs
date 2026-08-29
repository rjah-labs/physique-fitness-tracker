import { readFile, rename, rm, writeFile } from "node:fs/promises";

const pagesBase = "/physique-fitness-tracker";

for (const file of ["dist/client/index.html", "dist/client/404.html", "dist/client/index.rsc"]) {
  const source = await readFile(file, "utf8");
  const hasExpectedAssetPath = source.includes(`${pagesBase}/_next/`);
  const hasRootAssetPath = ['"/_next/', "'/_next/", '\\"/_next/'].some((pattern) =>
    source.includes(pattern),
  );
  if (!hasExpectedAssetPath || hasRootAssetPath) {
    throw new Error(`GitHub Pages base path is missing from ${file}`);
  }

  await writeFile(file, source);
}

await rm("dist/client/_next", { recursive: true, force: true });
await rename(`dist/client${pagesBase}/_next`, "dist/client/_next");
await rm(`dist/client${pagesBase}`, { recursive: true, force: true });
await writeFile("dist/client/.nojekyll", "");
