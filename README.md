# Pay-for-Performance — Production Monorepo

> **"Don't pay for promises. Pay for verified performance."**

Pay-for-Performance is an AI-powered SLA-based payment settlement platform that converts service-level agreements into evidence-backed financial decisions executed through PayPal.

---

## 🏗️ Monorepo Architecture

```
pay-for-performance/
│
├── apps/
│   ├── web/                     # Person 4: Next.js 16 (App Router), Tailwind CSS v4, AG-Grid
│   ├── api/                     # Person 3: Express, TypeScript, Mongoose 8, Policy & Monitoring Hub
│   ├── payments/                # Person 1: PayPal REST API v2 Integration (Authorize, Capture, Refund)
│   └── sla-service/             # Person 2: Python FastAPI, Groq LLM (llama-3.3/gpt-oss), PDFPlumber
│
├── packages/
│   ├── contracts/               # Shared TypeScript domain contracts & DTOs
│   └── config/                  # Shared linting, build, and environment constants
│
├── infra/
│   ├── mongodb/
│   │   └── docker-compose.yml   # Containerized MongoDB 7 with persistent volume
│   └── deployment/              # Production deployment guides (Render / Cloud Run)
│
├── docs/
│   ├── architecture/            # System topology, sequence flows, policy logic
│   ├── api/                     # Complete endpoint specification
│   └── setup/                   # MongoDB local & Atlas configuration guide
│
├── scripts/                     # Unified dev runner (dev-all.mjs), seed scripts, SLA generators
├── .gitignore                   # Consolidated monorepo gitignore
├── .env.example                 # Root orchestrator environment template
├── package.json                 # npm workspaces root coordinator
├── package-lock.json
└── README.md
```

---

## 📦 Service Ownership & Ports

| Component | Directory | Owner | Tech Stack | Local Port |
| :--- | :--- | :--- | :--- | :--- |
| **Web** | `apps/web/` | [Harshika Bodekar](https://github.com/harshikabodekar) (Person 4) | Next.js 16, React 19, Tailwind CSS, Motion, AG-Grid | `http://localhost:3000` |
| **Payments** | `apps/payments/` | [Paras Chavan](https://github.com/ParasChavan02) (Person 1) | Node.js, Express, TypeScript, PayPal REST APIs | `http://localhost:4000` |
| **Main API** | `apps/api/` | [Manas Pandya](https://github.com/hindmanas) (Person 3) | Express, TypeScript, MongoDB (Mongoose), Policy Engine | `http://localhost:5000` |
| **SLA Service**| `apps/sla-service/` | [Tanmay Shinde](https://github.com/Tanny28) (Person 2) | Python 3.10+, FastAPI, Groq LLM, PDFPlumber | `http://localhost:8000` |

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js** v20+ and **npm**
- **Python** 3.10+
- **MongoDB** (Local via Docker Compose or MongoDB Atlas)

### 2. Environment Configuration
Verify environment files in each app:
- `apps/payments/.env`: PayPal Sandbox credentials (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`)
- `apps/api/.env`: MongoDB connection (`MONGODB_URI`), `PAYMENT_SERVICE_URL=http://localhost:4000/api`, `SLA_SERVICE_URL=http://localhost:8000`
- `apps/sla-service/.env`: Groq API key (`GROQ_API_KEY`)
- `apps/web/.env.local`: API endpoint (`NEXT_PUBLIC_API_URL=http://localhost:5000`)

### 3. Start Database
To run a local MongoDB instance:
```bash
docker compose -f infra/mongodb/docker-compose.yml up -d
```
*Or connect directly to your MongoDB Atlas cluster by setting `MONGODB_URI` in `apps/api/.env`.*

Seed demonstration services, metrics, contracts, and breaches:
```bash
npm run seed
```

### 4. Start All Services (Single Command)
Run the root orchestrator to boot all 4 microservices simultaneously:
```bash
npm run dev
```

Or run individual apps:
- **Web UI**: `npm run dev:web`
- **Main API**: `npm run dev:api`
- **Payments**: `npm run dev:payments`
- **SLA Service**: `npm run dev:sla`

---

## 🧪 Testing

Execute automated test suites across the entire monorepo:

```bash
# Run all payment, backend API, and Python pytest tests (234 total tests)
npm run test:all

# Production build of payments, api, and web applications
npm run build
```

Individual service tests:
- **PayPal Payment Tests** (15 tests): `npm --prefix apps/payments test`
- **Backend API & Policy Tests** (134 tests): `npm --prefix apps/api test`
- **Python SLA Intelligence Tests** (85 tests): `npm run test:sla`

---

## 🎬 Primary Demo Scenario

1. **Authorization Hold**: Buyer authorizes a **$100.00** order on PayPal Sandbox.
2. **Contract Extraction**: At `http://localhost:3000/upload`, upload an SLA contract PDF (or click *"⚡ Click to auto-load demo SLA contract"*). Groq AI extracts the 99.9% uptime target and 25% credit penalty.
3. **Outage Simulation**: At `http://localhost:3000/dashboard`, click **"Simulate Outage"**. Uptime drops below 99.9%, triggering a **$25.00 SLA credit**.
4. **Approval & Partial Capture**: Click **"Approve & capture"**. The API calls the PayPal Engine, capturing **$75.00** with `final_capture: true`. PayPal automatically releases the remaining **$25.00** hold back to the buyer.
5. **Auditing**: Inspect `http://localhost:3000/transactions` and `http://localhost:3000/audit` to view the tamper-evident cryptographic ledger.

---

## 👥 Built By (The Team)

| Member | Role & Ownership | GitHub Profile | Module & Responsibilities |
| :--- | :--- | :--- | :--- |
| **Paras Chavan** (Person 1) | **Payment Systems Engineer** | [@ParasChavan02](https://github.com/ParasChavan02) | `apps/payments` — PayPal REST API v2, authorization holds, deterministic capture execution, partial refunds, idempotency |
| **Tanmay Shinde** (Person 2) | **AI & Intelligence Engineer** | [@Tanny28](https://github.com/Tanny28) | `apps/sla-service` — Python FastAPI, Groq LLM contract term extraction (`openai/gpt-oss-120b`), PDFPlumber text extraction |
| **Manas Pandya** (Person 3) | **Backend Architect & Database Lead** | [@hindmanas](https://github.com/hindmanas) | `apps/api` — Express.js architecture, MongoDB Atlas / Mongoose persistence, synthetic monitoring scheduler, SLA breach engine, financial policy evaluator |
| **Harshika Bodekar** (Person 4) | **Frontend Lead & UX Architect** | [@harshikabodekar](https://github.com/harshikabodekar) | `apps/web` — Next.js 16 (App Router), Tailwind CSS v4, interactive Control Center, live outage simulator, PayPal approval card, AG-Grid ledger |
