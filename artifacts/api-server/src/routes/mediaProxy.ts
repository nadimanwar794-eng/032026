import { Router, Request, Response } from "express";
import http from "http";
import https from "https";
import { URL } from "url";

const router = Router();

// Handle preflight OPTIONS for media streaming
router.options("/media-proxy", (_req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.status(204).end();
});

/**
 * Resolves Google Drive URLs to direct download stream URLs
 */
function resolveGoogleDriveUrl(rawUrl: string): string {
  if (rawUrl.includes("drive.google.com") || rawUrl.includes("drive.usercontent.google.com")) {
    const fileIdMatch =
      rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.usercontent.google.com/download?id=${fileIdMatch[1]}&export=download&confirm=t`;
    }
  }
  return rawUrl;
}

/**
 * Streams media from targetUrl to response, following redirects safely
 */
function streamRemoteMedia(
  targetUrl: string,
  clientReq: Request,
  clientRes: Response,
  redirectCount = 0
) {
  if (redirectCount > 6) {
    clientRes.status(502).json({ error: "Too many redirects from media source" });
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    clientRes.status(400).json({ error: "Invalid media URL provided" });
    return;
  }

  const isHttps = parsedUrl.protocol === "https:";
  const client = isHttps ? https : http;

  const requestHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "*/*",
  };

  if (clientReq.headers.range) {
    requestHeaders["Range"] = clientReq.headers.range;
  }

  const req = client.get(
    parsedUrl.toString(),
    {
      headers: requestHeaders,
      timeout: 30000,
    },
    (upstreamRes) => {
      // Handle HTTP redirects (301, 302, 303, 307, 308)
      if (
        upstreamRes.statusCode &&
        [301, 302, 303, 307, 308].includes(upstreamRes.statusCode) &&
        upstreamRes.headers.location
      ) {
        let redirectUrl = upstreamRes.headers.location;
        if (!redirectUrl.startsWith("http")) {
          redirectUrl = new URL(redirectUrl, parsedUrl.origin).toString();
        }
        upstreamRes.resume(); // discard body
        return streamRemoteMedia(redirectUrl, clientReq, clientRes, redirectCount + 1);
      }

      // Check for Google Drive HTML confirmation warning page
      const contentType = upstreamRes.headers["content-type"] || "";
      if (
        parsedUrl.hostname.includes("drive.google.com") &&
        contentType.includes("text/html")
      ) {
        // Collect HTML to extract download confirmation token
        let body = "";
        upstreamRes.setEncoding("utf8");
        upstreamRes.on("data", (chunk) => (body += chunk));
        upstreamRes.on("end", () => {
          const confirmMatch =
            body.match(/confirm=([a-zA-Z0-9_-]+)/) ||
            body.match(/name="confirm"\s+value="([a-zA-Z0-9_-]+)"/);
          const idMatch =
            parsedUrl.searchParams.get("id") ||
            (body.match(/id=([a-zA-Z0-9_-]+)/) ? body.match(/id=([a-zA-Z0-9_-]+)/)![1] : null);

          if (confirmMatch && idMatch) {
            const confirmedUrl = `https://drive.usercontent.google.com/download?id=${idMatch}&export=download&confirm=${confirmMatch[1]}`;
            return streamRemoteMedia(confirmedUrl, clientReq, clientRes, redirectCount + 1);
          }

          // If no confirmation token found, send error
          clientRes.status(upstreamRes.statusCode || 500).send(body);
        });
        return;
      }

      // Relay status and headers to client
      clientRes.status(upstreamRes.statusCode || 200);
      clientRes.setHeader("Access-Control-Allow-Origin", "*");
      clientRes.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      clientRes.setHeader("Access-Control-Allow-Headers", "*");
      clientRes.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type, Accept-Ranges");

      if (upstreamRes.headers["content-type"]) {
        clientRes.setHeader("Content-Type", upstreamRes.headers["content-type"]);
      }
      if (upstreamRes.headers["content-length"]) {
        clientRes.setHeader("Content-Length", upstreamRes.headers["content-length"]);
      }
      if (upstreamRes.headers["content-range"]) {
        clientRes.setHeader("Content-Range", upstreamRes.headers["content-range"]);
      }
      if (upstreamRes.headers["accept-ranges"]) {
        clientRes.setHeader("Accept-Ranges", upstreamRes.headers["accept-ranges"]);
      }

      upstreamRes.pipe(clientRes);
    }
  );

  req.on("timeout", () => {
    req.destroy();
    if (!clientRes.headersSent) {
      clientRes.status(504).json({ error: "Media download gateway timed out" });
    }
  });

  req.on("error", (err) => {
    if (!clientRes.headersSent) {
      clientRes.status(502).json({ error: `Media download error: ${err.message}` });
    }
  });

  clientReq.on("close", () => {
    req.destroy();
  });
}

// GET /api/media-proxy?url=...
router.get("/media-proxy", (req: Request, res: Response) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== "string") {
    res.status(400).json({ error: "Query parameter 'url' is required" });
    return;
  }

  const resolvedUrl = resolveGoogleDriveUrl(targetUrl);
  streamRemoteMedia(resolvedUrl, req, res);
});

export default router;
