import type { RequestHandler } from "express";
import db from "../lib/db";
import { EvidenceQueueService } from "../services/evidence.queue.service";

export const getHypotheses: RequestHandler = async (req, res) => {

    const { caseId } = req.params as { caseId: string };
    try {
        const hypotheses = await db.hypothesis.findMany({
            where: { caseId },
            orderBy: { confidence: "desc" },
        });
        res.json(hypotheses);
    } catch (error) {
        res.status(500).json({ error: "Failed to get hypotheses" });
    }
};

export const updateHypothesisStatus: RequestHandler = async (req, res) => {
    const { id } = req.params as { id: string };

    try {
        const hypothesis = await db.hypothesis.update({
            where: { id: id },
            data: { status: req.body.status },
        });
        res.json(hypothesis);
    } catch (error) {
        res.status(500).json({ error: "Failed to update hypothesis" });
    }
};

export const triggerHypothesisUpdate: RequestHandler = async (req, res) => {
    const { caseId } = req.params as { caseId: string };

    try {
        const job = await EvidenceQueueService.manualHypothesisUpdate(caseId);
        res.json({ jobId: job.id });
    } catch (error) {
        res.status(500).json({ error: "Failed to trigger hypothesis update" });
    }
};
