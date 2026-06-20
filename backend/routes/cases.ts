import express from 'express';
import { createCase, deleteCase, getCaseById, getCases, updateCase } from '../controllers/cases.controller';

const router = express.Router();

router.get("/", getCases)
router.post("/", createCase)
router.get("/:id", getCaseById)
router.put("/:id", updateCase)
router.delete("/:id", deleteCase)

export default router;