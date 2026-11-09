# Pay-for-Performance — PayPal Payment Integration Module

**Pay-for-Performance** is an AI-powered SLA-based payment settlement platform.
This repository contains the production-grade **PayPal Payment Integration Module** (Person 1's deliverable), responsible for payment lifecycle orchestration, authorization holds, deterministic SLA settlement captures, partial refunds, database-level idempotency, and audit trails.

---

## 🎯 The Core Demo Scenario

```text
[ Client Signs Contract ]
            │
            ▼
[ Create $100 Order (intent=AUTHORIZE) ]
            │
            ▼
[ Buyer Approves in PayPal Sandbox ]
            │
            ▼
[ Authorize Payment Hold ($100 Authorized) ]
            │
            ▼
[ Person 3 SLA Engine calculates SLA credits: $25 ]
            │
            ▼
[ Approved Settlement Contract: Capture $75 ]
            │
            ▼
[ PayPal API v2 Capture: $75 final_capture ]
            │
            └─► $75 paid to provider, remaining $25 hold automatically released to client!
```

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v18+)
- **Language**: TypeScript (ES2022 / NodeNext modules)
- **Framework**: Express.js
- **HTTP Client**: Axios (with centralized error handling & OAuth token caching)
- **Database**:
  - Out-of-the-box: Embedded ACID transactional database (`./data/pay_for_performance.json`) with zero external service dependencies.
  - Production ready: PostgreSQL DDL schema with foreign keys, indexes, and unique constraints located in [`db/schema.sql`](file:///c:/Users/paras/OneDrive/Desktop/Pay-for-Performance/db/schema.sql).
- **Validation**: Zod schema validation
- **Testing**: Node.js native test runner (`node:test`, `node:assert`, `tsx`)

---

## 📁 Repository Structure

```
Pay-for-Performance/
├── .env.example                                      # Environment variable template
├── .gitignore                                        # Ignored files (node_modules, dist, db files)
├── package.json                                      # Dependencies & build scripts
├── tsconfig.json                                     # TypeScript configuration
├── Pay_for_Performance_PayPal_API.postman_collection.json # Postman v2.1 collection
├── db/
│   └── schema.sql                                    # PostgreSQL DDL migrations & indexes
├── src/
│   ├── app.ts                                        # Express application configuration
│   ├── server.ts                                     # Server bootstrap & graceful shutdown
│   ├── config/
│   │   └── env.ts                                    # Zod-validated configuration
│   ├── controllers/
│   │   ├── payment-controller.ts                     # Payment lifecycle endpoint handlers
│   │   ├── settlement-controller.ts                  # Person 3 SLA intake endpoint handlers
│   │   └── webhook-controller.ts                     # PayPal Webhook verification & handler
│   ├── middleware/
│   │   ├── error-handler.ts                          # Centralized error handler & status mapping
│   │   └── validate.ts                               # Zod request validators
│   ├── repositories/
│   │   └── database.ts                               # Transactional storage & idempotency engine
│   ├── routes/
│   │   ├── index.ts                                  # Router index & health check
│   │   ├── payment-routes.ts                         # /api/payments routes
│   │   └── settlement-routes.ts                      # /api/settlements routes
│   ├── services/
│   │   ├── payment-service.ts                        # Payment business logic & state machine
│   │   ├── paypal-client.ts                          # Axios client, OAuth token cache & errors
│   │   ├── paypal-service.ts                         # Raw PayPal Orders & Payments API v2
│   │   └── webhook-service.ts                        # PayPal webhook verification
│   └── types/
│       ├── payment.ts                                # Internal domain records & contracts
│       └── paypal.ts                                 # PayPal API v2 schemas
└── tests/
    ├── api-routes.test.ts                            # HTTP API endpoint integration tests
    ├── payment-lifecycle.test.ts                     # Complete payment lifecycle tests
    └── settlement-validation.test.ts                 # Person 3 settlement contract & idempotency tests
```

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- Node.js v18 or later
- npm or pnpm

### 2. Installation
```bash
git clone <repo-url>
cd Pay-for-Performance
npm install
```

### 3. Environment Configuration
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

Populate your PayPal Sandbox credentials:
```env
PORT=3000
NODE_ENV=development

PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com

PAYPAL_RETURN_URL=http://localhost:3000/api/payments/return
PAYPAL_CANCEL_URL=http://localhost:3000/api/payments/cancel
```

> **Where to get PayPal Sandbox Credentials:**
> 1. Log in to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox).
> 2. Create or select a Sandbox App.
> 3. Copy the **Client ID** and **Secret Key**.
> 4. In **Sandbox Accounts**, get the Personal Sandbox account credentials to log in as the buyer during testing.

### 4. Build and Run
```bash
# Build TypeScript
npm run build

# Start production server
npm start

# Or run in live watch mode for development
npm run dev
```

### 5. Run Automated Tests
```bash
npm test
```
Runs all 15 automated integration and unit test cases verifying orders, authorizations, Person 3 settlement validations, $75 SLA captures, $25 partial refunds, database-level idempotency, and error handling.

---

## 📡 API Endpoints Reference

### Base URL: `http://localhost:3000/api`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health status |
| `POST` | `/payments/create-order` | Create a $100 authorization order on PayPal |
| `POST` | `/payments/:orderId/authorize` | Authorize payment hold after buyer approval |
| `POST` | `/payments/:paymentId/capture` | Capture approved SLA settlement amount ($75) |
| `POST` | `/payments/:paymentId/refund` | Refund captured amount (supports partial refunds) |
| `GET` | `/payments/:paymentId` | Retrieve full payment status, captures, refunds & audit logs |
| `POST` | `/settlements` | Stage an SLA settlement from Person 3's engine |
| `GET` | `/settlements/:settlementId` | Get staged or executed settlement record |
| `POST` | `/webhooks/paypal` | Ingest and verify PayPal Webhook events |

---

## 🔄 End-to-End Walkthrough (The $100 → $25 Credit → $75 Capture Flow)

### Step 1: Create $100 Payment Order
```http
POST /api/payments/create-order
Content-Type: application/json
Idempotency-Key: req-001

{
  "amount": 100.00,
  "currency": "USD",
  "description": "SLA Cloud Hosting Contract #SC-2024-001",
  "metadata": {
    "contractId": "SC-2024-001",
    "slaUptime": "99.9%"
  }
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "paymentId": "PAY-1730730000000-8F32BA1C",
    "orderId": "5O190127TN364715T",
    "approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T",
    "amount": 100,
    "currency": "USD",
    "status": "APPROVAL_PENDING"
  }
}
```

### Step 2: Buyer Approves in PayPal Sandbox
1. Open the returned `approvalUrl` in your browser.
2. Log in using your PayPal Personal Sandbox buyer credentials.
3. Click **Continue** to approve authorizing $100.00.
4. You will be redirected to `http://localhost:3000/api/payments/return?token=5O190127TN364715T&PayerID=...`.

### Step 3: Authorize the Order
```http
POST /api/payments/5O190127TN364715T/authorize
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "PAY-1730730000000-8F32BA1C",
    "orderId": "5O190127TN364715T",
    "authorizationId": "2C279288R6874943E",
    "status": "AUTHORIZED",
    "authorizedAmount": 100,
    "capturedAmount": 0,
    "refundedAmount": 0,
    "currency": "USD"
  }
}
```

### Step 4: Person 3 Stages Approved SLA Settlement
Person 3's SLA calculation engine determines that downtime incurred a **$25.00** SLA credit, resulting in a **$75.00** net approved capture:

```http
POST /api/settlements
Content-Type: application/json

{
  "settlementId": "SET-001",
  "paymentId": "PAY-1730730000000-8F32BA1C",
  "authorizedAmount": "100.00",
  "creditAmount": "25.00",
  "captureAmount": "75.00",
  "currency": "USD",
  "decision": "APPROVED",
  "approvedBy": "sla-policy-engine-v1"
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "message": "Settlement contract staged successfully.",
  "data": {
    "settlementId": "SET-001",
    "paymentId": "PAY-1730730000000-8F32BA1C",
    "authorizedAmount": "100.00",
    "creditAmount": "25.00",
    "captureAmount": "75.00",
    "decision": "APPROVED",
    "status": "STAGED"
  }
}
```

### Step 5: Capture Approved Settlement Amount ($75)
The client frontend triggers capture by providing only the `settlementId`. The backend retrieves and validates the trusted settlement from the database:

```http
POST /api/payments/PAY-1730730000000-8F32BA1C/capture
Content-Type: application/json
Idempotency-Key: capture-SET-001

{
  "settlementId": "SET-001"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "PAY-1730730000000-8F32BA1C",
      "status": "CAPTURED",
      "authorizedAmount": 100,
      "capturedAmount": 75,
      "refundedAmount": 0
    },
    "settlement": {
      "settlementId": "SET-001",
      "status": "EXECUTED",
      "executedAt": "2026-11-04T15:50:00.000Z"
    },
    "capture": {
      "id": "CAP-1730730100000-A1B2C3D4",
      "paypalCaptureId": "77A91288R6874943E",
      "amount": 75,
      "currency": "USD",
      "status": "COMPLETED",
      "finalCapture": true
    }
  }
}
```

*(Because `final_capture: true` is passed to PayPal, PayPal captures $75 and immediately releases the remaining $25 hold back to the buyer).*

### Step 6 (Optional): Post-Settlement Partial Refund ($25)
```http
POST /api/payments/PAY-1730730000000-8F32BA1C/refund
Content-Type: application/json

{
  "amount": 25.00,
  "reason": "Secondary SLA concession credit"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "PAY-1730730000000-8F32BA1C",
      "status": "PARTIALLY_REFUNDED",
      "capturedAmount": 75,
      "refundedAmount": 25
    },
    "refund": {
      "paypalRefundId": "9XY1234567890",
      "amount": 25,
      "currency": "USD",
      "status": "COMPLETED"
    }
  }
}
```

---

## 🔒 Reliability, Security & Idempotency

1. **Database-Level Idempotency**:
   - Every capture and refund operation uses an idempotency key lock.
   - If a duplicate request arrives while processing, the system rejects it with `409 Conflict`.
   - If an operation has already succeeded, the system safely replays the cached 200 response without duplicating PayPal calls.
   - If network failure occurs, the lock is released to permit retries.
2. **PayPal-Request-Id Support**:
   - Idempotency headers are passed directly to PayPal's REST APIs in `PayPal-Request-Id`.
3. **No Frontend Trust**:
   - The frontend cannot set the capture amount. Only the approved settlement registered by Person 3 in the server database determines the capture amount.
4. **State Machine Integrity**:
   - `CREATED` ➔ `APPROVAL_PENDING` ➔ `AUTHORIZED` ➔ `CAPTURED` ➔ `PARTIALLY_REFUNDED` / `REFUNDED`.
   - Cannot capture an unauthorized or already captured payment.
   - Cannot refund more than the captured balance.
5. **Credential Security**:
   - `PAYPAL_CLIENT_SECRET` is kept strictly server-side and never returned in API responses.
   - OAuth tokens are cached in memory and automatically refreshed before expiry.

---

## 🧠 SLA Intelligence Service (Person 2)

A small Python service in [`sla-service/`](sla-service) that reads an SLA PDF and returns its measurable commitments as validated JSON. An LLM on Groq (`openai/gpt-oss-120b`, strict JSON mode) reads the contract, and plain code checks the answer: every quote must be on its cited page, every number must be in its quote, and credit tiers must make sense. Any failed check or vague clause sets `validation.status` to `needs_review`. It never outputs dollar amounts.

### Run it
```bash
cd sla-service
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # macOS/Linux: .venv/bin/python
cp .env.example .env                                      # then paste your key from https://console.groq.com/keys
.venv/Scripts/python -m uvicorn main:app --reload --port 8000
```

### Try it
```bash
curl -F "file=@../samples/tiered_sla.pdf" http://localhost:8000/sla/extract
```

| Status | Meaning |
|---|---|
| `200` | Extracted. Check `validation.status` before using the values. |
| `413` | The PDF is over 10 MB. |
| `422` | Not a readable PDF, a scanned PDF with no text, over 50 pages, or no file sent. |
| `502` | The LLM failed or returned an unusable answer. Try again. |

### Test it
```bash
.venv/Scripts/python -m pytest          # no API key needed
.venv/Scripts/python live_check.py      # uses the real Groq model and your free quota
```

`samples/tiered_sla.pdf` is the demo contract: 97% uptime falls in the 25% credit tier.

### Buyer agent
The agent reads the SLA for each offer in [`sla-service/offers.json`](sla-service/offers.json) with the LLM, then picks one in plain code. It skips any SLA that needs review, is over budget, or promises too little uptime, and then prefers the most credit protection and the lowest price. It creates the PayPal order through the payments API, and a person approves it in the PayPal sandbox.

```bash
cd sla-service
.venv/Scripts/python buyer_agent.py buy --budget 110 --dry-run       # shows the choice and the requests, sends nothing
.venv/Scripts/python buyer_agent.py buy --budget 110 --service-id <backend service id>
.venv/Scripts/python buyer_agent.py authorize <orderId> --contract-id <contract id>
```

With `--service-id`, the agent also registers the SLA as a Draft contract with the backend at `POST /api/sla/contracts`, and `authorize` activates it once the payment hold is placed. The PayPal order's `metadata.contract_reference` matches the contract's `contractReference`, which links the money to the clause. Set `PAYMENTS_API_URL` (default `http://localhost:3000/api`) and `BACKEND_API_URL` (default `http://localhost:5000/api`) in `sla-service/.env` if the servers run elsewhere.

**Note for the backend:** the settlement engine adds up every credit rule that matches, so [`to_contract.py`](sla-service/to_contract.py) sends each uptime tier as the extra percentage on top of the tier before it (10%, +15%, +25%). At 97% uptime the matching rules add up to 25%, so $100 becomes $75. If the engine changes to apply only the highest matching tier, `to_contract.py` must change too. Latency targets and exclusions aren't sent, because the backend measures average latency (not p95) and has no field for exclusions.

---

## 📮 Postman Collection

Import `Pay_for_Performance_PayPal_API.postman_collection.json` into Postman:
- Automated collection variables (`{{paymentId}}`, `{{orderId}}`, `{{authorizationId}}`, `{{captureId}}`) automatically propagate between requests.
- Run requests 0 through 7 sequentially to experience the entire lifecycle.
