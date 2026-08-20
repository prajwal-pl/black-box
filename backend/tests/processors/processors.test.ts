/**
 * Processor unit tests — bun:test (no extra packages needed).
 * Run: bun test tests/processors/processors.test.ts
 *
 * Strategy:
 *  - Mock StorageService to avoid real S3 calls
 *  - Mock child_process.spawn / execFileSync to simulate system binaries
 *  - Test all processors: PDF, Image, Text, Email, Spreadsheet, Ingestion
 *
 * NOTE: PdfProcessor now uses pdftotext + pdftoppm + tesseract (system CLIs).
 * pdf-parse was removed because pdfjs-dist uses Worker threads that break in
 * Trigger.dev's bundled environment.
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { EventEmitter } from "events";

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Typed upload mock factory — upload() returns Promise<string> */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeUploadMock(capture: { key?: string; content?: string }) {
    return (async (key: string, content: Buffer) => {
        capture.key = key;
        capture.content = content.toString("utf-8");
        return "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
}

/** Create a fake child_process that simulates spawn(). */
function makeFakeProcess(options: {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    error?: Error;
}): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => void } {
    const proc = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: () => void;
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = () => {};

    setImmediate(() => {
        if (options.error) {
            proc.emit("error", options.error);
            return;
        }
        if (options.stdout) proc.stdout.emit("data", Buffer.from(options.stdout));
        if (options.stderr) proc.stderr.emit("data", Buffer.from(options.stderr));
        proc.emit("close", options.exitCode ?? 0);
    });

    return proc;
}

// ── PdfProcessor ──────────────────────────────────────────────────────────────

describe("PdfProcessor", () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-test-"));
    });

    afterEach(() => {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    });

    it("extracts text via pdftotext when quality is sufficient", async () => {
        const { PdfProcessor } = await import("../../queues/processors/processing/pdf.processor");
        const StorageService = await import("../../services/storage.service");
        const childProc = await import("child_process");

        const longText = "This is a long text document. ".repeat(100); // >2000 chars, meaningful
        const captured: { key?: string; content?: string } = {};

        spyOn(StorageService.StorageService, "download").mockResolvedValue(Buffer.from("fake-pdf-bytes"));
        spyOn(StorageService.StorageService, "upload").mockImplementation(makeUploadMock(captured));

        // execFileSync for binary resolution succeeds (pdftotext available)
        spyOn(childProc, "execFileSync").mockReturnValue(Buffer.from(""));

        // pdftotext spawns and returns longText; pdfinfo returns page count
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(childProc, "spawn").mockImplementation(((cmd: string) => {
            if (cmd.includes("pdftotext") || cmd === "/usr/bin/pdftotext") {
                return makeFakeProcess({ stdout: longText });
            }
            if (cmd.includes("pdfinfo") || cmd === "/usr/bin/pdfinfo") {
                return makeFakeProcess({ stdout: "Pages: 12" });
            }
            // pdftoppm — shouldn't be called but handle gracefully
            return makeFakeProcess({ exitCode: 0 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any);

        const result = await PdfProcessor.handle({
            evidenceId: "ev-1",
            caseId: "case-1",
            storageKey: "cases/case-1/evidence/ev-1.pdf",
            evidenceType: "pdf",
            processorVersion: "1.0.0",
        });

        expect(result.evidenceId).toBe("ev-1");
        expect(result.caseId).toBe("case-1");
        expect(result.normalizedTextKey).toBe("cases/case-1/normalized/ev-1.txt");
        expect(result.pageCount).toBe(12);
        expect(captured.content?.length ?? 0).toBeGreaterThan(2000);
        expect(captured.key).toBe("cases/case-1/normalized/ev-1.txt");
    });

    it("falls back to tesseract OCR when pdftotext returns empty", async () => {
        const { PdfProcessor } = await import("../../queues/processors/processing/pdf.processor");
        const StorageService = await import("../../services/storage.service");
        const childProc = await import("child_process");

        const captured: { content?: string } = {};

        spyOn(StorageService.StorageService, "download").mockResolvedValue(Buffer.from("fake-scanned-pdf"));
        spyOn(StorageService.StorageService, "upload").mockImplementation(makeUploadMock(captured));
        spyOn(childProc, "execFileSync").mockReturnValue(Buffer.from(""));

        // pdftotext returns empty (scanned PDF), pdftoppm produces 2 pages,
        // tesseract returns OCR text for each
        let pageImages: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(childProc, "spawn").mockImplementation(((cmd: string, args: string[]) => {
            if (cmd.includes("pdftotext")) {
                return makeFakeProcess({ stdout: "" }); // empty — triggers OCR fallback
            }
            if (cmd.includes("pdfinfo")) {
                return makeFakeProcess({ stdout: "Pages: 2" });
            }
            if (cmd.includes("pdftoppm")) {
                // Create fake page PNG files in the temp dir so the processor can iterate
                const outPrefix = args[args.length - 1] ?? "";
                const dir = path.dirname(outPrefix);
                const base = path.basename(outPrefix);
                // Write two fake page images
                for (const n of ["01", "02"]) {
                    const f = path.join(dir, `${base}-${n}.png`);
                    fs.writeFileSync(f, "fake-png");
                    pageImages.push(f);
                }
                return makeFakeProcess({ exitCode: 0 });
            }
            if (cmd.includes("tesseract")) {
                return makeFakeProcess({ stdout: "OCR text from page" });
            }
            return makeFakeProcess({ exitCode: 0 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any);

        const result = await PdfProcessor.handle({
            evidenceId: "ev-2",
            caseId: "case-1",
            storageKey: "key",
            evidenceType: "pdf",
            processorVersion: "1.0.0",
        });

        expect(result.evidenceId).toBe("ev-2");
        // OCR text from both pages should be in the output
        expect(captured.content).toContain("OCR text from page");
    });

    it("uploads empty text when all extraction fails, does not throw", async () => {
        const { PdfProcessor } = await import("../../queues/processors/processing/pdf.processor");
        const StorageService = await import("../../services/storage.service");
        const childProc = await import("child_process");

        const captured: { content?: string } = {};

        spyOn(StorageService.StorageService, "download").mockResolvedValue(Buffer.from("tiny"));
        spyOn(StorageService.StorageService, "upload").mockImplementation(makeUploadMock(captured));

        // All binaries fail
        spyOn(childProc, "execFileSync").mockImplementation(() => { throw new Error("ENOENT"); });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(childProc, "spawn").mockImplementation((() =>
            makeFakeProcess({ error: new Error("ENOENT") })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any);

        // Should NOT throw — processor is resilient
        const result = await PdfProcessor.handle({
            evidenceId: "ev-3",
            caseId: "case-1",
            storageKey: "key",
            evidenceType: "pdf",
            processorVersion: "1.0.0",
        });

        expect(result.evidenceId).toBe("ev-3");
        expect(captured.content).toBe(""); // empty but uploaded
    });
});

// ── IngestionProcessor ────────────────────────────────────────────────────────

describe("IngestionProcessor", () => {
    describe("classifyByMimeType", () => {
        it("classifies PDF correctly", async () => {
            const { classifyByMimeType } = await import("../../queues/processors/ingestion.processor");
            expect(classifyByMimeType("application/pdf")).toBe("pdf");
        });

        it("classifies PNG as image", async () => {
            const { classifyByMimeType } = await import("../../queues/processors/ingestion.processor");
            expect(classifyByMimeType("image/png")).toBe("image");
        });

        it("classifies JPEG as image", async () => {
            const { classifyByMimeType } = await import("../../queues/processors/ingestion.processor");
            expect(classifyByMimeType("image/jpeg")).toBe("image");
        });

        it("classifies text/plain as text", async () => {
            const { classifyByMimeType } = await import("../../queues/processors/ingestion.processor");
            expect(classifyByMimeType("text/plain")).toBe("text");
        });

        it("classifies text/csv as text", async () => {
            const { classifyByMimeType } = await import("../../queues/processors/ingestion.processor");
            expect(classifyByMimeType("text/csv")).toBe("text");
        });

        it("classifies XLSX as spreadsheet", async () => {
            const { classifyByMimeType } = await import("../../queues/processors/ingestion.processor");
            expect(
                classifyByMimeType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            ).toBe("spreadsheet");
        });

        it("classifies XLS as spreadsheet", async () => {
            const { classifyByMimeType } = await import("../../queues/processors/ingestion.processor");
            expect(classifyByMimeType("application/vnd.ms-excel")).toBe("spreadsheet");
        });

        it("classifies message/rfc822 as email", async () => {
            const { classifyByMimeType } = await import("../../queues/processors/ingestion.processor");
            expect(classifyByMimeType("message/rfc822")).toBe("email");
        });

        it("classifies video/mp4 as video", async () => {
            const { classifyByMimeType } = await import("../../queues/processors/ingestion.processor");
            expect(classifyByMimeType("video/mp4")).toBe("video");
        });

        it("classifies audio/mpeg as audio", async () => {
            const { classifyByMimeType } = await import("../../queues/processors/ingestion.processor");
            expect(classifyByMimeType("audio/mpeg")).toBe("audio");
        });

        it("classifies unknown MIME as unknown", async () => {
            const { classifyByMimeType } = await import("../../queues/processors/ingestion.processor");
            expect(classifyByMimeType("application/octet-stream")).toBe("unknown");
        });
    });
});

// ── TextProcessor ─────────────────────────────────────────────────────────────

describe("TextProcessor", () => {
    it("downloads buffer, decodes as UTF-8, uploads to normalized key", async () => {
        const { TextProcessor } = await import("../../queues/processors/processing/text.processor");
        const StorageService = await import("../../services/storage.service");

        const sampleText = "This is test evidence content.\nWith multiple lines.\n";
        const captured: { key?: string; content?: string } = {};

        spyOn(StorageService.StorageService, "download").mockResolvedValue(Buffer.from(sampleText, "utf-8"));
        spyOn(StorageService.StorageService, "upload").mockImplementation(makeUploadMock(captured));

        const result = await TextProcessor.handle({
            evidenceId: "ev-text-1",
            caseId: "case-1",
            storageKey: "cases/case-1/evidence/ev-text-1.txt",
            evidenceType: "text",
            processorVersion: "1.0.0",
        });

        expect(result.evidenceId).toBe("ev-text-1");
        expect(result.normalizedTextKey).toBe("cases/case-1/normalized/ev-text-1.txt");
        expect(captured.key).toBe("cases/case-1/normalized/ev-text-1.txt");
        expect(captured.content).toBe(sampleText);
    });
});

// ── EmailProcessor ────────────────────────────────────────────────────────────

describe("EmailProcessor", () => {
    it("parses RFC-2822 email and extracts headers + body", async () => {
        const { EmailProcessor } = await import("../../queues/processors/processing/email.processor");
        const StorageService = await import("../../services/storage.service");

        const rawEmail = [
            "From: alice@example.com",
            "To: bob@example.com",
            "Subject: Test Evidence Email",
            "Date: Mon, 19 Aug 2026 10:00:00 +0000",
            "",
            "This is the body of the email.",
            "It has multiple lines.",
        ].join("\n");

        const captured: { content?: string } = {};
        spyOn(StorageService.StorageService, "download").mockResolvedValue(Buffer.from(rawEmail, "utf-8"));
        spyOn(StorageService.StorageService, "upload").mockImplementation(makeUploadMock(captured));

        const result = await EmailProcessor.handle({
            evidenceId: "ev-email-1",
            caseId: "case-1",
            storageKey: "cases/case-1/evidence/ev-email-1.eml",
            evidenceType: "email",
            processorVersion: "1.0.0",
        });

        expect(result.evidenceId).toBe("ev-email-1");
        expect(captured.content).toContain("From: alice@example.com");
        expect(captured.content).toContain("To: bob@example.com");
        expect(captured.content).toContain("Subject: Test Evidence Email");
        expect(captured.content).toContain("This is the body of the email.");
    });

    it("handles missing body gracefully", async () => {
        const { EmailProcessor } = await import("../../queues/processors/processing/email.processor");
        const StorageService = await import("../../services/storage.service");

        const rawEmail = "From: alice@example.com\nTo: bob@example.com\n";
        const captured: { content?: string } = {};
        spyOn(StorageService.StorageService, "download").mockResolvedValue(Buffer.from(rawEmail));
        spyOn(StorageService.StorageService, "upload").mockImplementation(makeUploadMock(captured));

        const result = await EmailProcessor.handle({
            evidenceId: "ev-email-2",
            caseId: "case-1",
            storageKey: "key",
            evidenceType: "email",
            processorVersion: "1.0.0",
        });

        expect(result.evidenceId).toBe("ev-email-2");
        expect(captured.content).toContain("From: alice@example.com");
    });
});

// ── SpreadsheetProcessor ──────────────────────────────────────────────────────

describe("SpreadsheetProcessor", () => {
    it("extracts rows from XLSX buffer as key:value lines", async () => {
        const XLSX = await import("xlsx");
        const { SpreadsheetProcessor } = await import("../../queues/processors/processing/spreadsheet.processor");
        const StorageService = await import("../../services/storage.service");

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ["Name", "Age", "City"],
            ["Alice", 30, "London"],
            ["Bob", 25, "Paris"],
        ]);
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        const captured: { content?: string } = {};
        spyOn(StorageService.StorageService, "download").mockResolvedValue(Buffer.from(xlsxBuffer));
        spyOn(StorageService.StorageService, "upload").mockImplementation(makeUploadMock(captured));

        const result = await SpreadsheetProcessor.handle({
            evidenceId: "ev-xlsx-1",
            caseId: "case-1",
            storageKey: "key",
            evidenceType: "spreadsheet",
            processorVersion: "1.0.0",
        });

        expect(result.evidenceId).toBe("ev-xlsx-1");
        expect(captured.content).toContain("Name: Alice");
        expect(captured.content).toContain("Age: 30");
        expect(captured.content).toContain("City: London");
        expect(captured.content).toContain("Name: Bob");
    });
});

// ── ImageProcessor ────────────────────────────────────────────────────────────

describe("ImageProcessor", () => {
    it("fails fast when tesseract binary is not available", async () => {
        const { ImageProcessor } = await import("../../queues/processors/processing/image.processor");
        const StorageService = await import("../../services/storage.service");
        const childProc = await import("child_process");

        spyOn(StorageService.StorageService, "download").mockResolvedValue(Buffer.from("fake-png-bytes"));

        spyOn(childProc, "execFileSync").mockImplementation(() => { throw new Error("ENOENT"); });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(childProc, "spawn").mockImplementation((() =>
            makeFakeProcess({ error: new Error("ENOENT: no such file") })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any);

        await expect(
            ImageProcessor.handle({
                evidenceId: "ev-img-1",
                caseId: "case-1",
                storageKey: "key",
                evidenceType: "image",
                processorVersion: "1.0.0",
            })
        ).rejects.toThrow(/tesseract binary not found/);
    });

    it("extracts text when tesseract is available", async () => {
        const { ImageProcessor } = await import("../../queues/processors/processing/image.processor");
        const StorageService = await import("../../services/storage.service");
        const childProc = await import("child_process");

        const captured: { content?: string } = {};
        spyOn(StorageService.StorageService, "download").mockResolvedValue(Buffer.from("fake-png-bytes"));
        spyOn(StorageService.StorageService, "upload").mockImplementation(makeUploadMock(captured));

        // Binary resolution: execFileSync for "which" succeeds
        spyOn(childProc, "execFileSync").mockReturnValue(Buffer.from("/usr/bin/tesseract\n"));

        // tesseract returns OCR text
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spyOn(childProc, "spawn").mockImplementation(((cmd: string) => {
            if (cmd.includes("tesseract")) {
                return makeFakeProcess({ stdout: "Extracted text from image." });
            }
            return makeFakeProcess({ exitCode: 0 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any);

        const result = await ImageProcessor.handle({
            evidenceId: "ev-img-2",
            caseId: "case-1",
            storageKey: "key",
            evidenceType: "image",
            processorVersion: "1.0.0",
        });

        expect(result.evidenceId).toBe("ev-img-2");
        expect(captured.content).toContain("Extracted text from image.");
    });
});

// ── Task payload types ────────────────────────────────────────────────────────

describe("Task payload types", () => {
    it("task-payloads module imports without error", async () => {
        const types = await import("../../types/task-payloads");
        expect(types).toBeDefined();
    });
});
