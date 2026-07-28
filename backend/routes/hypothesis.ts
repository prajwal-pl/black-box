import { Router } from "express";
import { authenticateToken } from "../middleware/middleware.auth";
import { getHypotheses, updateHypothesisStatus, triggerHypothesisUpdate } from "../controllers/hypothesis.controller";

const router = Router();

router.get("/cases/:caseId/hypotheses", authenticateToken, getHypotheses);
router.patch("/hypotheses/:id", authenticateToken, updateHypothesisStatus);
router.post("/cases/:caseId/hypotheses/trigger", authenticateToken, triggerHypothesisUpdate);

export default router;
