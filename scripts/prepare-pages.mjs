import { readFile, writeFile } from "node:fs/promises";

const pagesBase = "/physique-fitness-tracker";

for (const file of ["dist/client/index.html", "dist/client/404.html", "dist/client/index.rsc"]) {
  const source = await readFile(file, "utf8");
  const portable = source
    .replaceAll("/_next/", `${pagesBase}/_next/`)
    .replaceAll('"/favicon.svg', `"${pagesBase}/favicon.svg`);

  const hasRootAssetPath = ['"/_next/', "'/_next/", '\\"/_next/'].some((pattern) =>
    portable.includes(pattern),
  );
  if (hasRootAssetPath) {
    throw new Error(`GitHub Pages asset paths were not prepared in ${file}`);
  }

  await writeFile(file, portable);
}

await writeFile("dist/client/.nojekyll", "");
