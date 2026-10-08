import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import http from 'http';
import https from 'https';
import { URL } from 'url';

const port = Number(process.env.PORT) || 3000;
const basePath = process.env.BASE_PATH || '/';

function mediaProxyPlugin() {
  const DEFAULT_TG_BOT_TOKEN = '8938213127:AAEjjjXmxjOuqpo5PP2TgorWOa17uYeD-Dw';

  return {
    name: 'media-proxy-plugin',
    configureServer(server: any) {
      const handleStream = (targetUrl: string, req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (!targetUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: "Missing 'url' or 'path' param" }));
          return;
        }

        const streamRemote = (streamUrl: string, redirectHops = 0, cookieJar: string[] = []) => {
          if (redirectHops > 8) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: 'Too many redirects' }));
            return;
          }

          let resolvedStreamUrl = streamUrl;
          if (resolvedStreamUrl.startsWith('/')) {
            resolvedStreamUrl = `http://127.0.0.1:${port}${resolvedStreamUrl}`;
          }

          let parsedTarget: URL;
          try {
            parsedTarget = new URL(resolvedStreamUrl);
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid URL: ' + streamUrl }));
            return;
          }

          const client = parsedTarget.protocol === 'https:' ? https : http;
          const headers: Record<string, string> = {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: '*/*',
            'Accept-Encoding': 'identity',
          };

          if (cookieJar.length > 0) {
            headers['Cookie'] = cookieJar.join('; ');
          }

          if (req.headers.range) {
            headers['Range'] = req.headers.range;
          }

          const clientReq = client.get(parsedTarget.toString(), { headers, timeout: 600000 }, (remoteRes) => {
            // Collect cookies across redirect hops
            const setCookies = remoteRes.headers['set-cookie'];
            let newCookies = [...cookieJar];
            if (setCookies) {
              const parsedCookies = setCookies.map((c: string) => c.split(';')[0].trim());
              newCookies = Array.from(new Set([...newCookies, ...parsedCookies]));
            }

            // Handle HTTP redirects (301, 302, 303, 307, 308)
            if (
              remoteRes.statusCode &&
              [301, 302, 303, 307, 308].includes(remoteRes.statusCode) &&
              remoteRes.headers.location
            ) {
              let loc = remoteRes.headers.location;
              if (!loc.startsWith('http')) {
                loc = new URL(loc, parsedTarget.origin).toString();
              }
              remoteRes.resume();
              return streamRemote(loc, redirectHops + 1, newCookies);
            }

            // Check if Google Drive returned an HTML warning/confirm page
            const contentType = remoteRes.headers['content-type'] || '';
            if (
              parsedTarget.hostname.includes('drive.google.com') &&
              contentType.includes('text/html')
            ) {
              let body = '';
              remoteRes.setEncoding('utf8');
              remoteRes.on('data', (chunk: string) => (body += chunk));
              remoteRes.on('end', () => {
                const confirmMatch =
                  body.match(/confirm=([a-zA-Z0-9_-]+)/) ||
                  body.match(/name="confirm"\s+value="([a-zA-Z0-9_-]+)"/);
                const idMatch =
                  parsedTarget.searchParams.get('id') ||
                  (body.match(/id=([a-zA-Z0-9_-]+)/) ? body.match(/id=([a-zA-Z0-9_-]+)/)![1] : null);

                if (confirmMatch && idMatch) {
                  const confirmedUrl = `https://drive.usercontent.google.com/download?id=${idMatch}&export=download&confirm=${confirmMatch[1]}`;
                  return streamRemote(confirmedUrl, redirectHops + 1, newCookies);
                }

                res.statusCode = remoteRes.statusCode || 200;
                res.setHeader('Content-Type', contentType);
                res.end(body);
              });
              return;
            }

            res.statusCode = remoteRes.statusCode || 200;
            if (remoteRes.headers['content-type']) res.setHeader('Content-Type', remoteRes.headers['content-type']);
            if (remoteRes.headers['content-length']) res.setHeader('Content-Length', remoteRes.headers['content-length']);
            if (remoteRes.headers['content-range']) res.setHeader('Content-Range', remoteRes.headers['content-range']);
            if (remoteRes.headers['accept-ranges']) res.setHeader('Accept-Ranges', remoteRes.headers['accept-ranges']);

            remoteRes.pipe(res);
          });

          clientReq.on('timeout', () => {
            clientReq.destroy();
            if (!res.headersSent) {
              res.statusCode = 504;
              res.end(JSON.stringify({ error: 'Media download timed out' }));
            }
          });

          clientReq.on('error', (err) => {
            if (!res.headersSent) {
              res.statusCode = 502;
              res.end(JSON.stringify({ error: err.message }));
            }
          });

          req.on('close', () => {
            clientReq.destroy();
          });
        };

        // Handle Google Drive direct url normalization
        let effectiveUrl = targetUrl;
        if (effectiveUrl.includes('drive.google.com') && !effectiveUrl.includes('confirm=')) {
          const match = effectiveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || effectiveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (match && match[1]) {
            effectiveUrl = `https://drive.google.com/uc?export=download&id=${match[1]}&confirm=t`;
          }
        }

        streamRemote(effectiveUrl);
      };

      // /api/media-proxy?url=...
      server.middlewares.use('/api/media-proxy', (req: any, res: any) => {
        const parsedReqUrl = new URL(req.url, 'http://localhost');
        const targetUrl = parsedReqUrl.searchParams.get('url');
        handleStream(targetUrl || '', req, res);
      });

      // /api/telegram/file?path=...
      server.middlewares.use('/api/telegram/file', (req: any, res: any) => {
        const parsedReqUrl = new URL(req.url, 'http://localhost');
        const filePath = parsedReqUrl.searchParams.get('path');
        if (!filePath) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Missing 'path' query param" }));
          return;
        }
        const tgUrl = `https://api.telegram.org/file/bot${DEFAULT_TG_BOT_TOKEN}/${filePath}`;
        handleStream(tgUrl, req, res);
      });

      // /api/telegram/health
      server.middlewares.use('/api/telegram/health', async (_req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        try {
          const tgRes = await fetch(`https://api.telegram.org/bot${DEFAULT_TG_BOT_TOKEN}/getMe`);
          const data: any = await tgRes.json();
          if (data && data.ok) {
            res.end(JSON.stringify({
              ok: true,
              bot: { username: data.result?.username, first_name: data.result?.first_name },
              storageChatId: '7849468653',
            }));
            return;
          }
          res.statusCode = 502;
          res.end(JSON.stringify({ ok: false, error: data?.description || 'Telegram bot response not OK' }));
        } catch (err: any) {
          res.statusCode = 502;
          res.end(JSON.stringify({ ok: false, error: err?.message || 'Failed to reach Telegram API' }));
        }
      });

      // /api/telegram/sendMessage
      server.middlewares.use('/api/telegram/sendMessage', async (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const content = parsed.message || parsed.text;
            if (!content) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Missing 'message' in request body" }));
              return;
            }
            const targetChat = parsed.chatId || '-1004290996442';
            const botToken = process.env.TELEGRAM_CHAT_BOT_TOKEN || '8932524192:AAGVxYSuKPZX6sOQFkXz0U7ESVQ2NcHmJZw';
            const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: targetChat,
                text: content,
                parse_mode: 'HTML',
                disable_web_page_preview: false,
              }),
            });
            const data = await tgRes.json();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          } catch (err: any) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: err?.message || 'Failed to post message to Telegram' }));
          }
        });
      });
    },
  };
}

function notificationApiPlugin() {
  return {
    name: 'notification-api-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/notifications/push', (_req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, method: 'rtdb_pipeline' }));
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    mediaProxyPlugin(),
    notificationApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      includeAssets: [
        'favicon.svg',
        'branding/nsta-logo.png',
        'icons/apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
      ],
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: 'NSTA',
        short_name: 'NSTA',
        description:
          'Comprehensive learning platform with syllabus, notes, audio studio, MCQs, and student progress tracking.',
        theme_color: '#030717',
        background_color: '#030717',
        display: 'standalone',
        orientation: 'portrait',
        start_url: basePath,
        scope: basePath,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
      },
      injectManifest: {
        globIgnores: ['**/*.map'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
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
    sourcemap: false,
    rollupOptions: {
      maxParallelFileOps: 1,
      cache: false,
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('katex')) return 'vendor-katex';
            if (id.includes('@radix-ui')) return 'vendor-radix';
            return 'vendor-libs';
          }
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.API_SERVER_URL || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
