/// <reference types="multer" />
import type { RequestHandler } from "express";
import { v4 as uuid } from "uuid";
import { StorageService } from "../services/storage.service";
import db from "../lib/db";
import { EvidenceQueueService } from "../services/evidence.queue.service";

export const uploadEvidence: RequestHandler = async (req, res) => {
    try {
        const file = req.file;
        const { caseId } = req.params as { caseId: string };
        const userId = req.userId;

        if (!file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const ext = file.originalname.split('.').pop();
        const storageKey = `cases/${caseId}/evidence/${uuid()}.${ext}`;

        await StorageService.upload(storageKey, file.buffer, file.mimetype);

        const evidence = await db.evidence.create({
            data: {
                caseId: caseId,
                fileName: file.originalname,
                storageKey,
                fileUrl: storageKey,
                mimeType: file.mimetype,
                status: "PENDING",
            }
        })

        await EvidenceQueueService.enqueueEvidenceUpload({
            caseId: caseId,
            evidenceId: evidence.id,
            storageKey,
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedBy: userId!,
            processorVersion: "1.0.0"
        })

        res.status(202).json({ message: "Evidence uploaded and queued for processing", evidenceId: evidence.id, status: "PENDING" });

    } catch (error) {
        console.log("")
        res.status(500).json({ error: "Failed to upload evidence" });
    }
}