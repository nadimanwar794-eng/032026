import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const isReplit =
  process.env.REPL_ID !== undefined ||
  process.env.REPLIT_DEV_DOMAIN !== undefined;

export default defineConfig(async () => {
  const replitPlugins = isReplit
    ? await Promise.all([
        import("@replit/vite-plugin-runtime-error-modal").then((m) =>
          m.default()
        ),
        import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer()
        ),
        import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
      ]).catch(() => [])
    : [];

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const base = process.env.BASE_PATH ?? "/";

  return {
    base,
    plugins: [react(), tailwindcss(), ...replitPlugins],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: false,
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
