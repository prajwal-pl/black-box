import { Router } from "express";
import { authenticateToken } from "../middleware/middleware.auth";
import { getTimeline } from "../controllers/timeline.controller";

const router = Router();

router.get("/cases/:caseId/timeline", authenticateToken, getTimeline);

export default router;
