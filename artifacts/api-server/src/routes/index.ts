import { Router } from "express";
import healthRouter from "./health.js";
import notificationsRouter from "./notifications.js";
import mediaProxyRouter from "./mediaProxy.js";
import telegramRouter from "./telegram.js";

const router = Router();

router.use(healthRouter);
router.use(notificationsRouter);
router.use(mediaProxyRouter);
router.use(telegramRouter);

export default router;
