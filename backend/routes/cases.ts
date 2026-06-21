import express from 'express';
import { createCase, deleteCase, getCaseById, getCases, updateCase } from '../controllers/cases.controller';
import { authenticateToken } from '../middleware/middleware.auth';

const router = express.Router();

router.get("/", authenticateToken, getCases)
router.post("/", authenticateToken, createCase)
router.get("/:id", authenticateToken, getCaseById)
router.put("/:id", authenticateToken, updateCase)
router.delete("/:id", authenticateToken, deleteCase)

export default router;