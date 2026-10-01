import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: Number(env.VITE_WEB_PORT || "5173"),
      strictPort: true,
      watch: {
        ignored: ["**/.acceptance-*/**", "**/.npm-cache/**"],
      },
      proxy: {
        "/api": {
          target: env.VITE_API_TARGET || "http://127.0.0.1:8000",
          changeOrigin: false,
        },
      },
    },
  };
});
