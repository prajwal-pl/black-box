import type { ProcessEvidencePayload } from "../../../types/task-payloads";
import { StorageService } from "../../../services/storage.service";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn, execFileSync } from "child_process";

// ---------------------------------------------------------------------------
// WHY WE DON'T USE pdf-parse OR tesseract.js:
//
// Both libraries use WASM/Worker threads internally. In Trigger.dev's bundled
// environment, the worker script path is computed relative to the source file
// location which doesn't exist post-bundling → "Cannot find module" errors.
//
// Instead we use system CLI binaries (installed via aptGet in trigger.config.ts):
//   - pdftotext   (poppler-utils): extracts text from text-based PDFs → no workers
//   - pdftoppm    (poppler-utils): converts PDF pages to PNG images
//   - tesseract   (tesseract-ocr): OCR on PNG images → plain subprocess, no workers
//
// poppler-utils is confirmed installed in the Trigger.dev container (pdftoppm worked).
// tesseract-ocr is declared in aptGet — requires a `trigger:deploy` to take effect.
// ---------------------------------------------------------------------------

const MIN_TEXT_LENGTH_THRESHOLD = 2000;
const MIN_MEANINGFUL_CHARS_RATIO = 0.3;
const OCR_CONCURRENCY = 4; // parallel pages

// Explicit PATH — Trigger.dev runners may strip PATH for child processes
const SUBPROCESS_ENV: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `/usr/bin:/usr/local/bin:/bin:/usr/sbin:/sbin:${process.env.PATH ?? ""}`,
    DISPLAY: "",
};

// Common binary locations to try in order
const BINARY_SEARCH_PATHS = ["/usr/bin", "/usr/local/bin", "/opt/homebrew/bin"];

/** Check if a binary exists and is executable. */
function binaryExists(name: string): boolean {
    for (const dir of BINARY_SEARCH_PATHS) {
        try {
            fs.accessSync(path.join(dir, name), fs.constants.X_OK);
            return true;
        } catch {}
    }
    // Try via PATH
    try {
        execFileSync("which", [name], { stdio: "pipe", env: SUBPROCESS_ENV });
        return true;
    } catch {}
    return false;
}

/** Resolve a binary to its full path or throw with a clear diagnostic. */
function resolveBinary(name: string): string {
    for (const dir of BINARY_SEARCH_PATHS) {
        const fullPath = path.join(dir, name);
        try {
            fs.accessSync(fullPath, fs.constants.X_OK);
            return fullPath;
        } catch {}
    }
    // PATH-based fallback
    try {
        execFileSync("which", [name], { stdio: "pipe", env: SUBPROCESS_ENV });
        return name;
    } catch {}
    throw new Error(
        `Binary "${name}" not found. Searched: ${BINARY_SEARCH_PATHS.map(d => path.join(d, name)).join(", ")}. ` +
        `Ensure aptGet({ packages: ["poppler-utils", "tesseract-ocr", "tesseract-ocr-eng"] }) ` +
        `is in trigger.config.ts and you have run \`bun run trigger:deploy\`.`,
    );
}

/** Log availability of all required binaries for diagnostics. */
function logBinaryDiagnostics(): void {
    const binaries = ["pdftotext", "pdftoppm", "tesseract"];
    for (const bin of binaries) {
        const found = binaryExists(bin);
        if (found) {
            console.log(`[PDF:DIAG] ✓ ${bin} available`);
        } else {
            console.warn(`[PDF:DIAG] ✗ ${bin} NOT FOUND — aptGet install may not have run. Redeploy with: bun run trigger:deploy`);
        }
    }
}

function runCommand(
    command: string,
    args: string[],
    timeoutMs = 120_000,
): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            env: SUBPROCESS_ENV,
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            proc.kill("SIGKILL");
        }, timeoutMs);

        proc.stdout.on("data", (d: Buffer) => { stdout += d.toString("utf-8"); });
        proc.stderr.on("data", (d: Buffer) => { stderr += d.toString("utf-8"); });

        proc.on("close", (code) => {
            clearTimeout(timer);
            if (timedOut) reject(new Error(`${command} timed out after ${timeoutMs}ms`));
            else if (code === 0) resolve({ stdout, stderr });
            else reject(new Error(`${command} exited with code ${code}: ${stderr.slice(0, 600)}`));
        });

        proc.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

// ── Strategy 1: pdftotext (poppler-utils) ───────────────────────────────────
// Extracts embedded text from text-based PDFs. No workers, no WASM.
// Comes from the same poppler-utils package as pdftoppm.

async function extractWithPdftotext(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
    const pdftotextBin = resolveBinary("pdftotext");
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdftext-"));
    const inputPath = path.join(tempDir, "input.pdf");

    try {
        fs.writeFileSync(inputPath, buffer);

        // pdftotext -layout preserves whitespace layout; stdout output via "-"
        const result = await runCommand(
            pdftotextBin,
            ["-layout", "-enc", "UTF-8", inputPath, "-"],
            60_000,
        );
        const text = result.stdout.trim();

        // Count pages via pdfinfo
        let pageCount = 0;
        try {
            const pdfinfoBin = resolveBinary("pdfinfo");
            const info = await runCommand(pdfinfoBin, [inputPath], 10_000);
            const match = info.stdout.match(/Pages:\s+(\d+)/);
            if (match?.[1]) pageCount = parseInt(match[1], 10);
        } catch {
            // pdfinfo is optional — just omit pageCount
        }

        return { text, pageCount };
    } finally {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
}

// ── Strategy 2: pdftoppm + tesseract OCR (for scanned PDFs) ────────────────
// Converts pages to PNG images, then runs Tesseract on each.
// Requires tesseract-ocr + tesseract-ocr-eng installed via aptGet.

async function ocrPage(
    pngPath: string,
    tesseractBin: string,
    pageLabel: string,
): Promise<string> {
    const result = await runCommand(
        tesseractBin,
        [pngPath, "stdout", "-l", "eng", "--oem", "1", "--psm", "3"],
        60_000,
    );
    const text = result.stdout.trim();
    console.log(`[PDF:OCR] ${pageLabel}: ${text.length} chars`);
    return text;
}

async function ocrPdfWithTesseract(
    buffer: Buffer,
): Promise<{ text: string; pageCount: number; successCount: number }> {
    const pdftoppmBin = resolveBinary("pdftoppm");
    const tesseractBin = resolveBinary("tesseract");

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-ocr-"));
    const inputPath = path.join(tempDir, "input.pdf");

    console.log(`[PDF:OCR] Starting Tesseract OCR pipeline. Temp dir: ${tempDir}`);

    try {
        fs.writeFileSync(inputPath, buffer);

        // Convert all pages to 144 DPI PNG images
        await runCommand(
            pdftoppmBin,
            ["-png", "-r", "144", inputPath, path.join(tempDir, "page")],
            120_000,
        );

        const files = fs
            .readdirSync(tempDir)
            .filter((f) => f.startsWith("page") && f.endsWith(".png"))
            .sort((a, b) => {
                const numA = parseInt(a.replace(/^page-?/, "").replace(".png", ""), 10);
                const numB = parseInt(b.replace(/^page-?/, "").replace(".png", ""), 10);
                return numA - numB;
            });

        const pageCount = files.length;
        console.log(`[PDF:OCR] Generated ${pageCount} page images — OCR concurrency=${OCR_CONCURRENCY}`);

        if (pageCount === 0) {
            throw new Error("pdftoppm produced 0 page images — PDF may be corrupt or empty");
        }

        const textParts: string[] = new Array(pageCount).fill("");
        let successCount = 0;
        let failCount = 0;

        // Process in parallel batches
        for (let batchStart = 0; batchStart < files.length; batchStart += OCR_CONCURRENCY) {
            const batch = files.slice(batchStart, batchStart + OCR_CONCURRENCY);
            const batchResults = await Promise.allSettled(
                batch.map((fileName, batchIdx) => {
                    const pageIdx = batchStart + batchIdx;
                    const pageNum = pageIdx + 1;
                    const pngPath = path.join(tempDir, fileName);
                    return ocrPage(pngPath, tesseractBin, `Page ${pageNum}/${pageCount}`);
                }),
            );

            for (let i = 0; i < batchResults.length; i++) {
                const pageIdx = batchStart + i;
                const settled = batchResults[i];
                if (!settled) continue;

                if (settled.status === "fulfilled") {
                    textParts[pageIdx] = settled.value;
                    successCount++;
                } else {
                    failCount++;
                    console.error(`[PDF:OCR] Page ${batchStart + i + 1}/${pageCount} FAILED: ${(settled.reason as Error).message}`);
                }
            }
        }

        console.log(`[PDF:OCR] Done — ${successCount}/${pageCount} pages succeeded, ${failCount} failed`);

        if (failCount > 0 && successCount === 0) {
            throw new Error(
                `All ${pageCount} pages failed OCR. ` +
                `Verify tesseract-ocr and tesseract-ocr-eng are in aptGet and redeploy.`,
            );
        }

        return { text: textParts.filter(Boolean).join("\n\n"), pageCount, successCount };
    } finally {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
}

// ── Utility ──────────────────────────────────────────────────────────────────

function isTextMeaningful(text: string): boolean {
    if (text.length === 0) return false;

    const alnumChars = (text.match(/[a-zA-Z0-9]/g) ?? []).length;
    const alnumRatio = alnumChars / text.length;

    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    let pageNumberLines = 0;
    for (const line of lines) {
        if (
            /^[-–—\s]*\d+\s*(of|\/)\s*\d+[-–—\s]*$/i.test(line) ||
            /^page\s+\d+\s*(of|\/)\s*\d+/i.test(line)
        ) {
            pageNumberLines++;
        }
    }
    const pageNumberRatio = pageNumberLines / Math.max(lines.length, 1);
    const isMeaningful = alnumRatio >= MIN_MEANINGFUL_CHARS_RATIO && pageNumberRatio < 0.5;

    console.log(
        `[PDF] Quality: alnumRatio=${alnumRatio.toFixed(2)} pageNumberRatio=${pageNumberRatio.toFixed(2)} lines=${lines.length} meaningful=${isMeaningful}`,
    );
    return isMeaningful;
}

// ── Main processor ───────────────────────────────────────────────────────────

export class PdfProcessor {
    static async handle(
        payload: ProcessEvidencePayload,
    ): Promise<{ evidenceId: string; caseId: string; normalizedTextKey: string; pageCount: number }> {
        const { caseId, evidenceId, storageKey } = payload;

        console.log(`[PDF] ▶ START evidenceId=${evidenceId} caseId=${caseId}`);

        // Log binary availability upfront so we know the container state
        logBinaryDiagnostics();

        console.log(`[PDF] Downloading from storage: ${storageKey}`);
        const buffer = await StorageService.download(storageKey);
        console.log(`[PDF] Downloaded ${buffer.byteLength} bytes`);

        let text = "";
        let pageCount = 0;

        // ── Strategy 1: pdftotext (fast, no workers, same package as pdftoppm) ──
        console.log(`[PDF] Strategy 1: pdftotext (system binary)...`);
        try {
            const result = await extractWithPdftotext(buffer);
            text = result.text;
            pageCount = result.pageCount;
            console.log(`[PDF] pdftotext extracted ${text.length} chars, ${pageCount} pages`);
            if (text.length > 0) {
                console.log(`[PDF] First 300 chars: "${text.substring(0, 300)}"`);
            }
        } catch (err) {
            console.warn(`[PDF] pdftotext failed: ${(err as Error).message}`);
            text = "";
        }

        const meaningful = isTextMeaningful(text);
        console.log(`[PDF] Quality: length=${text.length} meaningful=${meaningful}`);

        // ── Strategy 2: pdftoppm + Tesseract OCR (for scanned/image-based PDFs) ──
        if (text.length < MIN_TEXT_LENGTH_THRESHOLD || !meaningful) {
            console.warn(
                `[PDF] ⚠ pdftotext insufficient (${text.length} chars, meaningful=${meaningful}) — ` +
                `falling back to Tesseract OCR via pdftoppm`,
            );
            try {
                const ocrResult = await ocrPdfWithTesseract(buffer);
                text = ocrResult.text;
                if (pageCount === 0) pageCount = ocrResult.pageCount;
                console.log(
                    `[PDF] OCR extracted ${text.length} chars from ` +
                    `${ocrResult.successCount}/${ocrResult.pageCount} pages`,
                );
                if (text.length > 0) {
                    console.log(`[PDF] OCR first 300 chars: "${text.substring(0, 300)}"`);
                }
            } catch (ocrErr) {
                console.error(`[PDF] ✗ OCR failed: ${(ocrErr as Error).message}`);
                // Proceed with whatever pdftotext gave us (may be empty)
            }
        }

        if (text.length === 0) {
            console.warn(
                `[PDF] ⚠ No text extracted for evidenceId=${evidenceId}. ` +
                `If this is a scanned PDF, ensure tesseract-ocr is in aptGet and redeploy.`,
            );
        }

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        console.log(`[PDF] Uploading normalized text (${text.length} chars) to: ${normalizedTextKey}`);
        await StorageService.upload(normalizedTextKey, Buffer.from(text, "utf-8"), "text/plain");

        console.log(`[PDF] ✓ DONE evidenceId=${evidenceId} pageCount=${pageCount} textLength=${text.length}`);
        return { evidenceId, caseId, normalizedTextKey, pageCount };
    }
}