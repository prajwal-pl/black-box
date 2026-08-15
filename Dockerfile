FROM oven/bun:1.2-alpine

# Install system-level native dependencies used by backend packages:
#   poppler-utils  → pdf-poppler (PDF → image conversion)
#   tesseract-ocr  → tesseract.js (OCR)
#   cairo/pango    → canvas (image rendering)
RUN apk add --no-cache \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    python3 \
    make \
    g++

WORKDIR /app

# Copy only backend package files first for better layer caching
COPY backend/package.json backend/bun.lock ./

RUN bun install --frozen-lockfile

# Generate Prisma client
COPY backend/prisma ./prisma/
RUN bun --bun run prisma generate

# Copy the rest of the backend source
COPY backend/ .

# Workers-only container — no HTTP port needed
# Runs all 4 BullMQ workers (ingestion, processing, reasoning, graph)
# in a single persistent Bun process
CMD ["bun", "run", "workers/all-workers.ts"]
