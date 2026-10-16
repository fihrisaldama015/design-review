import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  plugins: [pluginReact({ swcReactOptions: { runtime: "automatic" } })],
  source: { entry: { index: "./src/index.js" } },
  resolve: {
    alias: {
      components: "./src/components",
      pages: "./src/pages",
      utils: "./src/utils",
      app: "./src/app",
    },
  },
  html: { title: "Design review" },
  output: { distPath: { root: "build" } },
  server: {
    port: 5010,
    proxy: { "/api/v1": { target: "http://localhost:9300", changeOrigin: true } },
  },
});
