import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type BuildTimelinePayload, type UpdateGraphPayload } from "../jobs/types";
import { StorageService } from "../../services/storage.service";
import { getDriver } from "../../lib/graph-driver"
import { reasoningQueue } from "../definitions/reasoning.queue";
import { graphQueue } from "../definitions/graph.queue";
import db from "../../lib/db";

export class GraphProcessor {
    static async handleUpdateGraph(job: Job<UpdateGraphPayload>) {
        const { caseId, evidenceId, extractionResultKey } = job.data;

        console.log(`[GRAPH:UPDATE] ▶ START evidenceId=${evidenceId} caseId=${caseId} extractionResultKey=${extractionResultKey}`);

        await job.updateProgress(10);
        console.log(`[GRAPH:UPDATE] Downloading extraction JSON from: ${extractionResultKey}`);
        const buffer = await StorageService.download(extractionResultKey);
        const extraction = JSON.parse(buffer.toString("utf-8"));
        console.log(`[GRAPH:UPDATE] Extraction loaded — entities=${extraction.entities?.length ?? 0} relationships=${extraction.relationships?.length ?? 0} events=${extraction.events?.length ?? 0}`);

        await job.updateProgress(30);
        console.log(`[GRAPH:UPDATE] Opening Neo4j session...`);
        const session = getDriver().session();
        console.log(`[GRAPH:UPDATE] Neo4j session opened`);

        try {
            console.log(`[GRAPH:UPDATE] Writing ${extraction.entities.length} entities to Neo4j...`);
            for (const entity of extraction.entities) {
                console.log(`[GRAPH:UPDATE]   MERGE entity id=${entity.id} type=${entity.type} name="${entity.name}"`);
                await session.run(
                    `MERGE (e:Entity {id: $id})
                    SET e.type = $type, e.name = $name, e.aliases = $aliases, e.caseId = $caseId`, { ...entity, caseId }
                );
            }
            console.log(`[GRAPH:UPDATE] ✓ All entities written`);

            await job.updateProgress(60);
            console.log(`[GRAPH:UPDATE] Writing ${extraction.relationships.length} relationships to Neo4j...`);
            for (const rel of extraction.relationships) {
                console.log(`[GRAPH:UPDATE]   MERGE rel fromId=${rel.fromId} → toId=${rel.toId} type=${rel.type} confidence=${rel.confidence}`);
                await session.run(
                    `MATCH (a:Entity {id: $fromId}), (b:Entity {id: $toId})
                    MERGE (a)-[r:RELATIONSHIP {type: $type}]->(b)
                    SET r.confidence = $confidence`, { ...rel, evidenceId }
                );
            }
            console.log(`[GRAPH:UPDATE] ✓ All relationships written`);

        } catch (err) {
            console.error(`[GRAPH:UPDATE] ✗ Neo4j write FAILED for evidenceId=${evidenceId}:`, err);
            throw err;
        } finally {
            await session.close();
            console.log(`[GRAPH:UPDATE] Neo4j session closed`);
        }

        await job.updateProgress(80);

        // Embed the normalized *text* — not the extraction JSON (which may be empty arrays)
        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        console.log(`[GRAPH:UPDATE] Enqueuing GENERATE_EMBEDDINGS job (chunkKey=${normalizedTextKey})...`);
        const embeddingJob = await reasoningQueue.add(JOB_NAMES.GENERATE_EMBEDDINGS, {
            evidenceId,
            caseId,
            processorVersion: "1.0",
            chunkKeys: [normalizedTextKey]
        }, {
            priority: JOB_PRIORITY.EMBEDDINGS
        });
        console.log(`[GRAPH:UPDATE] GENERATE_EMBEDDINGS job enqueued: jobId=${embeddingJob.id}`);

        console.log(`[GRAPH:UPDATE] Enqueuing BUILD_TIMELINE job...`);
        const timelineJob = await graphQueue.add(JOB_NAMES.BUILD_TIMELINE, {
            evidenceId,
            caseId,
            extractionResultKey,
            processorVersion: "1.0"
        }, {
            priority: JOB_PRIORITY.GRAPH_UPDATE
        });
        console.log(`[GRAPH:UPDATE] BUILD_TIMELINE job enqueued: jobId=${timelineJob.id}`);

        await job.updateProgress(100);
        console.log(`[GRAPH:UPDATE] ✓ DONE evidenceId=${evidenceId} entityCount=${extraction.entities.length}`);
        return { evidenceId, entityCount: extraction.entities.length };
    }

    static async handleBuildTimeline(job: Job<BuildTimelinePayload>) {
        const { caseId, evidenceId, extractionResultKey } = job.data;

        console.log(`[GRAPH:TIMELINE] ▶ START evidenceId=${evidenceId} caseId=${caseId} extractionResultKey=${extractionResultKey}`);

        const buffer = await StorageService.download(extractionResultKey);
        const extraction = JSON.parse(buffer.toString("utf-8"));

        const events: { title: string; description: string; occurredAt: string | null; confidence: number }[] = extraction.events
        console.log(`[GRAPH:TIMELINE] Found ${events.length} events in extraction`);

        if (!events.length) {
            console.log(`[GRAPH:TIMELINE] No events to insert — skipping DB write`);
            return { evidenceId, eventCount: 0 };
        }

        console.log(`[GRAPH:TIMELINE] Inserting ${events.length} timeline events into PostgreSQL...`);
        events.forEach((e, i) => {
            console.log(`[GRAPH:TIMELINE]   [${i + 1}] "${e.title}" occurredAt=${e.occurredAt} confidence=${e.confidence}`);
        });

        try {
            await db.timelineEvent.createMany({
                data: events.map(e => ({
                    caseId,
                    evidenceId,
                    title: e.title,
                    description: e.description,
                    confidence: e.confidence
                }))
            })
            console.log(`[GRAPH:TIMELINE] ✓ ${events.length} timeline events inserted`);
        } catch (err) {
            console.error(`[GRAPH:TIMELINE] ✗ DB write FAILED for evidenceId=${evidenceId}:`, err);
            throw err;
        }

        console.log(`[GRAPH:TIMELINE] ✓ DONE evidenceId=${evidenceId} eventCount=${events.length}`);
        return { evidenceId, eventCount: events.length };
    }
}
