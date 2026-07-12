import express from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/middleware.auth";
import { uploadEvidence } from "../controllers/evidence.controller";

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100 MB
    },
});

router.post("/cases/:caseId/evidence", authenticateToken, upload.single("file"), uploadEvidence);