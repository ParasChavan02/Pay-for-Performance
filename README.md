# Pay-for-Performance — SLA-Based Payment Settlement Platform

> **"Don't pay for promises. Pay for verified performance."**

Pay-for-Performance is an end-to-end AI-powered financial settlement platform that connects service contracts directly to automated, evidence-backed payment decisions.

```text
       ┌────────────────────────┐
       │   Client Signs SLA     │
       └───────────┬────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│  1. Create $100 Order & Hold          │◄── PayPal Orders API v2 (intent=AUTHORIZE)
│     Buyer approves in Sandbox         │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│  2. AI Extracts Contract Promises     │◄── FastAPI + Groq LLM (llama-3.3-70b-versatile)
│     (Uptime, Latency, Credit Terms)   │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│  3. Continuous Service Monitoring     │◄── Automated health checker + latency tracker
│     Breach detected (e.g. 97.4% < 99.9%)  MongoDB audit trail
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│  4. Deterministic Credit Calculation  │◄── $100 Authorized - $25 SLA Credit = $75 Due
│     Policy Engine Flags Review        │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│  5. Operator Approves Settlement      │◄── Human review in Next.js Control Center
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│  6. PayPal Captures $75 Final Amount  │◄── PayPal Payments API v2 (final_capture: true)
│     Remaining $25 automatically freed │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│  7. Immutable Evidence Audit Trail    │◄── Tamper-evident ledger & transaction history
└───────────────────────────────────────┘
```

---

## 🏗️ System Architecture & Ports

The platform is split into four specialized microservices designed for maximum reliability and separation of concerns:

| Component | Responsibility | Tech Stack | Local Port |
| :--- | :--- | :--- | :--- |
| **Frontend** (`frontend/`) | Control Center, Live Outage Simulator, Approval UX, Audit Trail | Next.js 16 (React 19, Tailwind CSS, Motion, AG-Grid) | `http://localhost:3000` |
| **PayPal Service** (`src/`) | Payment Orchestration, Authorization Holds, Capture & Refund APIs | Node.js, Express, TypeScript, PayPal REST SDK | `http://localhost:4000` |
| **Main Backend Hub** (`backend/`) | Persistent Ledger, SLA Policy Engine, Monitoring, Approvals | Node.js, Express, TypeScript, MongoDB (Mongoose) | `http://localhost:5000` |
| **SLA Intelligence** (`sla-service/`) | PDF Contract Parsing, Groq LLM Term Extraction, Verification | Python 3, FastAPI, PDFPlumber, Groq API, Uvicorn | `http://localhost:8000` |

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js** v20+ and **npm**
- **Python** 3.10+
- **MongoDB** running locally on `mongodb://127.0.0.1:27017`

### 2. Environment Configuration
Verify the credentials in each service:
- **Root `.env`**: Contains PayPal Sandbox `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` (`PORT=4000`).
- **`backend/.env`**: Points to `MONGODB_URI=mongodb://127.0.0.1:27017/pay_for_performance`, `PAYMENT_SERVICE_URL=http://localhost:4000/api`, and `SLA_SERVICE_URL=http://localhost:8000`.
- **`sla-service/.env`**: Contains `GROQ_API_KEY` for LLM contract extraction.
- **`frontend/.env.local`**: Configured with `NEXT_PUBLIC_API_URL=http://localhost:5000`.

### 3. Seed Database
Seed MongoDB with active demo services, contracts, and metrics:
```bash
npm --prefix backend run seed
```

### 4. Start All Services in One Command
Run the root orchestrator to spin up all 4 microservices simultaneously:
```bash
npm run dev:all
```

Or run each service individually in separate terminals:
- **PayPal Service**: `npm run dev:paypal` (`http://localhost:4000`)
- **Backend Hub**: `npm run dev:backend` (`http://localhost:5000`)
- **Frontend Dashboard**: `npm run dev:frontend` (`http://localhost:3000`)
- **SLA Intelligence**: `npm run dev:sla` (`http://localhost:8000`)

---

## 🧪 Testing & Verification

Every layer contains unit and integration test suites:

- **PayPal Payment Integration Tests** (15 tests, 100% pass):
  ```bash
  npm test
  ```
- **Backend Hub & Policy Tests** (134 tests, 100% pass):
  ```bash
  npm --prefix backend test
  ```
- **Python SLA Intelligence Tests** (85 tests, 100% pass):
  ```bash
  cd sla-service && pytest
  ```
- **Frontend Next.js Production Build**:
  ```bash
  npm --prefix frontend run build
  ```

---

## 🎬 The Primary Demo Walkthrough

1. **Buyer Order & Authorization**:
   - Open `http://localhost:4000/` or trigger through the API to create a $100 authorization hold on PayPal Sandbox.
   - The buyer approves the hold via PayPal's checkout modal.
2. **Contract Extraction**:
   - Visit `http://localhost:3000/upload`.
   - Drop an SLA PDF. Groq AI parses uptime targets (e.g. 99.9%) and penalty clauses (25% credit).
3. **Simulated Outage & Breach Detection**:
   - Go to `http://localhost:3000/dashboard`.
   - Click **Simulate Outage**. Watch the uptime graph plunge below the 99.9% contractual line.
   - The deterministic rules engine detects the breach and calculates a **$25 SLA credit**.
4. **Approval & $75 Partial Capture**:
   - The Approval Card presents:
     - **SLA Credit**: `$25.00`
     - **To Capture**: `$75.00`
   - Click **Approve & capture**.
   - The backend calls the PayPal engine, capturing exactly `$75.00` with `final_capture: true`.
   - The remaining `$25.00` authorization hold is automatically released back to the buyer by PayPal.
5. **Auditing & Transaction Ledger**:
   - Visit `http://localhost:3000/transactions` to see the live PayPal authorization and capture record.
   - Visit `http://localhost:3000/audit` to view the full cryptographic, immutable audit log connecting contract terms, breach evidence, human sign-off, and PayPal settlement.
