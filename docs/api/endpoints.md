# API Specification — Pay-for-Performance

This document lists all active API endpoints across the platform.

---

## 1. Web Application (`apps/web` — Port 3000)

| Route | Description |
| :--- | :--- |
| `GET /` | Marketing & Platform Narrative |
| `GET /upload` | SLA PDF Contract Upload & AI Verification |
| `GET /dashboard` | Live Performance Monitor, Outage Simulation & Approval Card |
| `GET /transactions` | Live PayPal Settlement Ledger |
| `GET /audit` | Evidence-to-Payment Chronological Audit Trail |

---

## 2. Main API Hub (`apps/api` — Port 5000)

All routes are prefixed with `/api`.

### System Health
- `GET /api/health`: Returns server status, uptime, and MongoDB connectivity state.

### Services Management
- `POST /api/services`: Registers a new monitored service.
- `GET /api/services`: Lists all active monitored services.
- `GET /api/services/:id`: Retrieves service metadata by ID.
- `PATCH /api/services/:id`: Updates service thresholds.
- `DELETE /api/services/:id`: Soft-deletes a monitored service.

### Monitoring & Metrics
- `POST /api/monitoring/:serviceId/check`: Executes an immediate synthetic health check.
- `GET /api/monitoring/:serviceId/latest`: Retrieves the most recent performance metric.
- `GET /api/monitoring/:serviceId/summary`: Retrieves rolling uptime percentage & latency summary.
- `GET /api/monitoring`: Lists recent performance metrics.

### SLA Contracts & Breaches
- `POST /api/sla/contracts`: Registers an SLA contract for a service.
- `GET /api/sla/contracts/:id`: Retrieves SLA terms and credit tiers.
- `POST /api/sla/evaluate/:contractId`: Deterministically evaluates metrics against contractual SLA terms.
- `GET /api/sla/breaches`: Lists detected SLA breaches.
- `POST /api/sla/extract`: Reverse-proxy stream forwarding PDF files to Python SLA Intelligence.

### Financial Policy Engine
- `POST /api/policies`: Registers or updates policy rules (e.g. threshold caps, review triggers).
- `GET /api/policies`: Lists all configured policies.
- `POST /api/policies/evaluate/:settlementId`: Evaluates a calculated settlement against policy rules.

### Approvals
- `GET /api/approvals/pending`: Lists settlements pending human review.
- `POST /api/approvals/:id/approve`: Approves a pending settlement and triggers PayPal capture.
- `POST /api/approvals/:id/reject`: Rejects settlement and blocks capture.

### Settlement Engine
- `POST /api/settlements/calculate`: Deterministically computes contractual SLA credits.
- `GET /api/settlements`: Lists past and current settlements.
- `GET /api/settlements/:id`: Retrieves specific settlement breakdown.
- `POST /api/settlements/:id/approve`: Direct approval and PayPal capture execution.

### Transactions & Ledger
- `GET /api/transactions`: Lists all PayPal payment authorizations and captures.
- `GET /api/audit`: Returns global chronological tamper-evident audit logs.
- `GET /api/settlements/:id/audit`: Retrieves audit history for a specific settlement.

---

## 3. PayPal Payments Engine (`apps/payments` — Port 4000)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | GET | Payment service status. |
| `/api/payments/create-order` | POST | Creates a PayPal order with `intent: AUTHORIZE`. |
| `/api/payments/:orderId/authorize` | POST | Authorizes an approved PayPal order. |
| `/api/settlements` | POST | Stages approved settlement from Person 3. |
| `/api/payments/:paymentId/capture` | POST | Captures approved net settlement with `final_capture: true`. |
| `/api/payments/:paymentId/refund` | POST | Executes a partial refund on a captured settlement. |
| `/api/payments/:paymentId` | GET | Retrieves full payment status and audit trail. |

---

## 4. SLA Intelligence Service (`apps/sla-service` — Port 8000)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/health` | GET | FastAI / Groq service health. |
| `/sla/extract` | POST | Ingests PDF bytes via multipart form and returns validated SLA JSON commitments. |
