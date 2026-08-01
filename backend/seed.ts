import db from "./lib/db";
import { getDriver } from "./lib/graph-driver";
import { randomUUID } from "crypto";

const caseId1 = randomUUID();
const caseId2 = randomUUID();

async function seedPostgres(userId: string) {
    await db.case.createMany({
        data: [
            { id: caseId1, name: "Operation Nightfall", status: "ACTIVE", severity: "HIGH", userId },
            { id: caseId2, name: "Project Lazarus", status: "ACTIVE", severity: "CRITICAL", userId },
        ],
    });

    // Evidence
    await db.evidence.createMany({
        data: [
            { caseId: caseId1, fileName: "financial_records_q3.pdf", fileUrl: "/files/fin_q3.pdf", mimeType: "application/pdf", storageKey: "fin_q3", status: "COMPLETED", description: "Q3 financial records showing anomalous transfers" },
            { caseId: caseId1, fileName: "surveillance_footage_oct12.mp4", fileUrl: "/files/surv_oct12.mp4", mimeType: "video/mp4", storageKey: "surv_oct12", status: "COMPLETED", description: "Surveillance footage from October 12th" },
            { caseId: caseId1, fileName: "phone_records_dump.csv", fileUrl: "/files/phone_dump.csv", mimeType: "text/csv", storageKey: "phone_dump", status: "COMPLETED", description: "Phone records for primary suspect" },
            { caseId: caseId2, fileName: "autopsy_report.pdf", fileUrl: "/files/autopsy.pdf", mimeType: "application/pdf", storageKey: "autopsy", status: "COMPLETED", description: "Official autopsy report" },
            { caseId: caseId2, fileName: "witness_statement_doe.txt", fileUrl: "/files/witness_doe.txt", mimeType: "text/plain", storageKey: "witness_doe", status: "PROCESSING", description: "Witness statement from Jane Doe" },
        ],
    });

    // Timeline events
    const evidenceRecords = await db.evidence.findMany({ where: { caseId: caseId1 } });
    const ev0 = evidenceRecords[0].id;
    const ev1 = evidenceRecords[1].id;

    await db.timelineEvent.createMany({
        data: [
            { caseId: caseId1, title: "Initial wire transfer detected", description: "Anomalous $2.4M transfer from shell company to offshore account", evidenceId: ev0, occuredAt: new Date("2024-10-01T09:15:00Z"), confidence: 0.95 },
            { caseId: caseId1, title: "Subject photographed at location", description: "Surveillance confirms subject present at warehouse district", evidenceId: ev1, occuredAt: new Date("2024-10-12T22:40:00Z"), confidence: 0.87 },
            { caseId: caseId1, title: "Secondary transfer initiated", description: "Follow-on transfer of $800K to separate account", evidenceId: ev0, occuredAt: new Date("2024-10-15T14:00:00Z"), confidence: 0.78 },
            { caseId: caseId1, title: "Phone contact with known associate", description: "17-minute call to number linked to organized crime network", evidenceId: ev0, occuredAt: new Date("2024-10-18T11:22:00Z"), confidence: 0.65 },
        ],
    });

    // Hypotheses
    await db.hypothesis.createMany({
        data: [
            { caseId: caseId1, content: "Subject is laundering proceeds through a network of shell companies registered in the Cayman Islands", confidence: 0.82, status: "ACTIVE" },
            { caseId: caseId1, content: "The warehouse meeting on Oct 12 was a handoff of physical assets, not a coincidental visit", confidence: 0.71, status: "ACTIVE" },
            { caseId: caseId1, content: "A second actor within the financial institution is facilitating the transfers", confidence: 0.55, status: "ACTIVE" },
            { caseId: caseId2, content: "Cause of death was not accidental — toxicology inconsistencies suggest deliberate poisoning", confidence: 0.88, status: "CONFIRMED" },
            { caseId: caseId2, content: "Witness Doe's account has been coached — timeline contradicts physical evidence", confidence: 0.60, status: "ACTIVE" },
        ],
    });

    // Contradictions
    await db.contradictions.createMany({
        data: [
            { caseId: caseId1, title: "Transfer timestamps vs. alibi", description: "Subject claims to have been in London on Oct 1, but transfer was initiated from a domestic IP address", severity: "HIGH", status: "OPEN", evidenceIds: [ev0] },
            { caseId: caseId1, title: "Phone records gap", description: "Phone records show no activity for 6 hours on Oct 12, contradicting claimed continuous travel", severity: "MEDIUM", status: "OPEN", evidenceIds: [ev1] },
            { caseId: caseId2, title: "Autopsy vs. witness timeline", description: "Estimated time of death is 3 hours earlier than witness claims to have last seen the victim alive", severity: "CRITICAL", status: "OPEN", evidenceIds: [] },
        ],
    });
}

async function seedNeo4j() {
    const driver = getDriver();
    const session = driver.session();

    const entities = [
        { id: randomUUID(), name: "Marcus Hale", type: "PERSON", caseId: caseId1 },
        { id: randomUUID(), name: "Vantage Capital LLC", type: "ORGANIZATION", caseId: caseId1 },
        { id: randomUUID(), name: "Cayman Shell Co. #7", type: "ORGANIZATION", caseId: caseId1 },
        { id: randomUUID(), name: "Warehouse District", type: "LOCATION", caseId: caseId1 },
        { id: randomUUID(), name: "Raymond Cross", type: "PERSON", caseId: caseId1 },
        { id: randomUUID(), name: "Offshore Account #4412", type: "FINANCIAL", caseId: caseId1 },
        { id: randomUUID(), name: "Elena Vasquez", type: "PERSON", caseId: caseId2 },
        { id: randomUUID(), name: "Dr. Osei Mensah", type: "PERSON", caseId: caseId2 },
        { id: randomUUID(), name: "Meridian Pharma", type: "ORGANIZATION", caseId: caseId2 },
    ];

    const [marcus, vantage, cayman, warehouse, raymond, offshore, elena, osei, meridian] = entities;

    const relationships = [
        { from: marcus.id, to: vantage.id, type: "CONTROLS", confidence: 0.91, caseId: caseId1 },
        { from: vantage.id, to: cayman.id, type: "TRANSFERS_TO", confidence: 0.88, caseId: caseId1 },
        { from: cayman.id, to: offshore.id, type: "TRANSFERS_TO", confidence: 0.84, caseId: caseId1 },
        { from: marcus.id, to: warehouse.id, type: "VISITED", confidence: 0.87, caseId: caseId1 },
        { from: marcus.id, to: raymond.id, type: "CONTACTED", confidence: 0.65, caseId: caseId1 },
        { from: raymond.id, to: cayman.id, type: "ASSOCIATED_WITH", confidence: 0.72, caseId: caseId1 },
        { from: elena.id, to: meridian.id, type: "EMPLOYED_BY", confidence: 0.99, caseId: caseId2 },
        { from: osei.id, to: elena.id, type: "EXAMINED", confidence: 0.95, caseId: caseId2 },
        { from: meridian.id, to: elena.id, type: "SUPPLIED_TO", confidence: 0.60, caseId: caseId2 },
    ];

    try {
        for (const e of entities) {
            await session.run(
                `MERGE (n:Entity {id: $id}) SET n.name = $name, n.type = $type, n.caseId = $caseId`,
                e
            );
        }

        for (const r of relationships) {
            await session.run(
                `MATCH (a:Entity {id: $from}), (b:Entity {id: $to})
                 MERGE (a)-[rel:RELATIONSHIP {caseId: $caseId}]->(b)
                 SET rel.type = $type, rel.confidence = $confidence`,
                r
            );
        }
    } finally {
        await session.close();
        await driver.close();
    }
}

async function main() {
    const user = await db.user.upsert({
        where: { email: "investigator@blackbox.dev" },
        update: {},
        create: { email: "investigator@blackbox.dev", name: "Lead Investigator", password: "hashed_placeholder" },
    });

    await seedPostgres(user.id);
    await seedNeo4j();

    console.log(`Seeded: user=${user.id}, cases=${caseId1}, ${caseId2}`);
    await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
