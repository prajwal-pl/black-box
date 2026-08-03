import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";
import { StorageService } from "../../../services/storage.service";
import { PDFParse } from "pdf-parse";
import { graphQueue } from "../../definitions/graph.queue";
import Tesseract from "tesseract.js";
import { createCanvas } from "canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// Disable the browser-style Worker — pdfjs runs in the main thread in Node.js/Bun.
// This must be set before any getDocument() call.
pdfjs.GlobalWorkerOptions.workerSrc = "";

// Minimum char threshold below which we consider pdf-parse output insufficient.
// Scanned PDFs typically yield only page-number headers (~527 chars for 30 pages).
const MIN_TEXT_LENGTH_THRESHOLD = 800;

// Render each PDF page to a PNG buffer at the given scale and OCR it.
async function ocrPdfBuffer(buffer: Buffer): Promise<string> {
    console.log(`[PDF:OCR] Loading PDF with pdfjs for page rendering...`);
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;
    console.log(`[PDF:OCR] PDF loaded — ${pdf.numPages} pages`);

    const textParts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log(`[PDF:OCR] Rendering page ${pageNum}/${pdf.numPages}...`);
        const page = await pdf.getPage(pageNum);
        // Scale 2.0 gives ~144 DPI — good balance for OCR accuracy vs. speed
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext("2d");

        await page.render({
            canvasContext: context as unknown as CanvasRenderingContext2D,
            viewport,
        }).promise;

        const pngBuffer = canvas.toBuffer("image/png");
        console.log(`[PDF:OCR] Page ${pageNum} rendered (${pngBuffer.byteLength} bytes), running Tesseract...`);

        const { data: { text } } = await Tesseract.recognize(pngBuffer, "eng", {
            langPath: new URL(".", import.meta.url).pathname.replace(/\/queues\/processors\/processing\/$/, ""),
        });
        const trimmed = text.trim();
        console.log(`[PDF:OCR] Page ${pageNum} OCR: ${trimmed.length} chars`);
        if (trimmed.length > 0) {
            textParts.push(trimmed);
        }

        page.cleanup();
    }

    await pdf.destroy();
    return textParts.join("\n\n");
}

export class PdfProcessor {
    static async handle(job: Job<ProcessEvidencePayload>) {
        const { caseId, evidenceId, storageKey } = job.data;

        console.log(`[PDF] ▶ START evidenceId=${evidenceId} caseId=${caseId} storageKey=${storageKey}`);

        await job.updateProgress(10);
        console.log(`[PDF] Downloading from storage: ${storageKey}`);
        const buffer = await StorageService.download(storageKey);
        console.log(`[PDF] Downloaded ${buffer.byteLength} bytes`);

        await job.updateProgress(20);
        console.log(`[PDF] Parsing PDF with pdf-parse...`);
        let text = "";
        let pageCount = 0;
        try {
            // pdf-parse v2: constructor takes options object with `data` field
            const parser = new PDFParse({ data: buffer });
            const result = await parser.getText();
            text = result.text?.trim() ?? "";
            pageCount = result.total ?? 0;
            console.log(`[PDF] pdf-parse extracted ${text.length} chars across ${pageCount} pages`);
            console.log(`[PDF] First 300 chars: "${text.substring(0, 300)}"`);
        } catch (err) {
            console.warn(`[PDF] pdf-parse threw an error — will fall back to OCR:`, err);
            text = "";
        }

        // If pdf-parse yielded too little text, the PDF is scanned/image-based.
        // Render each page with pdfjs → PNG → Tesseract OCR.
        if (text.length < MIN_TEXT_LENGTH_THRESHOLD) {
            console.warn(`[PDF] ⚠ pdf-parse yielded only ${text.length} chars (threshold=${MIN_TEXT_LENGTH_THRESHOLD}) — falling back to page-by-page Tesseract OCR via pdfjs renderer`);
            await job.updateProgress(30);
            try {
                text = await ocrPdfBuffer(buffer);
                console.log(`[PDF] Page-by-page OCR complete: ${text.length} chars extracted`);
                console.log(`[PDF] First 300 chars of OCR text: "${text.substring(0, 300)}"`);
            } catch (ocrErr) {
                console.error(`[PDF] Page-by-page OCR failed — rethrowing so BullMQ can retry:`, ocrErr);
                throw ocrErr;
            }
        }

        if (text.length === 0) {
            console.warn(`[PDF] ⚠ All extraction methods yielded empty text for evidenceId=${evidenceId}`);
        }

        await job.updateProgress(80);
        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        console.log(`[PDF] Uploading normalized text (${text.length} chars) to: ${normalizedTextKey}`);
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");
        console.log(`[PDF] Normalized text uploaded successfully`);

        console.log(`[PDF] Enqueuing EXTRACT_ENTITIES job for evidenceId=${evidenceId}`);
        const enqueued = await graphQueue.add(JOB_NAMES.EXTRACT_ENTITIES, {
            evidenceId,
            caseId,
            normalizedTextKey,
            processorVersion: "1.0.0",
        }, { priority: JOB_PRIORITY.ENTITY_EXTRACTION });
        console.log(`[PDF] EXTRACT_ENTITIES job enqueued: jobId=${enqueued.id}`);

        await job.updateProgress(100);
        console.log(`[PDF] ✓ DONE evidenceId=${evidenceId} pageCount=${pageCount} finalTextLength=${text.length}`);
        return { evidenceId, caseId, normalizedTextKey, pageCount };
    }
}