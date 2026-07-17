import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pdfProxyRouter from "./pdfProxy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pdfProxyRouter);

export default router;
