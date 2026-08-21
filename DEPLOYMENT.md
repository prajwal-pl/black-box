# BlackBox Deployment Guide

Complete guide to deploying the BlackBox AI Investigation OS.

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐
│   Frontend      │         │   Backend API   │
│   (Next.js)     │◄───────►│   (Bun/Express) │
│   Vercel        │         │   Vercel/Railway│
└─────────────────┘         └────────┬────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
       ┌──────▼──────┐      ┌────────▼────────┐    ┌───────▼──────┐
       │    Neon     │      │   Neo4j Aura    │    │ Qdrant Cloud │
       │ PostgreSQL  │      │  Graph Database │    │Vector Search │
       └─────────────┘      └─────────────────┘    └──────────────┘
              │
       ┌──────▼──────┐      ┌─────────────────┐    ┌──────────────┐
       │Cloudflare R2│      │  Trigger.dev    │    │ Fireworks AI │
       │   Storage   │      │Background Tasks │    │  + Groq LLM  │
       └─────────────┘      └─────────────────┘    └──────────────┘
```

### What replaced what

| Before | After | Reason |
|--------|-------|--------|
| BullMQ + Redis workers | **Trigger.dev** | No always-on worker process needed; free tier; built-in retries, observability, and task chaining |
| `workers/` directory | `backend/trigger/` tasks | Trigger.dev manages execution |
| Upstash Redis | *(removed)* | No longer needed — no BullMQ |

---

## Prerequisites

- GitHub account
- Vercel account (free)
- Neon account (free)
- Neo4j Aura account (free)
- Qdrant Cloud account (free)
- Cloudflare account (free)
- Trigger.dev account (free)
- Fireworks AI account (free)
- Groq account (free)

---

## 1. Database: Neon (PostgreSQL)

### Setup
1. Go to [console.neon.tech](https://console.neon.tech)
2. Create a new project → "blackbox"
3. Choose region closest to your users
4. Copy the connection string

### Configure
```env
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/blackbox?sslmode=require"
```

### Run Migrations
```bash
cd backend
bun --bun run prisma migrate deploy
```

### Free Tier Limits
- 0.5 GB storage
- 1 project, 10 branches
- Auto-suspend after 5 min inactivity

---

## 2. Graph Database: Neo4j Aura

### Setup
1. Go to [console.neo4j.io](https://console.neo4j.io)
2. Create "AuraDB Free" instance → "blackbox"
3. Save credentials (shown only once!)
4. Wait for "Ready" status (~60 seconds)

### Configure
```env
NEO4J_URI="neo4j+s://xxx.databases.neo4j.io"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="xxx"
NEO4J_DATABASE="neo4j"
```

### Free Tier Limits
- 200k nodes / 400k relationships
- 1 instance
- Auto-pause after 7 days inactivity

---

## 3. Vector Database: Qdrant Cloud

### Setup
1. Go to [cloud.qdrant.io](https://cloud.qdrant.io)
2. Create cluster → "Free" tier (1 GB) → "blackbox"
3. Create API key and copy cluster URL

### Configure
```env
QDRANT_URL="https://xxx.us-east-1.aws.cloud.qdrant.io:6333"
QDRANT_COLLECTION="blackbox"
```

> **Note:** The `QDRANT_API_KEY` environment variable is not currently required if your cluster allows unauthenticated access — add it if you enable API key authentication.

### Collection Setup
The collection is created automatically by the embedding processor on first run. It uses 1024-dimensional Cosine vectors (model: `qwen3-embedding-8b`).

To create manually:
```bash
curl -X PUT "https://xxx.cloud.qdrant.io:6333/collections/blackbox" \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 1024, "distance": "Cosine"}}'
```

### Free Tier Limits
- 1 GB storage / 1M vectors
- 1 cluster

---

## 4. Object Storage: Cloudflare R2

### Setup
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → R2 → Create bucket → "blackbox"
2. Manage R2 API tokens → Create token (Object Read & Write)
3. Copy: Account ID, Access Key ID, Secret Access Key

### Configure
```env
STORAGE_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
STORAGE_REGION="auto"
STORAGE_ACCESS_KEY="<ACCESS_KEY_ID>"
STORAGE_SECRET_KEY="<SECRET_ACCESS_KEY>"
STORAGE_BUCKET="blackbox"
```

### Free Tier Limits
- 10 GB storage
- 1M Class A / 10M Class B operations/month
- Unlimited egress

---

## 5. Background Tasks: Trigger.dev

This is the core change from the previous architecture. All background processing (PDF OCR, entity extraction, graph updates, embeddings, hypothesis generation) runs as Trigger.dev tasks — no Redis, no persistent worker processes.

### Setup
1. Go to [trigger.dev](https://trigger.dev) → Create account
2. Create a new project → copy the **Project ID**
3. Go to Settings → API Keys → create a **Secret Key**

### Configure
```env
TRIGGER_PROJECT_ID="proj_xxx"
TRIGGER_SECRET_KEY="tr_dev_xxx"   # or tr_live_xxx for production
```

Add these to your backend `.env` file AND to Trigger.dev's Environment Variables dashboard.

### Task Architecture

```
ingest-evidence (micro, 2 min)
  └─► process-pdf       (small-2x, 10 min) ─────────────────────────────┐
  └─► process-image     (small-2x, 5 min)  ─────────────────────────────┤
  └─► process-text      (micro, 2 min)     ─────────────────────────────┤
  └─► process-email     (micro, 2 min)     ──► extract-entities          │
  └─► process-spreadsheet (micro, 2 min)  ─────(micro, 15 min)          │
                                                      │                  │
                                                 update-graph            │
                                               (micro, 3 min)           │
                                                      │                  │
                                    ┌─────────────────┴──────────────┐  │
                               build-timeline              generate-embeddings
                               (micro, 2 min)              (micro, 10 min)
                                                                 │
                                              ┌──────────────────┴──────────────────┐
                                        update-hypotheses              scan-contradictions
                                         (micro, 10 min)               (micro, 10 min)
```

### System Dependencies (aptGet)

For production deploys, Trigger.dev installs these via `aptGet` in `trigger.config.ts`:
- `poppler-utils` — `pdftotext`, `pdftoppm`, `pdfinfo` for PDF processing
- `tesseract-ocr` + `tesseract-ocr-eng` — OCR for scanned PDFs

### Local Development

For local `trigger:dev`, tasks run on your machine. You must have the system binaries installed locally:

```bash
# Ubuntu/Debian
sudo apt-get install -y poppler-utils tesseract-ocr tesseract-ocr-eng

# Verify
which pdftotext pdftoppm tesseract
```

### Running in Dev Mode
```bash
cd backend
bun run trigger:dev
```

This starts the Trigger.dev dev server, which connects your local task code to Trigger.dev's cloud. Tasks are triggered via the API and executed locally.

### Deploying to Production
```bash
cd backend
bun run trigger:deploy
```

This bundles your tasks, installs the aptGet system packages in a cloud container, and deploys. **All `aptGet` packages (tesseract, poppler) are only available after a production deploy — not in dev mode.**

### Free Tier Limits
- 100,000 task runs/day
- 3 concurrent runs
- 14-day run history

---

## 6. AI Providers

### Fireworks AI
1. Go to [fireworks.ai](https://fireworks.ai) → API key
2. Used for: entity extraction, reasoning, embeddings (`qwen3-embedding-8b`)

```env
FIREWORKS_API_KEY="fw_xxx"
```

### Groq
1. Go to [console.groq.com](https://console.groq.com) → API key
2. Used for: hypothesis generation, contradiction scanning, timeline building
3. Free tier: 14,400 requests/day, 6,000 tokens/min

```env
GROQ_API_KEY="gsk_xxx"
```

---

## 7. Backend Deployment

The backend is a Bun/Express HTTP API. It does **not** run workers — all background work is handled by Trigger.dev tasks. This makes the backend itself stateless and easy to deploy anywhere.

### Option A: Railway (Recommended)

Railway handles persistent connections and has a simple deploy flow.

#### `Dockerfile` (already present in project root)
```dockerfile
FROM oven/bun:1.2-alpine
WORKDIR /app
COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile
COPY backend/prisma ./prisma/
RUN bun --bun run prisma generate
COPY backend/ .
EXPOSE 3001
CMD ["bun", "run", "index.ts"]
```

#### Deploy
1. Connect GitHub repo to Railway
2. Set root directory to `/backend`
3. Add all environment variables (see §9)
4. Deploy

### Option B: Vercel Serverless

Suitable for the API if you don't have long-running requests (uploads go to R2 directly, processing goes to Trigger.dev).

Add `vercel.json` in `backend/`:
```json
{
  "buildCommand": "bun install && bun --bun run prisma generate",
  "installCommand": "bun install",
  "framework": "none",
  "functions": {
    "index.ts": { "maxDuration": 60 }
  }
}
```

---

## 8. Frontend Deployment (Vercel)

### Configure
```env
# .env.local (local)
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Production
NEXT_PUBLIC_API_URL="https://your-backend.railway.app"
```

### Deploy
1. Push to GitHub
2. Import in Vercel → select project root `/`
3. Add `NEXT_PUBLIC_API_URL`
4. Deploy

---

## 9. Environment Variables Reference

### Backend `.env`
```env
# Server
PORT=3001
NODE_ENV=production

# Database (Neon)
DATABASE_URL="postgresql://..."

# Auth
ACCESS_TOKEN_SECRET="generate-with: openssl rand -base64 32"

# Neo4j Aura
NEO4J_URI="neo4j+s://xxx.databases.neo4j.io"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="xxx"
NEO4J_DATABASE="neo4j"

# Qdrant Cloud
QDRANT_URL="https://xxx.cloud.qdrant.io:6333"
QDRANT_COLLECTION="blackbox"

# Cloudflare R2
STORAGE_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
STORAGE_REGION="auto"
STORAGE_ACCESS_KEY="xxx"
STORAGE_SECRET_KEY="xxx"
STORAGE_BUCKET="blackbox"

# AI providers
FIREWORKS_API_KEY="fw_xxx"
GROQ_API_KEY="gsk_xxx"

# Trigger.dev
TRIGGER_PROJECT_ID="proj_xxx"
TRIGGER_SECRET_KEY="tr_live_xxx"

# CORS
CORS_ORIGIN="https://your-frontend.vercel.app"
```

### Frontend `.env.production`
```env
NEXT_PUBLIC_API_URL="https://your-backend.railway.app"
```

### Generate Secrets
```bash
# ACCESS_TOKEN_SECRET
openssl rand -base64 32
```

---

## 10. CORS Configuration

In `backend/index.ts`:
```typescript
import cors from "cors";

app.use(cors({
  origin: [
    "http://localhost:3000",
    process.env.CORS_ORIGIN,
  ].filter(Boolean),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
```

---

## 11. Health Check

```typescript
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
```

---

## 12. Running Tests

```bash
cd backend

# Unit tests (mocked — always fast, no binaries needed)
bun run test

# Integration tests against real PDFs (requires poppler-utils locally)
bun run test:integration

# Both
bun run test:all
```

> OCR integration tests are automatically skipped if `tesseract` is not installed locally. Install it with `sudo apt-get install -y tesseract-ocr tesseract-ocr-eng` to enable them.

---

## 13. Monitoring

### Trigger.dev Dashboard
The primary observability tool. Shows every task run with full logs, timing, retries, and payloads.

- Navigate to your project at [trigger.dev](https://trigger.dev)
- **Runs** tab: full execution history
- **Errors only** filter: quickly spot failing tasks
- Each task log includes `[PDF:DIAG]` binary availability checks

### Railway / Vercel
- Railway: Metrics + Logs tab per service
- Vercel: Functions → Logs

### Neon / Neo4j / Qdrant
- All have built-in dashboards at their respective consoles

---

## 14. DNS & Custom Domains

### Frontend (Vercel)
1. Project → Settings → Domains → add `app.yourdomain.com`
2. DNS: CNAME → `cname.vercel-dns.com`

### Backend (Railway)
1. Service → Settings → Networking → add `api.yourdomain.com`
2. Update `CORS_ORIGIN` and `NEXT_PUBLIC_API_URL`

### R2 (optional)
1. R2 → Bucket → Settings → Custom domain → `files.yourdomain.com`
2. Update `STORAGE_ENDPOINT`

---

## 15. Cost Summary (Free Tiers)

| Service | Free Tier | Cost |
|---------|-----------|------|
| Vercel (Frontend) | Unlimited personal | $0 |
| Railway (Backend) | $5 credit/month | $0–5 |
| Neon PostgreSQL | 0.5 GB | $0 |
| Neo4j Aura | 200k nodes | $0 |
| Qdrant Cloud | 1 GB / 1M vectors | $0 |
| Cloudflare R2 | 10 GB + unlimited egress | $0 |
| Trigger.dev | 100k runs/day | $0 |
| Fireworks AI | $1 credit/month | $0 |
| Groq | 14.4k req/day | $0 |
| **Total** | | **$0–5/month** |

---

## 16. Deployment Checklist

### Pre-Deployment
- [ ] All environment variables collected
- [ ] `ACCESS_TOKEN_SECRET` generated (`openssl rand -base64 32`)
- [ ] Database migrations tested locally (`bun --bun run prisma migrate deploy`)
- [ ] CORS origins configured

### Services
- [ ] Neon database created + migrations deployed
- [ ] Neo4j Aura instance ready
- [ ] Qdrant Cloud cluster created
- [ ] Cloudflare R2 bucket + API token created
- [ ] Trigger.dev project created, `TRIGGER_PROJECT_ID` + `TRIGGER_SECRET_KEY` set
- [ ] Fireworks AI key added
- [ ] Groq key added

### Deployment
- [ ] Backend deployed (Railway/Vercel) + health check responding at `/health`
- [ ] Trigger.dev tasks deployed: `bun run trigger:deploy`
- [ ] Frontend deployed (Vercel) + `NEXT_PUBLIC_API_URL` set

### Post-Deployment Smoke Test
- [ ] User registration / login works
- [ ] Case creation works
- [ ] Evidence upload → goes to R2 bucket
- [ ] Trigger.dev dashboard shows `ingest-evidence` task running
- [ ] After processing: evidence status changes PENDING → PROCESSING → COMPLETED
- [ ] Entity extraction triggers in Trigger.dev dashboard
- [ ] Graph updates visible in Neo4j Aura Browser
- [ ] Embeddings stored in Qdrant collection

---

## 17. Troubleshooting

### Evidence stuck on PROCESSING
Check the Trigger.dev dashboard → Runs. If the task shows `FAILED`, the `onFailure` hook will have set the status to `FAILED` in the database. Check the error message for the cause.

### tesseract not found (dev mode)
`trigger:dev` runs tasks locally — tesseract must be installed on your machine:
```bash
sudo apt-get install -y tesseract-ocr tesseract-ocr-eng
```
In production (`trigger:deploy`), tesseract is installed automatically via `aptGet` in `trigger.config.ts`.

### pdftotext / pdftoppm not found
```bash
sudo apt-get install -y poppler-utils
```

### Task timed out (MAX_DURATION_EXCEEDED)
Task durations are set per-task in `trigger/`. Current limits:
- `process-pdf`: 10 min (large scanned PDFs)
- `extract-entities`: 15 min (LLM on large documents)
- `generate-embeddings`, `update-hypotheses`, `scan-contradictions`: 10 min each

If tasks consistently time out, increase `maxDuration` in the relevant task file and redeploy.

### Prisma connection issues
```bash
cd backend
bun --bun run prisma db pull      # test connection
bun --bun run prisma generate     # regenerate client
```

### Qdrant connection
```bash
curl https://your-cluster.cloud.qdrant.io:6333/collections
```

### Neo4j connection
```bash
cypher-shell -a "neo4j+s://xxx.databases.neo4j.io" -u neo4j -p "password"
```

### R2 upload issues
- Verify `STORAGE_BUCKET` matches bucket name exactly
- Check API token has Object Read & Write permissions
- Ensure CORS policy on bucket allows your domain

---

## 18. Local Development

```bash
# Start backend API
cd backend
bun run dev          # or: bun --watch index.ts

# Start Trigger.dev dev server (separate terminal)
cd backend
bun run trigger:dev

# Start frontend
cd ..               # project root
bun run dev         # Next.js on :3000
```

Backend runs on `:3001`, frontend on `:3000`.

---

## 19. Scaling Beyond Free Tier

| Service | Paid Plan |
|---------|-----------|
| Railway | $5/month (after free credit) |
| Neon Scale | $19/month |
| Neo4j Aura Professional | $65/month |
| Qdrant Cloud | $0.10/GB/hour |
| Trigger.dev | $10/month (1M runs) |
| Cloudflare R2 | $0.015/GB/month |
| Fireworks AI | Pay per token |
| Groq | Free tier generous |

---

## Support Resources

- [Trigger.dev Docs](https://trigger.dev/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Neon Docs](https://neon.tech/docs)
- [Neo4j Aura Docs](https://neo4j.com/docs/aura/)
- [Qdrant Cloud Docs](https://qdrant.tech/documentation/cloud/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Fireworks AI Docs](https://docs.fireworks.ai)
- [Groq Docs](https://console.groq.com/docs)

---

*Last updated: August 2026*
*Project: BlackBox AI Investigation OS*