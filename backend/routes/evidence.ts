import express from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/middleware.auth";
import {
    uploadEvidence,
    getEvidenceByCase,
    getEvidenceStatus,
    deleteEvidence,
} from "../controllers/evidence.controller";

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100 MB
    },
});

router.post("/cases/:caseId/evidence", authenticateToken, upload.single("file"), uploadEvidence);
router.get("/cases/:caseId/evidence", authenticateToken, getEvidenceByCase);
router.get("/evidence/:id/status", authenticateToken, getEvidenceStatus);
router.delete("/evidence/:id", authenticateToken, deleteEvidence);

export default router;