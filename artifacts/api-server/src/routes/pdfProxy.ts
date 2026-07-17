import { Router } from 'express';

const router = Router();

/**
 * GET /api/pdf-proxy?url=<encoded_url>
 * Fetches any PDF and streams it back.
 * Handles Google Drive's virus-scan redirect by following confirmation cookies.
 */
router.get('/pdf-proxy', async (req, res) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) {
    res.status(400).json({ error: 'url query param required' });
    return;
  }

  let fetchUrl = rawUrl;
  let isGoogleDrive = false;
  let fileId: string | null = null;

  // Detect and convert Google Drive links
  if (fetchUrl.includes('drive.google.com') || fetchUrl.includes('drive.usercontent.google.com')) {
    isGoogleDrive = true;
    const m = fetchUrl.match(/\/file\/d\/([^/?#]+)/) || fetchUrl.match(/[?&]id=([^&]+)/);
    if (m) fileId = m[1];
  }

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/pdf,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    let pdfBuffer: Buffer | null = null;

    if (isGoogleDrive && fileId) {
      // Strategy 1: drive.usercontent.google.com (newer, works for public files)
      const urls = [
        `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`,
        `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
        `https://drive.google.com/uc?export=download&id=${fileId}`,
      ];

      for (const url of urls) {
        try {
          const r1 = await fetch(url, { headers, redirect: 'follow' });
          if (!r1.ok) continue;

          const ct = r1.headers.get('content-type') || '';
          if (ct.includes('html')) {
            // Got HTML (virus scan page) — try to extract confirm token
            const html = await r1.text();
            const confirmMatch = html.match(/confirm=([0-9A-Za-z_-]+)/);
            if (confirmMatch) {
              const cookieHeader = r1.headers.get('set-cookie') || '';
              const r2 = await fetch(
                `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch[1]}`,
                { headers: { ...headers, Cookie: cookieHeader }, redirect: 'follow' },
              );
              if (r2.ok && !((r2.headers.get('content-type') || '').includes('html'))) {
                pdfBuffer = Buffer.from(await r2.arrayBuffer());
                break;
              }
            }
            continue; // try next URL
          }

          pdfBuffer = Buffer.from(await r1.arrayBuffer());
          break;
        } catch { continue; }
      }
    } else {
      // Non-Drive URL — fetch directly
      const r = await fetch(fetchUrl, { headers, redirect: 'follow' });
      if (r.ok) pdfBuffer = Buffer.from(await r.arrayBuffer());
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      res.status(502).json({ error: 'Could not fetch PDF from upstream' });
      return;
    }

    // Sanity check: PDF starts with %PDF
    const magic = pdfBuffer.slice(0, 4).toString('ascii');
    if (!magic.startsWith('%PDF')) {
      res.status(502).json({ error: 'Upstream did not return a valid PDF' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);

  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'proxy fetch failed' });
  }
});

export default router;
