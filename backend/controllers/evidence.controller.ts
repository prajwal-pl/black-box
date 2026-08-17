/// <reference types="multer" />
import type { RequestHandler } from "express";
import { v4 as uuid } from "uuid";
import { StorageService } from "../services/storage.service";
import db from "../lib/db";
import { EvidenceTaskService } from "../services/evidence.task.service";

export const uploadEvidence: RequestHandler = async (req, res) => {
    try {
        const file = req.file;
        const { caseId } = req.params as { caseId: string };
        const userId = req.userId;

        if (!file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const ext = file.originalname.split(".").pop();
        const storageKey = `cases/${caseId}/evidence/${uuid()}.${ext}`;

        await StorageService.upload(storageKey, file.buffer, file.mimetype);

        const evidence = await db.evidence.create({
            data: {
                caseId,
                fileName: file.originalname,
                storageKey,
                fileUrl: storageKey,
                mimeType: file.mimetype,
                status: "PENDING",
            },
        });

        await EvidenceTaskService.enqueueEvidenceUpload({
            caseId,
            evidenceId: evidence.id,
            storageKey,
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedBy: userId!,
            processorVersion: "1.0.0",
        });

        res.status(202).json({
            message: "Evidence uploaded and queued for processing",
            evidenceId: evidence.id,
            status: "PENDING",
        });
    } catch (error) {
        console.error("Failed to upload evidence:", error);
        res.status(500).json({ error: "Failed to upload evidence" });
    }
};

export const getEvidenceStatus: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params as { id: string };
        const evidence = await db.evidence.findUnique({ where: { id } });
        if (!evidence) {
            return res.status(404).json({ error: "Evidence not found" });
        }
        res.json({ id: evidence.id, status: evidence.status });
    } catch (error) {
        console.error("Failed to get evidence status:", error);
        res.status(500).json({ error: "Failed to get evidence status" });
    }
};

export const getEvidenceByCase: RequestHandler = async (req, res) => {
    try {
        const { caseId } = req.params as { caseId: string };

        if (!caseId) {
            return res.status(400).json({ error: "Case ID is required" });
        }

        const evidence = await db.evidence.findMany({ where: { caseId } });
        res.json({ evidence });
    } catch (error) {
        console.error("Failed to get evidence by case:", error);
        res.status(500).json({ error: "Failed to get evidence by case" });
    }
};

export const deleteEvidence: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params as { id: string };
        const evidence = await db.evidence.findUnique({ where: { id } });
        if (!evidence) {
            return res.status(404).json({ error: "Evidence not found" });
        }

        await StorageService.delete(evidence.storageKey);
        await db.evidence.delete({ where: { id } });

        res.json({ message: "Evidence deleted successfully" });
    } catch (error) {
        console.error("Failed to delete evidence:", error);
        res.status(500).json({ error: "Failed to delete evidence" });
    }
};

export const reprocessEvidence: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params as { id: string };
        const handle = await EvidenceTaskService.requeueEvidenceProcessing(id);
        res.json({ message: "Evidence requeued for processing", jobId: handle.id });
    } catch (error) {
        console.error("Failed to requeue evidence:", error);
        res.status(500).json({ error: (error as Error).message });
    }
};