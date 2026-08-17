import type { BuildTimelinePayload, UpdateGraphPayload } from "../../types/task-payloads";
import { StorageService } from "../../services/storage.service";
import { getDriver } from "../../lib/graph-driver";
import db from "../../lib/db";

export class GraphProcessor {
    static async handleUpdateGraph(
        payload: UpdateGraphPayload,
    ): Promise<{ evidenceId: string; entityCount: number }> {
        const { caseId, evidenceId, extractionResultKey } = payload;

        console.log(
            `[GRAPH:UPDATE] ▶ START evidenceId=${evidenceId} caseId=${caseId} extractionResultKey=${extractionResultKey}`,
        );

        console.log(`[GRAPH:UPDATE] Downloading extraction JSON from: ${extractionResultKey}`);
        const buffer = await StorageService.download(extractionResultKey);
        const extraction = JSON.parse(buffer.toString("utf-8")) as {
            entities: { id: string; type: string; name: string; aliases: string[] }[];
            relationships: { fromId: string; toId: string; type: string; confidence: number }[];
            events: { title: string; description: string; occurredAt: string | null; confidence: number }[];
        };
        console.log(
            `[GRAPH:UPDATE] Extraction loaded — entities=${extraction.entities?.length ?? 0} relationships=${extraction.relationships?.length ?? 0} events=${extraction.events?.length ?? 0}`,
        );

        const session = getDriver().session();
        console.log(`[GRAPH:UPDATE] Neo4j session opened`);

        try {
            console.log(`[GRAPH:UPDATE] Writing ${extraction.entities.length} entities to Neo4j...`);
            for (const entity of extraction.entities) {
                console.log(
                    `[GRAPH:UPDATE]   MERGE entity id=${entity.id} type=${entity.type} name="${entity.name}"`,
                );
                await session.run(
                    `MERGE (e:Entity {id: $id})
                    SET e.type = $type, e.name = $name, e.aliases = $aliases, e.caseId = $caseId`,
                    { ...entity, caseId },
                );
            }
            console.log(`[GRAPH:UPDATE] ✓ All entities written`);

            console.log(
                `[GRAPH:UPDATE] Writing ${extraction.relationships.length} relationships to Neo4j...`,
            );
            for (const rel of extraction.relationships) {
                console.log(
                    `[GRAPH:UPDATE]   MERGE rel fromId=${rel.fromId} → toId=${rel.toId} type=${rel.type} confidence=${rel.confidence}`,
                );
                await session.run(
                    `MATCH (a:Entity {id: $fromId}), (b:Entity {id: $toId})
                    MERGE (a)-[r:RELATIONSHIP {type: $type}]->(b)
                    SET r.confidence = $confidence`,
                    { ...rel, evidenceId },
                );
            }
            console.log(`[GRAPH:UPDATE] ✓ All relationships written`);
        } catch (err) {
            console.error(
                `[GRAPH:UPDATE] ✗ Neo4j write FAILED for evidenceId=${evidenceId}:`,
                err,
            );
            throw err;
        } finally {
            await session.close();
            console.log(`[GRAPH:UPDATE] Neo4j session closed`);
        }

        console.log(`[GRAPH:UPDATE] ✓ DONE evidenceId=${evidenceId} entityCount=${extraction.entities.length}`);
        return { evidenceId, entityCount: extraction.entities.length };
    }

    static async handleBuildTimeline(
        payload: BuildTimelinePayload,
    ): Promise<{ evidenceId: string; eventCount: number }> {
        const { caseId, evidenceId, extractionResultKey } = payload;

        console.log(
            `[GRAPH:TIMELINE] ▶ START evidenceId=${evidenceId} caseId=${caseId}`,
        );

        const buffer = await StorageService.download(extractionResultKey);
        const extraction = JSON.parse(buffer.toString("utf-8")) as {
            events: { title: string; description: string; occurredAt: string | null; confidence: number }[];
        };

        const events = extraction.events;
        console.log(`[GRAPH:TIMELINE] Found ${events.length} events in extraction`);

        if (!events.length) {
            console.log(`[GRAPH:TIMELINE] No events to insert — skipping DB write`);
            return { evidenceId, eventCount: 0 };
        }

        console.log(`[GRAPH:TIMELINE] Inserting ${events.length} timeline events into PostgreSQL...`);
        try {
            await db.timelineEvent.createMany({
                data: events.map((e) => ({
                    caseId,
                    evidenceId,
                    title: e.title,
                    description: e.description,
                    confidence: e.confidence,
                })),
            });
            console.log(`[GRAPH:TIMELINE] ✓ ${events.length} timeline events inserted`);
        } catch (err) {
            console.error(
                `[GRAPH:TIMELINE] ✗ DB write FAILED for evidenceId=${evidenceId}:`,
                err,
            );
            throw err;
        }

        console.log(
            `[GRAPH:TIMELINE] ✓ DONE evidenceId=${evidenceId} eventCount=${events.length}`,
        );
        return { evidenceId, eventCount: events.length };
    }
}
