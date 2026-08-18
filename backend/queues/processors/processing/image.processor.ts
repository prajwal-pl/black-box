import type { ProcessEvidencePayload } from "../../../types/task-payloads";
import { StorageService } from "../../../services/storage.service";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";

// NOTE: We deliberately use the system `tesseract` CLI binary instead of tesseract.js.
// tesseract.js runs OCR via WASM Worker threads whose internal worker script path
// (/trigger/worker-script/node/index.js) breaks in Trigger.dev's bundled environment.
// The system binary (installed via aptGet in trigger.config.ts) has no such issue.

function runCommand(
    command: string,
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<{ stdout: string; stderr: string }> {
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

export class ImageProcessor {
    static async handle(
        payload: ProcessEvidencePayload,
    ): Promise<{ evidenceId: string; caseId: string; normalizedTextKey: string }> {
        const { caseId, evidenceId, storageKey } = payload;

        console.log(`[IMAGE] ▶ START evidenceId=${evidenceId} caseId=${caseId} storageKey=${storageKey}`);

        console.log(`[IMAGE] Downloading from storage: ${storageKey}`);
        const buffer = await StorageService.download(storageKey);
        console.log(`[IMAGE] Downloaded ${buffer.byteLength} bytes`);

        // Write buffer to a temp file — system tesseract CLI takes a file path, not a buffer
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "img-ocr-"));
        const imgPath = path.join(tempDir, "image.png");

        let text = "";
        try {
            fs.writeFileSync(imgPath, buffer);

            console.log(`[IMAGE] Running system Tesseract CLI on: ${imgPath}`);
            // Args: <input> stdout -l eng
            const result = await runCommand("tesseract", [imgPath, "stdout", "-l", "eng"]);
            text = result.stdout.trim();
            console.log(`[IMAGE] OCR complete, extracted ${text.length} chars`);
        } catch (err) {
            console.error(`[IMAGE] ✗ Tesseract OCR failed:`, (err as Error).message);
            // Continue with empty text rather than crashing the pipeline
        } finally {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch {}
        }

        const normalizedTextKey = `cases/${caseId}/normalized/${evidenceId}.txt`;
        console.log(`[IMAGE] Uploading normalized text to: ${normalizedTextKey}`);
        await StorageService.upload(normalizedTextKey, Buffer.from(text), "text/plain");
        console.log(`[IMAGE] Normalized text uploaded successfully`);

        console.log(`[IMAGE] ✓ DONE evidenceId=${evidenceId}`);
        return { evidenceId, caseId, normalizedTextKey };
    }
}