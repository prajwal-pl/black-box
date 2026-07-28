import type { RequestHandler } from "express";
import db from "../lib/db";

export const getTimeline: RequestHandler = async (req, res) => {
    const { caseId } = req.params as { caseId: string };
    try {
        const events = await db.timelineEvent.findMany({
            where: { caseId },
            orderBy: { createdAt: "asc" },
        });
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: "Failed to get timeline" });
    }
};
