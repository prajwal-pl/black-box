import { defineConfig } from "@trigger.dev/sdk/v3";
import { aptGet } from "@trigger.dev/build/extensions/core";

export default defineConfig({
    project: process.env.TRIGGER_PROJECT_ID ?? "blackbox",
    dirs: ["./trigger"],
    maxDuration: 3600,
    build: {
        extensions: [
            // poppler-utils provides the pdftoppm binary used for PDF-to-image conversion in OCR
            aptGet({ packages: ["poppler-utils"] }),
        ],
    },
});
