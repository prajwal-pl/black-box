#!/usr/bin/env bun
// Standalone OCR worker - runs in separate process so Tesseract WASM crashes don't kill main worker

import Tesseract from "tesseract.js";
import * as fs from "fs";
import * as path from "path";

const TESSERACT_LANG_PATH = process.env.TESSERACT_LANG_PATH || "";

async function ocrImage(pngPath: string): Promise<string> {
    try {
        const { data: { text } } = await Tesseract.recognize(pngPath, "eng", {
            langPath: TESSERACT_LANG_PATH,
        });
        return text.trim();
    } catch (err) {
        throw new Error(`OCR failed: ${(err as Error).message}`);
    }
}

async function main() {
    const pngPath = process.argv[2];
    if (!pngPath) {
        console.error("Usage: ocr-worker.ts <png-path>");
        process.exit(1);
    }

    try {
        const text = await ocrImage(pngPath);
        // Output only the text to stdout (for parsing)
        console.log(text);
        process.exit(0);
    } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
    }
}

main();