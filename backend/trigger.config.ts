import "dotenv/config";

import { defineConfig } from "@trigger.dev/sdk";
import { aptGet } from "@trigger.dev/build/extensions/core";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
    project: process.env.TRIGGER_PROJECT_ID!,
    dirs: ["./trigger"],
    maxDuration: 3600,
    build: {
        extensions: [
            // ── Prisma ────────────────────────────────────────────────────────────
            // Required: Trigger.dev bundles tasks with esbuild. Without this extension,
            // the Prisma client's Wasm query engine and generated schema are not
            // included in the bundle → "Invalid prisma.*.() invocation" at runtime.
            // schema path is relative to trigger.config.ts (i.e. backend/)
            // Prisma 7 uses `provider = "prisma-client"` (Wasm client) → mode: "modern"
            prismaExtension({
                mode: "modern",
            }),

            // ── System binaries (for PDF OCR pipeline) ────────────────────────────
            // aptGet only applies to `trigger:deploy` (production cloud containers).
            // For `trigger:dev` (local), install these manually:
            //   sudo apt-get install -y poppler-utils tesseract-ocr tesseract-ocr-eng
            aptGet({
                packages: [
                    // pdftoppm + pdftotext + pdfinfo — PDF processing
                    "poppler-utils",
                    // Tesseract OCR for scanned PDFs (system binary, avoids WASM Worker issues)
                    "tesseract-ocr",
                    "tesseract-ocr-eng",
                ],
            }),
        ],
    },
});
