import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.join(process.cwd(), "../.."), "");
  const webPort = Number(env.WEB_PORT ?? 5290);
  const apiPort = Number(env.API_PORT ?? 4310);
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
    server: {
      port: webPort,
      strictPort: true,
      proxy: {
        "/api": { target: `http://localhost:${apiPort}`, changeOrigin: true },
      },
    },
  };
});
