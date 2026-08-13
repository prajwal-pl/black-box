FROM oven/bun:1.2-alpine

# Install system dependencies needed by canvas, pdf-poppler, and tesseract
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
    g++ \
    nodejs \
    npm

# Install PM2 globally (uses Node/npm since PM2 is a Node tool)
RUN npm install -g pm2

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Generate Prisma client
COPY prisma ./prisma/
RUN bun --bun run prisma generate

# Copy the rest of the application
COPY . .

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

# pm2-runtime keeps the container alive and correctly forwards SIGTERM
CMD ["pm2-runtime", "ecosystem.config.cjs"]
