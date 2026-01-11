# AWS Cost Analysis: Real-Time Trading Platform

**Version:** 1.0  
**Date:** 2026-01-08  
**Target:** Portfolio/Recruiter Demo (~100 users/month)

---

## 1. Architecture Overview

This trading platform is a **7-component microservices architecture** designed for real-time cryptocurrency order matching and WebSocket-based data distribution:

| Component | Technology | Role |
|-----------|------------|------|
| **Frontend** | Next.js (SSR/SSG) | Trading UI, charts, order forms |
| **API Server** | Express.js (Port 8080) | REST endpoints, authentication, order routing |
| **WS Gateway** | Node.js WebSocket (Port 3001) | Real-time subscriptions (depth, trades, orders) |
| **Matching Engine** | Node.js (single-threaded) | Order matching, balance management |
| **DB Worker** | Node.js | Async persistence to PostgreSQL |
| **Redis** | Redis 7.x | Pub/Sub, queues, real-time state cache |
| **PostgreSQL** | TimescaleDB (PG12) | Durable storage, trade history, order ledger |

For a **portfolio demo** with ~100 monthly visitors and minimal concurrent WebSocket connections, we optimize for **lowest cost** over high availability. All services run in a **single AWS region** with no auto-scaling.

---

## 2. AWS Cost Breakdown

### 2.1 Compute: Backend Services

| Service | AWS Product | Configuration | Monthly Cost (USD) |
|---------|-------------|--------------|-------------------|
| API + WS Gateway + Engine + DB Worker | **AWS Lightsail** | 1× $5/mo instance (1 vCPU, 1GB RAM, 40GB SSD) | **$5.00** |

**Assumptions & Rationale:**
- All 4 Node.js services run containerized on a **single Lightsail $5 instance**
- Docker Compose orchestrates: Engine, API, WS Gateway, DB Worker
- At ~100 users/month with low concurrency, 1GB RAM is sufficient
- Lightsail includes **2TB transfer/month** (far exceeds needs)
- Alternative considered: t4g.nano EC2 ($3.07/mo) + EBS — but Lightsail is simpler and includes bandwidth

> [!TIP]
> **Free Tier Option:** If your AWS account is <12 months old, use **t3.micro EC2** (750 hrs/mo free) instead of Lightsail for $0 compute.

---

### 2.2 Database: PostgreSQL/TimescaleDB

| Service | AWS Product | Configuration | Monthly Cost (USD) |
|---------|-------------|--------------|-------------------|
| PostgreSQL/TimescaleDB | **Self-hosted on Lightsail** | Same $5 instance (Docker container) | **$0.00** (included) |

**Assumptions & Rationale:**
- TimescaleDB runs as Docker container alongside application services
- For 100 users, a shared instance is sufficient — no need for RDS
- Storage: ~1GB for orders/trades/snapshots (well within 40GB SSD)
- **RDS db.t4g.micro** would cost ~$12.41/mo — overkill for demo purposes

> [!CAUTION]
> Self-hosted DB means **no automated backups**. Enable manual snapshots or use pg_dump to S3 weekly for safety.

---

### 2.3 Cache/Message Broker: Redis

| Service | AWS Product | Configuration | Monthly Cost (USD) |
|---------|-------------|--------------|-------------------|
| Redis | **Self-hosted on Lightsail** | Docker container | **$0.00** (included) |

**Assumptions & Rationale:**
- Redis runs in Docker alongside other services
- Memory usage: ~50-100MB for orderbook snapshots, balance cache, pub/sub
- **ElastiCache cache.t4g.micro** minimum is ~$12.41/mo — unnecessary for low traffic

---

### 2.4 Frontend: Next.js Hosting

| Service | AWS Product | Configuration | Monthly Cost (USD) |
|---------|-------------|--------------|-------------------|
| Next.js Frontend | **AWS Amplify Hosting** | Free tier: 5GB storage, 15GB/mo bandwidth | **$0.00** |

**Assumptions & Rationale:**
- Export Next.js as **static site** (`next export`) if no SSR needed
- If SSR required: Amplify supports SSR via Lambda@Edge
- 100 users × ~5MB per visit = ~500MB/mo (well under 15GB free tier)
- Alternative: Vercel Hobby (free), or S3+CloudFront (more complex)

> [!NOTE]
> The frontend connects to WebSocket via `ws://your-lightsail-ip:3001` and HTTP via `http://your-lightsail-ip:8080`. Configure environment variables accordingly.

---

### 2.5 Networking

| Service | AWS Product | Configuration | Monthly Cost (USD) |
|---------|-------------|--------------|-------------------|
| Bandwidth | Included in Lightsail | 2TB/month included | **$0.00** |
| Load Balancer | **Not used** | Direct IP access | **$0.00** |
| SSL/TLS | **Let's Encrypt** | Free certificate via Certbot | **$0.00** |
| DNS | **Route 53** | 1 hosted zone | **$0.50** |

**Assumptions & Rationale:**
- No ALB/ELB needed — single instance handles all traffic
- WebSocket + HTTP on same Lightsail instance via different ports
- Route 53 optional — can use free Cloudflare DNS instead ($0)

---

### 2.6 Monitoring & Logging

| Service | AWS Product | Configuration | Monthly Cost (USD) |
|---------|-------------|--------------|-------------------|
| Metrics | **Lightsail built-in** | CPU, memory, disk, network | **$0.00** |
| Logs | **CloudWatch Logs** | Free tier: 5GB ingestion, 5GB storage | **$0.00** |

**Assumptions & Rationale:**
- Lightsail includes basic monitoring dashboard
- Application logs: ~100MB/month easily fits in CloudWatch free tier
- No APM or advanced tracing needed for demo

---

### 2.7 Storage & Backups

| Service | AWS Product | Configuration | Monthly Cost (USD) |
|---------|-------------|--------------|-------------------|
| Snapshots | **Lightsail Snapshots** | 1 monthly snapshot | **$0.05/GB** (~$2) |
| Object Storage | **Not required** | — | **$0.00** |

**Assumptions & Rationale:**
- Monthly Lightsail snapshot (~40GB) ≈ $2 for disaster recovery
- No S3 needed unless storing user uploads

---

## 3. Total Monthly Cost Summary

| Category | Cost (USD) |
|----------|------------|
| Compute (Lightsail) | $5.00 |
| Database (self-hosted) | $0.00 |
| Redis (self-hosted) | $0.00 |
| Frontend (Amplify Free) | $0.00 |
| DNS (Route 53) | $0.50 |
| Monitoring (Free Tier) | $0.00 |
| Backups (Snapshot) | ~$2.00 |
| **Total** | **~$7.50/month** |

> [!IMPORTANT]
> With AWS Free Tier (new accounts <12 months): **$0.50-$2.50/month** if using t3.micro EC2 instead of Lightsail.

---

## 4. Further Cost Optimizations

### 4.1 Reduce to $5/month
- Use **Cloudflare DNS** (free) instead of Route 53 → Save $0.50
- Skip monthly snapshots, rely on code-based recovery → Save $2

### 4.2 Reduce to ~$0-2/month (Free Tier Maximized)
- Use **EC2 t3.micro** (750 hrs free/mo for 12 months)
- Use **Vercel** for frontend (free hobby tier)
- Use **Cloudflare** for DNS and CDN (free)
- Store snapshots in **S3 Free Tier** (5GB)

### 4.3 Alternative: Railway/Render
- **Railway**: $5/mo hobby tier — simpler deployment
- **Render**: Free tier for static sites + $7/mo for services

### 4.4 Reduce Compute Requirements
- Combine WS Gateway and API into single process (saves ~200MB RAM)
- Use SQLite instead of PostgreSQL for ultra-minimal footprint

---

## 5. Architecture Diagram: AWS Deployment

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AWS LIGHTSAIL ($5/mo)                           │
│                        1 vCPU | 1GB RAM | 40GB SSD                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      Docker Compose                              │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │    │
│  │  │ API Server  │ │ WS Gateway  │ │   Engine    │ │ DB Worker  │ │    │
│  │  │  :8080      │ │   :3001     │ │   (loop)    │ │  (queue)   │ │    │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬──────┘ │    │
│  │         │               │               │               │        │    │
│  │         └───────────────┼───────────────┼───────────────┘        │    │
│  │                         │               │                        │    │
│  │                    ┌────┴────┐    ┌─────┴─────┐                   │    │
│  │                    │  Redis  │    │TimescaleDB│                   │    │
│  │                    │  :6379  │    │   :5432   │                   │    │
│  │                    └─────────┘    └───────────┘                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Public IP
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      AWS AMPLIFY HOSTING (FREE)                         │
│                         Next.js Static Export                           │
│                                                                         │
│   HTTP API: https://api.yourdomain.com -> Lightsail:8080                │
│   WebSocket: wss://ws.yourdomain.com  -> Lightsail:3001                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Recruiter-Friendly Explanation

**"What does it cost to run this trading platform?"**

This is a real-time trading application similar to a simplified Binance or Coinbase. Here's the plain-English breakdown:

### The Stack
- **Frontend**: A React-based website where users see live price charts and place orders
- **Backend**: Four small Node.js programs that handle orders, manage user balances, and broadcast live updates
- **Databases**: PostgreSQL stores history (like bank statements), Redis handles real-time data (like a whiteboard everyone can see instantly)

### Monthly Costs
| What | Why | Cost |
|------|-----|------|
| One small cloud computer | Runs all the backend code and databases | $5 |
| Website hosting | Serves the trading interface | FREE |
| Domain & DNS | yourdomain.com | ~$1 |
| Backups | In case something breaks | ~$2 |
| **Total** | | **~$8/month** |

### Why So Cheap?
1. **100 users is tiny** — A $5 server easily handles 10,000× more requests
2. **No high availability** — If server reboots, it's offline for 2 minutes (acceptable for demo)
3. **No load balancer** — Single server means no need for traffic routing ($16+ saved)
4. **Free tiers** — AWS gives generous free limits for small projects

### If This Were Production
For a real exchange with 10,000+ users and 99.9% uptime requirements:
- Multiple servers across regions: **~$200-500/mo**
- Managed databases (RDS + ElastiCache): **~$100/mo**
- Load balancer + auto-scaling: **~$50/mo**
- **Total: $350-650/mo minimum**

This portfolio project proves I can build production-grade architecture while being cost-conscious about infrastructure.

---

## 7. Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| Server crash | 5-10 min downtime | Lightsail auto-restart + snapshot restore |
| Data loss | Trade history lost | Daily pg_dump to S3 ($0.02/month) |
| Redis memory full | Orders fail | Monitor via CloudWatch; 1GB is 100× typical usage |
| SSL expires | Security warnings | Certbot auto-renewal cron job |
| Exceeds free tier | Unexpected charges | Set billing alerts at $10 |

---

## 8. Deployment Checklist

- [ ] Create Lightsail $5 instance (Ubuntu 22.04)
- [ ] Install Docker & Docker Compose
- [ ] Deploy [docker-compose.yml](file:///c:/Projects/exchange-platform/week-30-orderbook-1/week-2/docker/docker-compose.yml) with all services
- [ ] Configure Certbot for SSL (Let's Encrypt)
- [ ] Deploy Next.js to Amplify (connect GitHub repo)
- [ ] Configure environment variables (WebSocket URLs, DB credentials)
- [ ] Set up Route 53 / Cloudflare DNS records
- [ ] Enable Lightsail metrics monitoring
- [ ] Create initial snapshot for backup
- [ ] Test order flow end-to-end

---

**Document prepared for portfolio demonstration and recruiter review.**
