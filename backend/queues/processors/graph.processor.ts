import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type UpdateGraphPayload } from "../jobs/types";
import { StorageService } from "../../services/storage.service";
import { driver } from "../../lib/graph-driver"
import { reasoningQueue } from "../definitions/reasoning.queue";
import { graphQueue } from "../definitions/graph.queue";

export class GraphProcessor {
    static async handleUpdateGraph(job: Job<UpdateGraphPayload>) {
        const { caseId, evidenceId, extractionResultKey } = job.data;

        await job.updateProgress(10);
        const buffer = await StorageService.download(extractionResultKey);
        const extraction = JSON.parse(buffer.toString("utf-8"));

        await job.updateProgress(30);
        const session = driver.session();

        try {
            for (const entity of extraction.entities) {
                await session.run(
                    `MERGE (e:Entity {id: $id})
                    SET e.type = $type, e.name = $name, e.aliases = $aliases, e.caseId = $caseId`, { ...entity, caseId }
                );
            }

            await job.updateProgress(60);
            for (const rel of extraction.relationships) {
                await session.run(
                    `MATCH (a:Entity {id: $fromId}), (b:Entity {id: $toId})
                    MERGE (a)-[r:RELATIONSHIP {type: $type}]->(b)
                    SET r.confidence = $confidence`, { ...rel, evidenceId }
                );
            }

        } finally {
            await session.close();
        }

        await job.updateProgress(80);

        await reasoningQueue.add(JOB_NAMES.GENERATE_EMBEDDINGS, {
            evidenceId,
            caseId,
            processorVersion: "1.0",
            chunkKeys: [extractionResultKey]
        }, {
            priority: JOB_PRIORITY.EMBEDDINGS
        });

        await graphQueue.add(JOB_NAMES.BUILD_TIMELINE, {
            evidenceId,
            caseId,
            extractionResultKey,
            processorVersion: "1.0"
        }, {
            priority: JOB_PRIORITY.GRAPH_UPDATE
        })

        await job.updateProgress(100);
        return { evidenceId, entityCount: extraction.entities.length };
    }
}
