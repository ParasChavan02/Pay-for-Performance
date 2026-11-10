# Deployment Guide — Pay-for-Performance

This document outlines deployment strategies for all microservices in the Pay-for-Performance platform.

---

## 1. Environment Configurations

| Service | Host Port | Env File | Key Environment Variables |
| :--- | :--- | :--- | :--- |
| **`apps/web`** | 3000 | `apps/web/.env.local` | `NEXT_PUBLIC_API_URL` |
| **`apps/api`** | 5000 | `apps/api/.env` | `MONGODB_URI`, `PAYMENT_SERVICE_URL`, `SLA_SERVICE_URL` |
| **`apps/payments`** | 4000 | `apps/payments/.env` | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL` |
| **`apps/sla-service`**| 8000 | `apps/sla-service/.env` | `GROQ_API_KEY`, `GROQ_MODEL` |

---

## 2. Cloud Hosting (Render / Railway / Cloud Run)

### Web (Next.js)
- **Build Command**: `npm --prefix apps/web run build`
- **Start Command**: `npm --prefix apps/web run start`
- **Environment**: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`

### Main API (Node.js Express)
- **Build Command**: `npm --prefix apps/api run build`
- **Start Command**: `node apps/api/dist/server.js`
- **Environment**: Set `MONGODB_URI` (Atlas), `PAYMENT_SERVICE_URL`, `SLA_SERVICE_URL`.

### Payments Engine (Express)
- **Build Command**: `npm --prefix apps/payments run build`
- **Start Command**: `node apps/payments/dist/server.js`
- **Environment**: Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`.

### SLA Intelligence (FastAPI)
- **Build Command**: `pip install -r apps/sla-service/requirements.txt`
- **Start Command**: `cd apps/sla-service && uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Environment**: Set `GROQ_API_KEY`.
