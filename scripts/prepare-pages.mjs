import { readFile, writeFile } from "node:fs/promises";

for (const file of ["dist/client/index.html", "dist/client/404.html", "dist/client/index.rsc"]) {
  const source = await readFile(file, "utf8");
  const portable = source
    .replaceAll('"/_next/', '"./_next/')
    .replaceAll("'/_next/", "'./_next/")
    .replaceAll('"/favicon.svg', '"./favicon.svg');
  await writeFile(file, portable);
}

await writeFile("dist/client/.nojekyll", "");
