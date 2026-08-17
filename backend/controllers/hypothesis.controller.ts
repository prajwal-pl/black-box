import type { RequestHandler } from "express";
import db from "../lib/db";
import { EvidenceTaskService } from "../services/evidence.task.service";

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
            where: { id },
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
        const handle = await EvidenceTaskService.manualHypothesisUpdate(caseId);
        res.json({ jobId: handle.id });
    } catch (error) {
        res.status(500).json({ error: "Failed to trigger hypothesis update" });
    }
};
