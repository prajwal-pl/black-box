import type { ProcessEvidencePayload } from "../../../types/task-payloads";
import { StorageService } from "../../../services/storage.service";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn, execFileSync } from "child_process";

// NOTE: System tesseract CLI used instead of tesseract.js — see pdf.processor.ts for rationale.

const TESSERACT_SEARCH_PATHS = [
    "/usr/bin/tesseract",
    "/usr/local/bin/tesseract",
    "/opt/homebrew/bin/tesseract",
    "tesseract",
];

let TESSERACT_BIN: string | null = null;

const SUBPROCESS_ENV: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `/usr/bin:/usr/local/bin:/bin:/usr/sbin:/sbin:${process.env.PATH ?? ""}`,
    DISPLAY: "",
};

function resolveTesseractBin(): string {
    if (TESSERACT_BIN) return TESSERACT_BIN;

    for (const candidate of TESSERACT_SEARCH_PATHS) {
        try {
            if (candidate === "tesseract") {
                execFileSync("tesseract", ["--version"], { stdio: "pipe", env: SUBPROCESS_ENV });
                TESSERACT_BIN = "tesseract";
            } else {
                fs.accessSync(candidate, fs.constants.X_OK);
                TESSERACT_BIN = candidate;
            }
            console.log(`[IMAGE:OCR] Resolved tesseract binary: ${TESSERACT_BIN}`);
            return TESSERACT_BIN;
        } catch {
            // try next
        }
    }

    throw new Error(
        `tesseract binary not found. Searched: ${TESSERACT_SEARCH_PATHS.join(", ")}. ` +
        `Ensure aptGet({ packages: ["tesseract-ocr", "tesseract-ocr-eng"] }) is in trigger.config.ts and you have redeployed.`,
    );
}

function runCommand(
    command: string,
    args: string[],
    timeoutMs = 60_000,
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
            else reject(new Error(`${command} exited with code ${code}: ${stderr.slice(0, 500)}`));
        });

        proc.on("error", (err) => { clearTimeout(timer); reject(err); });
    });
}

export class ImageProcessor {
    static async handle(
        payload: ProcessEvidencePayload,
    ): Promise<{ evidenceId: string; caseId: string; normalizedTextKey: string }> {
        const { caseId, evidenceId, storageKey } = payload;

        console.log(`[IMAGE] ▶ START evidenceId=${evidenceId} caseId=${caseId} storageKey=${storageKey}`);

        console.log(`[IMAGE] Downloading from storage: ${storageKey}`);
        const buffer = await StorageService.download(storageKey);
        console.log(`[IMAGE] Downloaded ${buffer.byteLength} bytes`);

        // Resolve binary path early — fail fast if tesseract not available
        const tesseractBin = resolveTesseractBin();

        // Write buffer to temp file — system tesseract CLI takes a file path, not stdin
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "img-ocr-"));
        const imgPath = path.join(tempDir, "image.png");

        let text = "";
        try {
            fs.writeFileSync(imgPath, buffer);

            console.log(`[IMAGE] Running system Tesseract CLI on: ${imgPath}`);
            const result = await runCommand(tesseractBin, [imgPath, "stdout", "-l", "eng", "--oem", "1", "--psm", "3"]);
            text = result.stdout.trim();
            console.log(`[IMAGE] OCR complete, extracted ${text.length} chars`);
        } catch (err) {
            // Fail hard — caller (task) handles retry
            console.error(`[IMAGE] ✗ Tesseract OCR failed:`, (err as Error).message);
            throw new Error(`Image OCR failed for evidenceId=${evidenceId}: ${(err as Error).message}`);
        } finally {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch {}
        }

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        console.log(`[IMAGE] Uploading normalized text to: ${normalizedTextKey}`);
        await StorageService.upload(normalizedTextKey, Buffer.from(text, "utf-8"), "text/plain");
        console.log(`[IMAGE] ✓ DONE evidenceId=${evidenceId} textLength=${text.length}`);

        return { evidenceId, caseId, normalizedTextKey };
    }
}