# BlackBox Deployment Guide

Complete guide to deploying the BlackBox AI Investigation OS using free-tier services.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Backend       │
│   (Vercel)      │◄───►│   (Vercel/Railway)│
└────────┬────────┘     └────────┬────────┘
         │                       │
         │         ┌─────────────┼─────────────┐
         │         │             │             │
    ┌────▼────┐ ┌───▼────┐ ┌─────▼────┐ ┌─────▼────┐
    │  Neon   │ │ Upstash│ │  Aura    │ │ Qdrant   │
    │PostgreSQL│ │ Redis  │ │ Neo4j    │ │ Cloud    │
    └─────────┘ └────────┘ └──────────┘ └──────────┘
         │         │             │             │
         │    ┌────▼────┐  ┌─────▼────┐        │
         │    │ Fireworks│  │  Groq    │        │
         │    │   AI     │  │   AI     │        │
         │    └─────────┘  └──────────┘        │
         │                                     │
         └──────────────┬──────────────────────┘
                        │
                 ┌──────▼──────┐
                 │Cloudflare R2│
                 └─────────────┘
```

---

## Prerequisites

- GitHub account
- Vercel account (free)
- Neon account (free)
- Upstash account (free)
- Neo4j Aura account (free)
- Qdrant Cloud account (free)
- Cloudflare account (free)
- Fireworks AI account (free)
- Groq account (free)

---

## 1. Database: Neon (PostgreSQL)

### Setup
1. Go to [console.neon.tech](https://console.neon.tech)
2. Create a new project → "blackbox"
3. Choose region closest to your users
4. Copy the connection string (looks like: `postgresql://user:pass@host/db?sslmode=require`)

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
- 1 project
- 10 branches
- Auto-suspend after 5 min inactivity

---

## 2. Redis: Upstash

### Setup
1. Go to [console.upstash.com](https://console.upstash.com)
2. Create database → "blackbox-redis"
3. Choose "Free" tier
4. Select region matching Neon
5. Enable TLS
6. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### Configure
```env
# For BullMQ (ioredis compatible)
REDIS_URL="rediss://default:token@host:port"
# Or for REST API
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxx"
```

### Update Backend Redis Config
In `backend/queues/config/redis.config.ts`:
```typescript
import { Redis } from "ioredis";

export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});
```

### Free Tier Limits
- 10,000 requests/day
- 256 MB storage
- 1 database

---

## 3. Graph Database: Neo4j Aura

### Setup
1. Go to [console.neo4j.io](https://console.neo4j.io)
2. Create "AuraDB Free" instance
3. Name: "blackbox"
4. Choose region matching others
5. Save credentials (shown only once!)
6. Wait for "Ready" status (~60 seconds)

### Configure
```env
NEO4J_URI="neo4j+s://xxx.databases.neo4j.io"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="xxx"
NEO4J_DATABASE="neo4j"
```

### Initialize Schema
```bash
cd backend
bun run seed.ts  # Run any graph initialization
```

### Free Tier Limits
- 200k nodes / 400k relationships
- 1 instance
- Auto-pause after 7 days inactivity

---

## 4. Vector Database: Qdrant Cloud

### Setup
1. Go to [cloud.qdrant.io](https://cloud.qdrant.io)
2. Sign up / log in
3. Create cluster → "Free" tier (1 GB)
4. Name: "blackbox"
5. Choose region (AWS/GCP/Azure) matching others
6. Create API key
7. Copy cluster URL and API key

### Configure
```env
QDRANT_URL="https://xxx.us-east-1.aws.cloud.qdrant.io:6333"
QDRANT_API_KEY="xxx"  # If using API key auth
QDRANT_COLLECTION="blackbox"
```

### Create Collection (Auto-created by code, or manually)
```bash
curl -X PUT "https://xxx.cloud.qdrant.io:6333/collections/blackbox" \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 1024,
      "distance": "Cosine"
    }
  }'
```

**Note**: The embedding model `qwen3-embedding-8b` produces 1024-dimensional vectors.

### Free Tier Limits
- 1 GB storage
- 1 cluster
- 1M vectors

---

## 5. Object Storage: Cloudflare R2

### Setup
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Navigate to R2 → Create bucket → "blackbox"
3. Go to "Manage R2 API tokens" → Create API token
   - Permissions: "Object Read & Write"
   - Account: Your account
4. Copy: Account ID, Access Key ID, Secret Access Key

### Configure
```env
STORAGE_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
STORAGE_REGION="auto"
STORAGE_ACCESS_KEY="<ACCESS_KEY_ID>"
STORAGE_SECRET_KEY="<SECRET_ACCESS_KEY>"
STORAGE_BUCKET="blackbox"
```

### Public Access (Optional)
For public file access, create a custom domain:
1. R2 bucket → Settings → Custom domain
2. Add subdomain (e.g., `files.yourdomain.com`)
3. Update `STORAGE_ENDPOINT` to custom domain

### Free Tier Limits
- 10 GB storage
- 1M Class A operations/month
- 10M Class B operations/month
- Unlimited egress (free!)

---

## 6. AI Providers

### Fireworks AI
1. Go to [fireworks.ai](https://fireworks.ai)
2. Sign up → Get API key
3. Free tier: $1 credit/month (plenty for embeddings)
4. Model used: `accounts/fireworks/models/qwen3-embedding-8b`

```env
FIREWORKS_API_KEY="fw_xxx"
```

### Groq
1. Go to [console.groq.com](https://console.groq.com)
2. Create API key
3. Free tier: 14,400 requests/day, 6,000 tokens/min
4. Models: `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`

```env
GROQ_API_KEY="gsk_xxx"
```

---

## 7. Backend Deployment

### Option A: Vercel (Recommended for Serverless)

#### Create `vercel.json` in backend/
```json
{
  "buildCommand": "bun install && bun --bun run prisma generate && bun run build",
  "outputDirectory": "dist",
  "devCommand": "bun run dev",
  "installCommand": "bun install",
  "framework": "none",
  "functions": {
    "index.ts": {
      "maxDuration": 60
    }
  }
}
```

#### Add build script to `backend/package.json`
```json
{
  "scripts": {
    "build": "bun build index.ts --outdir dist --external:@prisma/client",
    "start": "node dist/index.js",
    "dev": "bun --watch index.ts"
  }
}
```

#### Deploy
1. Push backend to GitHub (or use monorepo)
2. Import in Vercel → Select backend folder
3. Add all environment variables
4. Deploy

### Option B: Railway (Better for Long-Running Workers)

#### Create `railway.json` in backend/
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "bun run start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100
  }
}
```

#### Create `Dockerfile` in backend/
```dockerfile
FROM oven/bun:1.2-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma/
RUN bun --bun run prisma generate

COPY . .
RUN bun run build

EXPOSE 3001
CMD ["bun", "run", "start"]
```

#### Deploy
1. Connect GitHub repo to Railway
2. Select backend folder
3. Add environment variables
4. Deploy

#### Run Workers Separately
In Railway, create separate services for each worker:
- `ingestion-worker`: `bun run workers/ingestion.worker.ts`
- `processing-worker`: `bun run workers/processing.worker.ts`
- `reasoning-worker`: `bun run workers/reasoning.worker.ts`
- `graph-worker`: `bun run workers/graph.worker.ts`

---

## 8. Frontend Deployment (Vercel)

### Create `.env.local` in root
```env
NEXT_PUBLIC_API_URL="https://your-backend.vercel.app"
```

### Deploy
1. Push to GitHub
2. Import in Vercel
3. Root directory: `/` (project root)
4. Add `NEXT_PUBLIC_API_URL`
5. Deploy

### Update `next.config.ts` for Production
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

---

## 9. Environment Variables Summary

### Backend (.env.production)
```env
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL="postgresql://..."

# Auth
ACCESS_TOKEN_SECRET="generate-with-openssl-rand-base64-32"

# Neo4j
NEO4J_URI="neo4j+s://..."
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="..."
NEO4J_DATABASE="neo4j"

# Redis
REDIS_URL="rediss://..."  # or UPSTASH_REDIS_REST_URL + TOKEN

# Qdrant
QDRANT_URL="https://..."
QDRANT_API_KEY="..."
QDRANT_COLLECTION="blackbox"

# Storage (R2)
STORAGE_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
STORAGE_REGION="auto"
STORAGE_ACCESS_KEY="..."
STORAGE_SECRET_KEY="..."
STORAGE_BUCKET="blackbox"

# AI
FIREWORKS_API_KEY="fw_..."
GROQ_API_KEY="gsk_..."

# CORS
CORS_ORIGIN="https://your-frontend.vercel.app"
```

### Frontend (.env.production)
```env
NEXT_PUBLIC_API_URL="https://your-backend.vercel.app"
```

---

## 10. Generate Secure Secrets

```bash
# Access token secret (32 bytes)
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 11. CORS Configuration

In `backend/index.ts`, update CORS:
```typescript
import cors from "cors";

const allowedOrigins = [
  "http://localhost:3000",
  "https://your-frontend.vercel.app",
  process.env.CORS_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
```

---

## 12. Health Check Endpoint

Add to `backend/index.ts`:
```typescript
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
```

---

## 13. Worker Deployment Notes

### BullMQ Workers Need Persistent Connections
Vercel serverless functions have max 60s timeout - **not suitable for workers**.

**Recommended: Railway or Render for workers**

#### Railway Worker Service
1. Create new service in same project
2. Root: `/backend`
3. Start command: `bun run workers/ingestion.worker.ts`
4. Add same environment variables
5. Repeat for each worker type

#### Or Use Separate Process Manager
```bash
# PM2 ecosystem.config.js
module.exports = {
  apps: [
    { name: 'api', script: 'dist/index.js' },
    { name: 'ingestion-worker', script: 'workers/ingestion.worker.ts', interpreter: 'bun' },
    { name: 'processing-worker', script: 'workers/processing.worker.ts', interpreter: 'bun' },
    { name: 'reasoning-worker', script: 'workers/reasoning.worker.ts', interpreter: 'bun' },
    { name: 'graph-worker', script: 'workers/graph.worker.ts', interpreter: 'bun' },
  ],
};
```

---

## 14. DNS & Custom Domains

### Frontend (Vercel)
1. Project → Settings → Domains
2. Add `app.yourdomain.com`
3. Configure DNS: CNAME → `cname.vercel-dns.com`

### Backend (Vercel/Railway)
1. Add `api.yourdomain.com`
2. Update `CORS_ORIGIN` and `NEXT_PUBLIC_API_URL`

### R2 Custom Domain
1. R2 → Bucket → Settings → Custom domain
2. Add `files.yourdomain.com`
3. Update `STORAGE_ENDPOINT`

---

## 15. Monitoring & Logs

### Vercel
- Functions → Logs
- Analytics → Web Vitals

### Railway
- Metrics tab
- Logs tab

### Upstash
- Console → Metrics

### Neon
- Dashboard → Monitoring

### Qdrant Cloud
- Dashboard → Metrics

---

## 16. Cost Summary (Free Tiers)

| Service | Free Tier | Est. Monthly Cost |
|---------|-----------|-------------------|
| Vercel (Frontend) | Unlimited personal | $0 |
| Vercel (Backend) | 100 GB-hours | $0* |
| Railway (Workers) | $5 credit/month | $0-5 |
| Neon PostgreSQL | 0.5 GB | $0 |
| Upstash Redis | 10k req/day | $0 |
| Neo4j Aura | 200k nodes | $0 |
| Qdrant Cloud | 1 GB | $0 |
| Cloudflare R2 | 10 GB | $0 |
| Fireworks AI | $1 credit | $0 |
| Groq | 14.4k req/day | $0 |
| **Total** | | **$0-5/month** |

*Vercel serverless functions may hit limits with workers. Railway recommended for backend + workers.

---

## 17. Deployment Checklist

### Pre-Deployment
- [ ] All environment variables collected
- [ ] Secrets generated (ACCESS_TOKEN_SECRET)
- [ ] Database migrations tested locally
- [ ] Workers tested locally
- [ ] CORS origins configured

### Backend
- [ ] Neon database created + migrations run
- [ ] Upstash Redis created
- [ ] Neo4j Aura instance ready
- [ ] Qdrant Cloud cluster created + collection
- [ ] Cloudflare R2 bucket + API token
- [ ] Fireworks AI key added
- [ ] Groq key added
- [ ] Backend deployed (Vercel/Railway)
- [ ] Workers deployed (Railway)
- [ ] Health check responding

### Frontend
- [ ] NEXT_PUBLIC_API_URL set
- [ ] Frontend deployed (Vercel)
- [ ] Custom domain configured
- [ ] API calls working

### Post-Deployment
- [ ] Test user registration/login
- [ ] Test case creation
- [ ] Test evidence upload (R2)
- [ ] Test AI reasoning (Groq)
- [ ] Test embeddings (Fireworks → Qdrant)
- [ ] Test graph queries (Neo4j)
- [ ] Test background jobs (BullMQ → Redis)
- [ ] Monitor logs for errors

---

## 18. Troubleshooting

### Prisma Connection Issues
```bash
# Test connection
bun --bun run prisma db pull

# Regenerate client
bun --bun run prisma generate
```

### Qdrant Connection
```bash
# Test with curl
curl -H "api-key: YOUR_KEY" https://your-cluster.cloud.qdrant.io:6333/collections
```

### Redis Connection
```bash
# Test Upstash REST
curl -H "Authorization: Bearer TOKEN" https://xxx.upstash.io/keys/*
```

### Neo4j Connection
```bash
# Use Neo4j Browser at console.neo4j.io
# Or cypher-shell
cypher-shell -a "neo4j+s://xxx.databases.neo4j.io" -u neo4j -p "password"
```

### R2 Upload Issues
- Verify bucket name matches `STORAGE_BUCKET`
- Check API token has Read/Write permissions
- Ensure CORS policy on bucket allows your domain

---

## 19. Local Development with Production Services

Create `.env.local` in backend/:
```env
# Use production services locally
DATABASE_URL="postgresql://..."
REDIS_URL="rediss://..."
NEO4J_URI="neo4j+s://..."
QDRANT_URL="https://..."
STORAGE_ENDPOINT="https://..."
FIREWORKS_API_KEY="fw_..."
GROQ_API_KEY="gsk_..."
```

Run locally:
```bash
cd backend
bun --watch index.ts
```

---

## 20. Scaling Beyond Free Tier

| Service | Paid Plan Starts At |
|---------|---------------------|
| Vercel Pro | $20/month |
| Railway | $5/month (after credit) |
| Neon Scale | $19/month |
| Upstash Pro | $0.25/million requests |
| Neo4j Aura Professional | $65/month |
| Qdrant Cloud | $0.10/GB/hour |
| Cloudflare R2 | $0.015/GB/month |
| Fireworks | Pay per token |
| Groq | Free tier generous |

---

## Support Resources

- [Vercel Docs](https://vercel.com/docs)
- [Neon Docs](https://neon.tech/docs)
- [Upstash Docs](https://docs.upstash.com)
- [Neo4j Aura Docs](https://neo4j.com/docs/aura/)
- [Qdrant Cloud Docs](https://qdrant.tech/documentation/cloud/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Fireworks AI Docs](https://docs.fireworks.ai)
- [Groq Docs](https://console.groq.com/docs)

---

*Last updated: 2025*
*Project: BlackBox AI Investigation OS*