import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;
const isBuild = process.env.NODE_ENV === 'production' || process.argv.includes('build');

if (!rawPort && !isBuild) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort ?? 3000);

if (rawPort && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Default to root — this app is deployed standalone on Vercel (see
// vercel.json), not behind Replit's artifact path-prefix proxy, where
// BASE_PATH would otherwise be injected by the dev workflow.
const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: 'autoUpdate',
      // Disabled in dev: a dev-mode service worker was caching old JS
      // bundles on real devices, so testers kept seeing stale/broken
      // screens even after fixes shipped. The manifest/icons/meta tags
      // (what site-to-APK/TWA wrappers actually read) are unaffected —
      // only the SW's offline-caching behavior is off during development.
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'IIC — NSTA',
        short_name: 'IIC',
        description: 'IIC Study App — The Future of Learning',
        // These are what website-to-APK / TWA wrapper tools read to theme the
        // native status bar, splash screen, and system navigation bar. Keep
        // them in sync with the app's actual header/nav colors below.
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen'],
        orientation: 'portrait',
        start_url: basePath,
        scope: basePath,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globIgnores: ['**/*.map'],
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Prevent Rollup from reordering module declarations in a way that
        // can cause TDZ (Temporal Dead Zone) errors in production bundles.
        hoistTransitiveImports: false,
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      // Route /api/* requests to the API server (port 8080)
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
