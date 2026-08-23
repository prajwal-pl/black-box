-- AddForeignKey with Cascade: Evidence → Case
ALTER TABLE "Evidence" DROP CONSTRAINT IF EXISTS "Evidence_caseId_fkey";
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey with Cascade: Hypothesis → Case
ALTER TABLE "Hypothesis" DROP CONSTRAINT IF EXISTS "Hypothesis_caseId_fkey";
ALTER TABLE "Hypothesis" ADD CONSTRAINT "Hypothesis_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey with Cascade: Contradictions → Case
ALTER TABLE "Contradictions" DROP CONSTRAINT IF EXISTS "Contradictions_caseId_fkey";
ALTER TABLE "Contradictions" ADD CONSTRAINT "Contradictions_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey with Cascade: TimelineEvent → Case
ALTER TABLE "TimelineEvent" DROP CONSTRAINT IF EXISTS "TimelineEvent_caseId_fkey";
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
