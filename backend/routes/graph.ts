import { Router } from "express";
import { authenticateToken } from "../middleware/middleware.auth";
import { getGraph } from "../controllers/graph.controller";

const router = Router();

router.get("/cases/:caseId/graph", authenticateToken, getGraph);

export default router;
