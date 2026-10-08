import { Router, Request, Response } from "express";
import http from "http";
import https from "https";
import { URL } from "url";

const router = Router();

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_STORAGE_BOT_TOKEN || "8938213127:AAEjjjXmxjOuqpo5PP2TgorWOa17uYeD-Dw";
const DEFAULT_STORAGE_CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_STORAGE_CHAT_ID || "7849468653";
const DEFAULT_CHAT_BOT_TOKEN = process.env.TELEGRAM_CHAT_BOT_TOKEN || "8932524192:AAGVxYSuKPZX6sOQFkXz0U7ESVQ2NcHmJZw";
const DEFAULT_CHAT_CHANNEL_ID = process.env.TELEGRAM_CHAT_CHANNEL_ID || "-1004290996442";

// Handle preflight OPTIONS for telegram routes
router.options(["/telegram/file", "/telegram/upload", "/telegram/sendMessage", "/telegram/health"], (_req: Request, res: Response): void => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.status(204).end();
});

// GET /api/telegram/health
router.get("/telegram/health", async (_req: Request, res: Response): Promise<void> => {
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${DEFAULT_BOT_TOKEN}/getMe`);
    const data: any = await tgRes.json();
    if (data && data.ok) {
      res.json({
        ok: true,
        bot: {
          username: data.result?.username,
          first_name: data.result?.first_name,
        },
        storageChatId: DEFAULT_STORAGE_CHAT_ID,
      });
      return;
    }
    res.status(502).json({ ok: false, error: data?.description || "Telegram bot response not OK" });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err?.message || "Failed to reach Telegram API" });
  }
});

// GET /api/telegram/file?path=...
router.get("/telegram/file", (req: Request, res: Response): void => {
  const filePath = (req.query.path as string) || "";
  if (!filePath) {
    res.status(400).json({ error: "Missing 'path' query parameter" });
    return;
  }

  const tgUrl = `https://api.telegram.org/file/bot${DEFAULT_BOT_TOKEN}/${filePath}`;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(tgUrl);
  } catch {
    res.status(400).json({ error: "Invalid target URL" });
    return;
  }

  const requestHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36",
    Accept: "*/*",
  };

  if (req.headers.range) {
    requestHeaders["Range"] = req.headers.range as string;
  }

  const clientReq = https.get(parsedUrl.toString(), { headers: requestHeaders, timeout: 60000 }, (remoteRes) => {
    // Handle redirects
    if (remoteRes.statusCode && [301, 302, 303, 307, 308].includes(remoteRes.statusCode) && remoteRes.headers.location) {
      remoteRes.resume();
      res.redirect(remoteRes.headers.location);
      return;
    }

    res.status(remoteRes.statusCode || 200);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type, Accept-Ranges");
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");

    if (remoteRes.headers["content-type"]) res.setHeader("Content-Type", remoteRes.headers["content-type"]);
    if (remoteRes.headers["content-length"]) res.setHeader("Content-Length", remoteRes.headers["content-length"]);
    if (remoteRes.headers["content-range"]) res.setHeader("Content-Range", remoteRes.headers["content-range"]);
    if (remoteRes.headers["accept-ranges"]) res.setHeader("Accept-Ranges", remoteRes.headers["accept-ranges"]);

    remoteRes.pipe(res);
  });

  clientReq.on("timeout", () => {
    clientReq.destroy();
    if (!res.headersSent) res.status(504).json({ error: "Telegram file stream timed out" });
  });

  clientReq.on("error", (err) => {
    if (!res.headersSent) res.status(502).json({ error: `Telegram file error: ${err.message}` });
  });

  req.on("close", () => {
    clientReq.destroy();
  });
});

// POST /api/telegram/sendMessage
router.post("/telegram/sendMessage", async (req: Request, res: Response): Promise<void> => {
  const { message, text, chatId } = req.body || {};
  const content = message || text;
  if (!content) {
    res.status(400).json({ error: "Missing 'message' in request body" });
    return;
  }

  const targetChat = chatId || DEFAULT_CHAT_CHANNEL_ID;
  const botToken = DEFAULT_CHAT_BOT_TOKEN;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChat,
        text: content,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });
    const data = await tgRes.json();
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "Failed to post message to Telegram" });
  }
});

export default router;
