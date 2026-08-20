/**
 * Integration tests using real PDF fixture files.
 *
 * Test files: tests/processors/files/
 *   - "Black Dahlia -E Short- Part 1 of 2.pdf"  (162 pages, 9.1 MB, scanned FBI document)
 *   - "Black Dahlia -E Short- Part 2 of 2.pdf"  (49 pages, 5.7 MB, scanned FBI document)
 *
 * These are the exact files that were failing in production.
 *
 * Run: bun test tests/processors/integration.test.ts
 *
 * NOTE: tesseract-dependent tests are skipped automatically when tesseract
 * is not installed locally (it is installed in the Trigger.dev container via aptGet).
 * Run `sudo apt-get install -y tesseract-ocr tesseract-ocr-eng` to enable OCR tests.
 */

import { describe, it, expect, beforeAll } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync, spawnSync } from "child_process";

// ── Paths ─────────────────────────────────────────────────────────────────────

const FILES_DIR = path.join(__dirname, "files");
const PDF_PART1 = path.join(FILES_DIR, "Black Dahlia -E Short- Part 1 of 2.pdf");
const PDF_PART2 = path.join(FILES_DIR, "Black Dahlia -E Short- Part 2 of 2.pdf");

// ── Binary detection ──────────────────────────────────────────────────────────

const BINARY_PATHS = ["/usr/bin", "/usr/local/bin", "/opt/homebrew/bin"];

function findBinary(name: string): string | null {
    for (const dir of BINARY_PATHS) {
        const p = path.join(dir, name);
        try {
            fs.accessSync(p, fs.constants.X_OK);
            return p;
        } catch {}
    }
    try {
        const r = spawnSync("which", [name], { encoding: "utf-8" });
        if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
    } catch {}
    return null;
}

const PDFTOTEXT_BIN = findBinary("pdftotext");
const PDFTOPPM_BIN = findBinary("pdftoppm");
const PDFINFO_BIN = findBinary("pdfinfo");
const TESSERACT_BIN = findBinary("tesseract");

// ── Logging helper ────────────────────────────────────────────────────────────

function log(label: string, msg: string) {
    console.log(`  [${label}] ${msg}`);
}

// ── Pre-flight: log environment ───────────────────────────────────────────────

beforeAll(() => {
    console.log("\n=== Integration test environment ===");
    console.log(`  pdftotext : ${PDFTOTEXT_BIN ?? "NOT FOUND"}`);
    console.log(`  pdftoppm  : ${PDFTOPPM_BIN ?? "NOT FOUND"}`);
    console.log(`  pdfinfo   : ${PDFINFO_BIN ?? "NOT FOUND"}`);
    console.log(`  tesseract : ${TESSERACT_BIN ?? "NOT FOUND (OCR tests will be skipped)"}`);
    console.log(`  Part 1 PDF: ${fs.existsSync(PDF_PART1) ? `${(fs.statSync(PDF_PART1).size / 1_048_576).toFixed(1)} MB` : "MISSING"}`);
    console.log(`  Part 2 PDF: ${fs.existsSync(PDF_PART2) ? `${(fs.statSync(PDF_PART2).size / 1_048_576).toFixed(1)} MB` : "MISSING"}`);
    console.log("=====================================\n");
});

// ── Fixture file checks ───────────────────────────────────────────────────────

describe("Test fixture files", () => {
    it("Part 1 PDF exists and has expected size (~9.1 MB)", () => {
        expect(fs.existsSync(PDF_PART1)).toBe(true);
        const size = fs.statSync(PDF_PART1).size;
        log("FIXTURE", `Part 1 size: ${(size / 1_048_576).toFixed(2)} MB`);
        expect(size).toBeGreaterThan(9_000_000);
        expect(size).toBeLessThan(12_000_000);
    });

    it("Part 2 PDF exists and has expected size (~5.7 MB)", () => {
        expect(fs.existsSync(PDF_PART2)).toBe(true);
        const size = fs.statSync(PDF_PART2).size;
        log("FIXTURE", `Part 2 size: ${(size / 1_048_576).toFixed(2)} MB`);
        expect(size).toBeGreaterThan(5_000_000);
        expect(size).toBeLessThan(8_000_000);
    });

    it("PDF files are valid (not corrupt)", () => {
        const part1Bytes = fs.readFileSync(PDF_PART1);
        const part2Bytes = fs.readFileSync(PDF_PART2);
        // PDFs start with %PDF-
        expect(part1Bytes.slice(0, 5).toString()).toBe("%PDF-");
        expect(part2Bytes.slice(0, 5).toString()).toBe("%PDF-");
        log("FIXTURE", "Both PDFs have valid %PDF- header");
    });
});

// ── pdfinfo: page count extraction ───────────────────────────────────────────

describe("pdfinfo — page count extraction", () => {
    it.skipIf(!PDFINFO_BIN)("Part 1: reports 162 pages", () => {
        const result = spawnSync(PDFINFO_BIN!, [PDF_PART1], { encoding: "utf-8" });
        expect(result.status).toBe(0);
        log("PDFINFO", result.stdout.trim().substring(0, 200));
        const match = result.stdout.match(/Pages:\s+(\d+)/);
        expect(match).not.toBeNull();
        const pages = parseInt(match![1]!, 10);
        log("PDFINFO", `Part 1 pages: ${pages}`);
        expect(pages).toBe(162);
    });

    it.skipIf(!PDFINFO_BIN)("Part 2: reports 49 pages", () => {
        const result = spawnSync(PDFINFO_BIN!, [PDF_PART2], { encoding: "utf-8" });
        expect(result.status).toBe(0);
        const match = result.stdout.match(/Pages:\s+(\d+)/);
        expect(match).not.toBeNull();
        const pages = parseInt(match![1]!, 10);
        log("PDFINFO", `Part 2 pages: ${pages}`);
        expect(pages).toBe(49);
    });
});

// ── pdftotext: scanned PDF returns empty text ─────────────────────────────────

describe("pdftotext — scanned PDF behavior", () => {
    it.skipIf(!PDFTOTEXT_BIN)("Part 1: returns only whitespace (confirms scanned-only PDF)", () => {
        const result = spawnSync(PDFTOTEXT_BIN!, ["-layout", "-enc", "UTF-8", PDF_PART1, "-"], { encoding: "utf-8" });
        expect(result.status).toBe(0);
        const text = result.stdout.trim();
        log("PDFTOTEXT", `Part 1 extracted chars: ${result.stdout.length} (meaningful: ${text.length})`);
        // Scanned PDFs return only form-feed characters (\f) — no real text
        expect(text.length).toBe(0);
    });

    it.skipIf(!PDFTOTEXT_BIN)("Part 2: returns only whitespace (confirms scanned-only PDF)", () => {
        const result = spawnSync(PDFTOTEXT_BIN!, ["-layout", "-enc", "UTF-8", PDF_PART2, "-"], { encoding: "utf-8" });
        expect(result.status).toBe(0);
        const text = result.stdout.trim();
        log("PDFTOTEXT", `Part 2 extracted chars: ${result.stdout.length} (meaningful: ${text.length})`);
        expect(text.length).toBe(0);
    });
});

// ── pdftoppm: PDF → PNG conversion ───────────────────────────────────────────

describe("pdftoppm — PDF to image conversion", () => {
    it.skipIf(!PDFTOPPM_BIN)("converts first 3 pages of Part 1 to PNG successfully", () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "integ-test-"));
        try {
            const result = spawnSync(
                PDFTOPPM_BIN!,
                ["-png", "-r", "72", "-f", "1", "-l", "3", PDF_PART1, path.join(tempDir, "page")],
                { encoding: "utf-8" },
            );
            expect(result.status).toBe(0);

            const pages = fs.readdirSync(tempDir).filter((f) => f.endsWith(".png"));
            log("PDFTOPPM", `Generated ${pages.length} PNG files: ${pages.join(", ")}`);
            expect(pages.length).toBe(3);

            // Each page PNG should be >1KB (real image data)
            for (const p of pages) {
                const size = fs.statSync(path.join(tempDir, p)).size;
                log("PDFTOPPM", `  ${p}: ${(size / 1024).toFixed(1)} KB`);
                expect(size).toBeGreaterThan(1024);
            }
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it.skipIf(!PDFTOPPM_BIN)("converts first 2 pages of Part 2 to PNG successfully", () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "integ-test-"));
        try {
            const result = spawnSync(
                PDFTOPPM_BIN!,
                ["-png", "-r", "72", "-f", "1", "-l", "2", PDF_PART2, path.join(tempDir, "page")],
                { encoding: "utf-8" },
            );
            expect(result.status).toBe(0);

            const pages = fs.readdirSync(tempDir).filter((f) => f.endsWith(".png"));
            log("PDFTOPPM", `Generated ${pages.length} PNG files from Part 2`);
            expect(pages.length).toBe(2);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});

// ── tesseract OCR: real OCR on real scanned pages ────────────────────────────

describe("tesseract OCR — real scanned pages", () => {
    it.skipIf(!TESSERACT_BIN || !PDFTOPPM_BIN)(
        "OCRs page 1 of Part 1 — should contain FBI case text",
        async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ocr-integ-"));
            try {
                // Convert page 1 to PNG at 144 DPI (same settings as production)
                const convert = spawnSync(
                    PDFTOPPM_BIN!,
                    ["-png", "-r", "144", "-f", "1", "-l", "1", PDF_PART1, path.join(tempDir, "page")],
                    { encoding: "utf-8" },
                );
                expect(convert.status).toBe(0);

                const pngFiles = fs.readdirSync(tempDir).filter((f) => f.endsWith(".png"));
                expect(pngFiles.length).toBe(1);
                const pngPath = path.join(tempDir, pngFiles[0]!);

                log("OCR", `Running tesseract on ${pngFiles[0]} (${(fs.statSync(pngPath).size / 1024).toFixed(0)} KB)`);
                const start = Date.now();

                const ocr = spawnSync(
                    TESSERACT_BIN!,
                    [pngPath, "stdout", "-l", "eng", "--oem", "1", "--psm", "3"],
                    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
                );

                const elapsed = Date.now() - start;
                const text = ocr.stdout.trim();
                log("OCR", `Completed in ${elapsed}ms, extracted ${text.length} chars`);
                log("OCR", `Exit code: ${ocr.status}`);
                if (text.length > 0) {
                    log("OCR", `First 500 chars:\n${text.substring(0, 500)}`);
                } else {
                    log("OCR", `WARNING: No text extracted. stderr: ${ocr.stderr?.substring(0, 200)}`);
                }

                // FBI documents will have some recognizable text
                expect(ocr.status).toBe(0);
                expect(text.length).toBeGreaterThan(0);
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        },
    );

    it.skipIf(!TESSERACT_BIN || !PDFTOPPM_BIN)(
        "OCRs first 5 pages of Part 2 — measures throughput",
        async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ocr-integ-"));
            try {
                const convert = spawnSync(
                    PDFTOPPM_BIN!,
                    ["-png", "-r", "144", "-f", "1", "-l", "5", PDF_PART2, path.join(tempDir, "page")],
                    { encoding: "utf-8" },
                );
                expect(convert.status).toBe(0);

                const pngFiles = fs.readdirSync(tempDir)
                    .filter((f) => f.endsWith(".png"))
                    .sort();

                log("OCR", `Processing ${pngFiles.length} pages from Part 2`);
                let totalChars = 0;
                let successPages = 0;

                for (const [i, fileName] of pngFiles.entries()) {
                    const pngPath = path.join(tempDir, fileName);
                    const pageStart = Date.now();

                    const ocr = spawnSync(
                        TESSERACT_BIN!,
                        [pngPath, "stdout", "-l", "eng", "--oem", "1", "--psm", "3"],
                        { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
                    );

                    const elapsed = Date.now() - pageStart;
                    const text = ocr.stdout.trim();
                    totalChars += text.length;
                    if (ocr.status === 0) successPages++;

                    log("OCR", `  Page ${i + 1}/5: ${elapsed}ms → ${text.length} chars (exit: ${ocr.status})`);
                    if (text.length > 0) {
                        log("OCR", `    Sample: "${text.substring(0, 100).replace(/\n/g, " ")}"`);
                    }
                }

                log("OCR", `Total: ${successPages}/${pngFiles.length} pages succeeded, ${totalChars} total chars`);
                expect(successPages).toBeGreaterThan(0);
                expect(totalChars).toBeGreaterThan(0);
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        },
    );
});

// ── PdfProcessor: full pipeline integration ───────────────────────────────────

describe("PdfProcessor — full pipeline with real PDFs", () => {
    it.skipIf(!PDFTOTEXT_BIN)("Part 1: detects scanned-only PDF (pdftotext returns empty)", async () => {
        // Mock only StorageService — use real file system binaries
        const { PdfProcessor } = await import("../../queues/processors/processing/pdf.processor");
        const StorageService = await import("../../services/storage.service");
        const { spyOn } = await import("bun:test");

        const pdfBuffer = fs.readFileSync(PDF_PART1);
        log("PROCESSOR", `Part 1 buffer: ${(pdfBuffer.byteLength / 1_048_576).toFixed(2)} MB`);

        let uploadedKey = "";
        let uploadedContent = "";

        const downloadSpy = spyOn(StorageService.StorageService, "download").mockResolvedValue(pdfBuffer);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uploadSpy = spyOn(StorageService.StorageService, "upload").mockImplementation((async (key: string, content: Buffer) => {
            uploadedKey = key;
            uploadedContent = content.toString("utf-8");
            log("PROCESSOR", `Uploaded to: ${key} (${content.byteLength} bytes)`);
            return "";
        }) as any);

        const start = Date.now();
        const result = await PdfProcessor.handle({
            evidenceId: "integ-ev-1",
            caseId: "integ-case",
            storageKey: "test/part1.pdf",
            evidenceType: "pdf",
            processorVersion: "1.0.0",
        });
        const elapsed = Date.now() - start;

        log("PROCESSOR", `Completed in ${elapsed}ms`);
        log("PROCESSOR", `normalizedTextKey: ${result.normalizedTextKey}`);
        log("PROCESSOR", `pageCount: ${result.pageCount}`);
        log("PROCESSOR", `uploadedContent length: ${uploadedContent.length}`);

        expect(result.evidenceId).toBe("integ-ev-1");
        expect(result.normalizedTextKey).toBe("cases/integ-case/normalized/integ-ev-1.txt");
        expect(uploadedKey).toBe("cases/integ-case/normalized/integ-ev-1.txt");

        // For scanned PDFs: pdftotext returns empty → OCR fallback needed
        // Without tesseract locally, we get empty content (correct behavior — logs warn about redeploy)
        if (!TESSERACT_BIN) {
            log("PROCESSOR", "⚠ tesseract not installed locally — OCR skipped, empty content expected");
            expect(uploadedContent).toBe("");
        }

        downloadSpy.mockRestore();
        uploadSpy.mockRestore();
    });

    it.skipIf(!PDFTOTEXT_BIN || !PDFTOPPM_BIN || !TESSERACT_BIN)(
        "Part 1: full OCR pipeline — extracts real text from 162 scanned pages",
        async () => {
            const { PdfProcessor } = await import("../../queues/processors/processing/pdf.processor");
            const StorageService = await import("../../services/storage.service");
            const { spyOn } = await import("bun:test");

            const pdfBuffer = fs.readFileSync(PDF_PART1);
            log("PIPELINE", `Starting full OCR pipeline on ${(pdfBuffer.byteLength / 1_048_576).toFixed(2)} MB PDF (162 pages)`);
            log("PIPELINE", "This test may take several minutes — that is expected for 162-page OCR");

            let uploadedContent = "";
            spyOn(StorageService.StorageService, "download").mockResolvedValue(pdfBuffer);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(StorageService.StorageService, "upload").mockImplementation((async (_key: string, content: Buffer) => {
                uploadedContent = content.toString("utf-8");
                return "";
            }) as any);

            const start = Date.now();
            const result = await PdfProcessor.handle({
                evidenceId: "integ-full-1",
                caseId: "integ-case",
                storageKey: "test/part1.pdf",
                evidenceType: "pdf",
                processorVersion: "1.0.0",
            });
            const elapsed = Date.now() - start;

            log("PIPELINE", `Completed in ${(elapsed / 1000).toFixed(1)}s`);
            log("PIPELINE", `pageCount: ${result.pageCount}`);
            log("PIPELINE", `Total chars extracted: ${uploadedContent.length}`);
            if (uploadedContent.length > 0) {
                log("PIPELINE", `First 500 chars of extracted text:\n${uploadedContent.substring(0, 500)}`);
                log("PIPELINE", `Last 200 chars:\n${uploadedContent.slice(-200)}`);
            }

            expect(result.evidenceId).toBe("integ-full-1");
            expect(result.pageCount).toBeGreaterThan(0);
            expect(uploadedContent.length).toBeGreaterThan(0);
        },
        // 15-minute timeout for 162-page OCR with real tesseract
        15 * 60 * 1000,
    );

    it.skipIf(!PDFTOTEXT_BIN || !PDFTOPPM_BIN || !TESSERACT_BIN)(
        "Part 2: full OCR pipeline — extracts real text from 49 scanned pages",
        async () => {
            const { PdfProcessor } = await import("../../queues/processors/processing/pdf.processor");
            const StorageService = await import("../../services/storage.service");
            const { spyOn } = await import("bun:test");

            const pdfBuffer = fs.readFileSync(PDF_PART2);
            log("PIPELINE", `Starting full OCR pipeline on Part 2 (${(pdfBuffer.byteLength / 1_048_576).toFixed(2)} MB, 49 pages)`);

            let uploadedContent = "";
            spyOn(StorageService.StorageService, "download").mockResolvedValue(pdfBuffer);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spyOn(StorageService.StorageService, "upload").mockImplementation((async (_key: string, content: Buffer) => {
                uploadedContent = content.toString("utf-8");
                return "";
            }) as any);

            const start = Date.now();
            const result = await PdfProcessor.handle({
                evidenceId: "integ-full-2",
                caseId: "integ-case",
                storageKey: "test/part2.pdf",
                evidenceType: "pdf",
                processorVersion: "1.0.0",
            });
            const elapsed = Date.now() - start;

            log("PIPELINE", `Completed in ${(elapsed / 1000).toFixed(1)}s`);
            log("PIPELINE", `pageCount: ${result.pageCount}`);
            log("PIPELINE", `Total chars extracted: ${uploadedContent.length}`);
            if (uploadedContent.length > 0) {
                log("PIPELINE", `Sample text (first 500 chars):\n${uploadedContent.substring(0, 500)}`);
            }

            expect(result.evidenceId).toBe("integ-full-2");
            expect(result.pageCount).toBeGreaterThan(0);
            expect(uploadedContent.length).toBeGreaterThan(0);
        },
        5 * 60 * 1000,
    );
});

// ── Binary diagnostics summary ────────────────────────────────────────────────

describe("System binary diagnostics", () => {
    it("logs all installed binary versions for CI visibility", () => {
        console.log("\n=== Binary version details ===");

        if (PDFTOTEXT_BIN) {
            try {
                const r = spawnSync(PDFTOTEXT_BIN, ["-v"], { encoding: "utf-8" });
                console.log(`  pdftotext: ${(r.stderr || r.stdout).split("\n")[0]?.trim()}`);
            } catch {}
        }

        if (PDFTOPPM_BIN) {
            try {
                const r = spawnSync(PDFTOPPM_BIN, ["-v"], { encoding: "utf-8" });
                console.log(`  pdftoppm: ${(r.stderr || r.stdout).split("\n")[0]?.trim()}`);
            } catch {}
        }

        if (TESSERACT_BIN) {
            try {
                const r = spawnSync(TESSERACT_BIN, ["--version"], { encoding: "utf-8" });
                console.log(`  tesseract: ${(r.stdout || r.stderr).split("\n")[0]?.trim()}`);
            } catch {}
        }

        console.log("==============================\n");
        expect(PDFTOTEXT_BIN).not.toBeNull(); // pdftotext must always be available
        expect(PDFTOPPM_BIN).not.toBeNull();  // pdftoppm must always be available
    });

    it("poppler-utils binaries are on PATH used by child_process.spawn", () => {
        // Simulate the exact PATH we use in production subprocess calls
        const prodEnv = {
            ...process.env,
            PATH: `/usr/bin:/usr/local/bin:/bin:/usr/sbin:/sbin:${process.env.PATH ?? ""}`,
        };
        const result = spawnSync("which", ["pdftotext"], { encoding: "utf-8", env: prodEnv });
        log("PATH", `pdftotext location: ${result.stdout.trim()}`);
        expect(result.status).toBe(0);
        expect(result.stdout.trim()).toContain("pdftotext");
    });

    it("pdfinfo correctly parses both fixture PDFs", () => {
        if (!PDFINFO_BIN) {
            console.log("  pdfinfo not found — skipping");
            return;
        }
        for (const [label, pdf, expectedPages] of [
            ["Part 1", PDF_PART1, 162],
            ["Part 2", PDF_PART2, 49],
        ] as const) {
            const r = spawnSync(PDFINFO_BIN, [pdf], { encoding: "utf-8" });
            const match = r.stdout.match(/Pages:\s+(\d+)/);
            const pages = match ? parseInt(match[1]!, 10) : 0;
            log("PDFINFO", `${label}: ${pages} pages (expected ${expectedPages})`);
            expect(pages).toBe(expectedPages);
        }
    });
});
