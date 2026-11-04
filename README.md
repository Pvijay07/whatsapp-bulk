# WhatsApp Bulk Messaging SaaS (Indian Virtual Numbers + Official WhatsApp Cloud API)

A production-ready, multi-tenant SaaS architecture for provisioning Indian (+91) virtual business numbers, managing WhatsApp Business accounts, running bulk template messaging campaigns, maintaining contact CRM with strict consent/opt-out compliance, and managing prepaid customer wallets with a double-entry ledger in paise.

---

## 1. Key Highlights & Technical Distinctions

- **Indian Virtual Numbers (+91)**: Designed to integrate with licensed Indian Cloud Telephony / TSP / VNO partners (such as Exotel, Tata Tele Business Services, Airtel IQ) compliant with DoT/TRAI KYC requirements. Onboarding to WhatsApp is done via official Voice OTP or SMS.
- **Official WhatsApp Business Platform (Cloud API)**: Operates strictly via Meta's Cloud API and authorized BSPs (Business Solution Providers) adhering to Meta's Business Messaging Policy. **No brittle headless scraping or unofficial automations** that risk immediate bans.
- **Double-Entry Wallet Ledger in Paise**: Prevents floating-point rounding errors by storing all currency values in 64-bit integer paise (₹1.00 = 100 paise). Supports campaign escrow reservations and atomic settlements.
- **BullMQ + Redis Asynchronous Queue**: Handles high-throughput background message dispatching with exponential backoff and rate-limiting compliant with Meta WABA throughput tiers.
- **Automated Opt-Out (STOP) Suppression**: Automatically intercepts incoming `STOP` / `UNSUBSCRIBE` webhooks and places contacts onto a global suppression list.

---

## 2. Directory Structure

```text
.
├── docker-compose.yml          # Production Docker Compose (API, Worker, Postgres 16, Redis 7, NGINX)
├── .env.example                # Configuration blueprint
├── nginx/
│   └── nginx.conf              # Reverse proxy configuration
├── backend/
│   ├── Dockerfile              # Multi-stage production container build
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma       # Multi-tenant PostgreSQL schema
│   └── src/
│       ├── main.ts             # API entrypoint + Swagger docs (/api/docs)
│       ├── worker.ts           # BullMQ standalone background worker entrypoint
│       ├── app.module.ts       # NestJS root module
│       ├── database/           # Prisma service & connection handling
│       ├── providers/          # Abstraction layer
│       │   ├── numbers/        # NumberProvider interface, Exotel & Mock adapters
│       │   └── messaging/      # MessagingProvider interface, Meta Cloud API & Mock adapters
│       ├── modules/
│       │   ├── auth/           # Multi-tenant JWT auth, registration, login
│       │   ├── wallet/         # Atomic paise ledger, escrow hold, settlements
│       │   ├── contacts/       # CRM, high-volume streaming CSV imports
│       │   ├── consent/        # Opt-in validation & suppression lists
│       │   ├── campaigns/      # Campaign lifecycle (create, escrow, queue, pause, report)
│       │   ├── virtual-numbers/# +91 number discovery and allocation
│       │   ├── whatsapp-accounts/ # WABA phone number linking
│       │   └── webhooks/       # Meta challenge verification & status webhooks
│       └── queue/              # BullMQ queue definitions & concurrency worker
```

---

## 3. Quick Start Guide (Local Development)

### 3.1 Install Dependencies
```powershell
cd d:\vijay\whatsapp-bulk\backend
npm install
```

### 3.2 Initialize Environment
```powershell
cp ..\.env.example .env
```

### 3.3 Generate Prisma Client & Run Migrations
```powershell
npx prisma generate
npx prisma migrate dev --name init
```

### 3.4 Start API & Background Worker
Terminal 1 (NestJS API):
```powershell
npm run start:dev
```

Terminal 2 (BullMQ Campaign Worker):
```powershell
npm run worker
```

- **API Base URL**: `http://localhost:3000/api/v1`
- **Swagger Documentation**: `http://localhost:3000/api/docs`

---

## 4. Production Deployment on Ubuntu 24.04 VPS

### 4.1 VPS Prerequisites
- Ubuntu 24.04 LTS (4 vCPU, 8 GB RAM, 100 GB SSD recommended)
- Docker & Docker Compose plugin installed (`apt install docker-compose-plugin`)

### 4.2 Deployment Steps
1. Clone your repository to `/opt/whatsapp-saas`:
   ```bash
   git clone <your-repo> /opt/whatsapp-saas
   cd /opt/whatsapp-saas
   ```
2. Copy and configure production secrets:
   ```bash
   cp .env.example .env
   nano .env
   ```
3. Build and launch containers:
   ```bash
   docker compose build
   docker compose up -d
   ```
4. Verify running services:
   ```bash
   docker compose ps
   docker compose logs -f api
   docker compose logs -f worker
   ```

---

## 5. Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new organization & owner user |
| `POST` | `/api/v1/auth/login` | Authenticate and obtain JWT access token |
| `GET` | `/api/v1/wallet` | View current balance (paise & INR) and escrow holds |
| `POST` | `/api/v1/wallet/topup` | Credit wallet balance via payment gateway |
| `GET` | `/api/v1/numbers/search?countryCode=+91` | Search available Indian virtual numbers |
| `POST` | `/api/v1/numbers/purchase` | Provision a virtual number under KYC reference |
| `POST` | `/api/v1/whatsapp/accounts/connect` | Connect Meta WABA phone number |
| `POST` | `/api/v1/contacts/import` | High-volume CSV import with opt-in consent |
| `POST` | `/api/v1/campaigns` | Create bulk campaign draft |
| `POST` | `/api/v1/campaigns/:id/start` | Validate, reserve escrow, and enqueue to BullMQ |
| `POST` | `/api/v1/campaigns/:id/pause` | Pause active campaign |
| `POST` | `/api/v1/campaigns/:id/resume` | Resume paused campaign |
| `GET` | `/api/v1/campaigns/:id/report` | Real-time campaign delivery report |
| `GET` | `/api/v1/webhooks/meta` | Meta Webhook challenge handshake |
| `POST` | `/api/v1/webhooks/meta` | Receive delivery receipts (sent/delivered/read/failed) and process STOP opt-outs |

