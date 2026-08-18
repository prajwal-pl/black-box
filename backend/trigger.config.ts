import "dotenv/config";

import { defineConfig } from "@trigger.dev/sdk";
import { aptGet } from "@trigger.dev/build/extensions/core";

export default defineConfig({
    project: process.env.TRIGGER_PROJECT_ID!,
    dirs: ["./trigger"],
    maxDuration: 3600,
    build: {
        extensions: [
            aptGet({
                packages: [
                    // pdftoppm: PDF → PNG image conversion for OCR pipeline
                    "poppler-utils",
                    // System Tesseract OCR binary (used instead of tesseract.js to
                    // avoid WASM Worker thread path issues in Trigger.dev's build env)
                    "tesseract-ocr",
                    "tesseract-ocr-eng",
                ],
            }),
        ],
    },
});
