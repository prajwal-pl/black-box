import { Router } from "express";
import { authenticateToken } from "../middleware/middleware.auth";
import { getContradictions, updateContradictionStatus, triggerContradictionScan } from "../controllers/contradiction.controller";

const router = Router();

router.get("/cases/:caseId/contradictions", authenticateToken, getContradictions);
router.patch("/contradictions/:id", authenticateToken, updateContradictionStatus);
router.post("/cases/:caseId/contradictions/scan", authenticateToken, triggerContradictionScan);

export default router;
