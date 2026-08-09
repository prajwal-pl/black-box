import type { Job } from "bullmq";
import { JOB_NAMES, JOB_PRIORITY, type ProcessEvidencePayload } from "../../jobs/types";
import { StorageService } from "../../../services/storage.service";
import { PDFParse } from "pdf-parse";
import { graphQueue } from "../../definitions/graph.queue";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";

// Absolute path to the backend root where eng.traineddata lives.
const TESSERACT_LANG_PATH = String(new URL("../../..", import.meta.url).pathname).replace(/\/$/, "");
const OCR_WORKER_PATH = new URL("./ocr-worker.ts", import.meta.url).pathname;

// Minimum char threshold below which we consider pdf-parse output insufficient.
const MIN_TEXT_LENGTH_THRESHOLD = 2000;
const MIN_MEANINGFUL_CHARS_RATIO = 0.3;

function runCommand(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (data) => { stdout += data.toString(); });
        proc.stderr.on("data", (data) => { stderr += data.toString(); });
        proc.on("close", (code) => {
            if (code === 0) resolve({ stdout, stderr });
            else reject(new Error(`${command} exited with code ${code}: ${stderr}`));
        });
        proc.on("error", reject);
    });
}

async function ocrPdfWithPoppler(buffer: Buffer): Promise<string> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-ocr-"));
    const inputPath = path.join(tempDir, "input.pdf");
    
    console.log(`[PDF:OCR] Using system pdftoppm for PDF-to-image conversion...`);
    console.log(`[PDF:OCR] Tesseract lang path: ${TESSERACT_LANG_PATH}`);
    console.log(`[PDF:OCR] Temp dir: ${tempDir}`);

    try {
        fs.writeFileSync(inputPath, buffer);
        
        // Convert PDF to PNG images using system pdftoppm
        // -r 144 = 144 DPI
        // -png = output format
        await runCommand("pdftoppm", ["-png", "-r", "144", inputPath, path.join(tempDir, "page")]);

        // Find all generated PNG files
        const files = fs.readdirSync(tempDir)
            .filter(f => f.startsWith("page") && f.endsWith(".png"))
            .sort((a, b) => {
                const numA = parseInt(a.replace("page-", "").replace(".png", ""), 10);
                const numB = parseInt(b.replace("page-", "").replace(".png", ""), 10);
                return numA - numB;
            });

        console.log(`[PDF:OCR] Generated ${files.length} page images`);

        const textParts: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const pageNum = i + 1;
            const fileName = files[i];
            if (!fileName) continue;
            const pngPath = path.join(tempDir, fileName);
            const pngBuffer = fs.readFileSync(pngPath);
            
            console.log(`[PDF:OCR] Page ${pageNum}/${files.length} (${pngBuffer.byteLength} bytes), running Tesseract in isolated process...`);

            try {
                const result = await runCommand("bun", [OCR_WORKER_PATH, pngPath], {
                    env: { ...process.env, TESSERACT_LANG_PATH },
                });
                const trimmed = result.stdout.trim();
                console.log(`[PDF:OCR] Page ${pageNum} OCR: ${trimmed.length} chars`);
                if (trimmed.length > 0) {
                    textParts.push(trimmed);
                }
            } catch (pageErr) {
                console.error(`[PDF:OCR] Page ${pageNum} OCR FAILED, continuing:`, (pageErr as Error).message);
                // Continue with other pages instead of crashing the whole job
            }
        }

        return textParts.join("\n\n");
    } finally {
        // Cleanup temp files
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {}
    }
}

function isTextMeaningful(text: string): boolean {
    if (text.length === 0) return false;
    
    const alnumChars = (text.match(/[a-zA-Z0-9]/g) || []).length;
    const alnumRatio = alnumChars / text.length;
    
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let pageNumberLines = 0;
    for (const line of lines) {
        if (/^[-–—\s]*\d+\s*(of|\/)\s*\d+[-–—\s]*$/i.test(line) || 
            /^page\s+\d+\s*(of|\/)\s*\d+/i.test(line)) {
            pageNumberLines++;
        }
    }
    const pageNumberRatio = pageNumberLines / Math.max(lines.length, 1);
    
    const isMeaningful = alnumRatio >= MIN_MEANINGFUL_CHARS_RATIO && pageNumberRatio < 0.5;
    
    console.log(`[PDF] Quality details: alnumRatio=${alnumRatio.toFixed(2)}, pageNumberRatio=${pageNumberRatio.toFixed(2)}, lines=${lines.length}, pageNumLines=${pageNumberLines}, meaningful=${isMeaningful}`);
    
    return isMeaningful;
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

        const meaningful = isTextMeaningful(text);
        console.log(`[PDF] Quality check: length=${text.length}, meaningful=${meaningful}, alnumRatio=${((text.match(/[a-zA-Z0-9]/g) || []).length / (text.length || 1)).toFixed(2)}`);
        if (text.length < MIN_TEXT_LENGTH_THRESHOLD || !meaningful) {
            console.warn(`[PDF] ⚠ pdf-parse yielded ${text.length} chars (threshold=${MIN_TEXT_LENGTH_THRESHOLD}), meaningful=${meaningful} — falling back to page-by-page Tesseract OCR via pdftoppm`);
            await job.updateProgress(30);
            try {
                text = await ocrPdfWithPoppler(buffer);
                console.log(`[PDF] Page-by-page OCR complete: ${text.length} chars extracted`);
                console.log(`[PDF] First 300 chars of OCR text: "${text.substring(0, 300)}"`);
            } catch (ocrErr) {
                console.error(`[PDF] ⚠ Page-by-page OCR failed, continuing with pdf-parse output:`, (ocrErr as Error).message);
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