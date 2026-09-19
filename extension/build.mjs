import { build } from "esbuild";
await build({
  entryPoints: ["src/background.ts", "src/content.ts", "src/offscreen.ts"],
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome116",
  minify: false,
});
