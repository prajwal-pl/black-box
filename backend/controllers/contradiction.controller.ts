import type { RequestHandler } from "express";
import db from "../lib/db";
import { EvidenceQueueService } from "../services/evidence.queue.service";

export const getContradictions: RequestHandler = async (req, res) => {
    const { caseId } = req.params as { caseId: string };
    try {
        const contradictions = await db.contradictions.findMany({
            where: { caseId },
            orderBy: { createdAt: "desc" },
        });
        res.json(contradictions);
    } catch (error) {
        res.status(500).json({ error: "Failed to get contradictions" });
    }
};

export const updateContradictionStatus: RequestHandler = async (req, res) => {
    const { id } = req.params as { id: string };
    try {
        const contradiction = await db.contradictions.update({
            where: { id },
            data: { status: req.body.status },
        });
        res.json(contradiction);
    } catch (error) {
        res.status(500).json({ error: "Failed to update contradiction" });
    }
};

export const triggerContradictionScan: RequestHandler = async (req, res) => {
    const { caseId } = req.params as { caseId: string };
    try {
        const { evidenceId } = req.body;
        if (!evidenceId) return res.status(400).json({ error: "evidenceId is required" });
        const job = await EvidenceQueueService.enqueueScanContradictions({
            caseId,
            evidenceId,
        });
        res.json({ jobId: job.id });
    } catch (error) {
        res.status(500).json({ error: "Failed to trigger contradiction scan" });
    }
};
