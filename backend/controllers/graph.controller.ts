import type { RequestHandler } from "express";
import { driver } from "../lib/graph-driver";

export const getGraph: RequestHandler = async (req, res) => {
    const { caseId } = req.params;
    const session = driver.session();
    try {
        const result = await session.run(
            `MATCH (e:Entity {caseId: $caseId})
             OPTIONAL MATCH (e)-[r:RELATIONSHIP]->(t:Entity {caseId: $caseId})
             RETURN e, r, t`,
            { caseId }
        );

        const nodes = new Map<string, object>();
        const edges: object[] = [];

        for (const record of result.records) {
            const e = record.get("e")?.properties;
            const t = record.get("t")?.properties;
            const r = record.get("r")?.properties;

            if (e) nodes.set(e.id, e);
            if (t) nodes.set(t.id, t);
            if (r && e && t) edges.push({ ...r, from: e.id, to: t.id });
        }

        res.json({ nodes: Array.from(nodes.values()), edges });
    } catch (error) {
        res.status(500).json({ error: "Failed to get graph" });
    } finally {
        await session.close();
    }
};
