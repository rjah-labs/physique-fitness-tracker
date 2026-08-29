import type { NextConfig } from "next";

const githubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  ...(githubPages
    ? {
        assetPrefix: "/physique-fitness-tracker",
      }
    : {}),
};

export default nextConfig;
