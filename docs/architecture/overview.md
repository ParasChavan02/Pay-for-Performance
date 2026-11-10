# System Architecture — Pay-for-Performance

> **"Don't pay for promises. Pay for verified performance."**

Pay-for-Performance is a four-tier automated financial settlement platform that transforms subjective Service Level Agreements into deterministic payment actions on PayPal.

---

## High-Level Topology

```
┌──────────────────────────────────────────────────────────────┐
│                    Next.js Web (Port 3000)                   │
│         apps/web: Control Center, Monitor & Approvals        │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                 Main Backend API (Port 5000)                 │
│         apps/api: Policy Engine, Settlement, MongoDB Hub     │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────┐ ┌──────────────────────────────┐
│   PayPal Service (Port 4000)│ │    SLA Intelligence (Port 8000)
│   apps/payments: REST v2    │ │    apps/sla-service: FastAI / Groq
└──────────────┬──────────────┘ └──────────────────────────────┘
               │
               ▼
┌─────────────────────────────┐
│    PayPal Sandbox API       │
│  api-m.sandbox.paypal.com   │
└─────────────────────────────┘
```

---

## Microservices Breakdown

### 1. Web Application (`apps/web` — Person 4)
- **Tech Stack**: Next.js 16, React 19, Tailwind CSS v4, Motion, AG-Grid
- **Role**: Buyer onboarding, SLA contract upload, real-time uptime monitoring, human approval card, and immutable audit ledger.
- **Port**: `http://localhost:3000`

### 2. Main API & Policy Hub (`apps/api` — Person 3)
- **Tech Stack**: Express 4, TypeScript, Mongoose 8, MongoDB
- **Role**: Coordinates SLA contracts, collects synthetic monitoring metrics, evaluates breach rules, calculates financial credits, enforces human-review policies, and triggers payment captures.
- **Port**: `http://localhost:5000`

### 3. Payment Execution Engine (`apps/payments` — Person 1)
- **Tech Stack**: Express, TypeScript, Axios, PayPal REST API v2
- **Role**: Manages payment authorization holds ($100), partial captures ($75), automatic hold release (`final_capture: true`), and partial refunds.
- **Port**: `http://localhost:4000`

### 4. SLA Intelligence Service (`apps/sla-service` — Person 2)
- **Tech Stack**: Python 3.10+, FastAPI, PDFPlumber, Groq API (`openai/gpt-oss-120b`)
- **Role**: Ingests vendor SLA PDF documents, parses contractual text with PDFPlumber, extracts measurable uptime and penalty commitments via Groq LLM, and formats JSON contracts.
- **Port**: `http://localhost:8000`
