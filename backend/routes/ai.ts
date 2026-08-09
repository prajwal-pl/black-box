import { Router } from "express";
import { authenticateToken } from "../middleware/middleware.auth";
import { chatHandler } from "../controllers/ai.controller";

const router = Router();

// Without caseId — answers from LLM general knowledge (no RAG)
router.post("/chat", authenticateToken, chatHandler);

// With caseId — RAG-grounded responses from Qdrant vector store
router.post("/chat/:caseId", authenticateToken, chatHandler);

export default router;
