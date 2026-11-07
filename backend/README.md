# Pay-for-Performance backend

Production-oriented Node.js, Express, TypeScript, MongoDB foundation for verified service-performance settlements.

## Stack

Express, Mongoose, Zod, Helmet, CORS, Morgan, Swagger/OpenAPI, Jest, Supertest, and tsx.

## Setup

1. `cd backend`
2. `npm install`
3. Copy `.env.example` to `.env` and set `MONGODB_URI` (the included `.env` is local-only and ignored by Git).
4. `npm run dev`

Use `npm run build`, `npm start`, `npm test`, and `npm run seed` as needed. Swagger is at `http://localhost:5000/api-docs`.

## Architecture

`src/modules` isolates services, monitoring, SLA, settlement, policy, approvals, and audit concerns; controllers are deliberately thin and validation lives beside modules. Details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Initial endpoints

`GET /`, `GET /api/health`, services (`/api/services`), monitoring (`/api/monitoring`), SLA (`/api/sla`), settlements (`/api/settlements`), policy (`/api/policy/evaluate`), approvals (`/api/approvals/pending`, settlement approve/reject), and settlement audit (`/api/settlements/:id/audit`). Business routes are intentional 501 placeholders until later stages.

## Team boundaries

Person 3 owns monitoring, SLA evaluation, settlement calculations, policy, approvals, and audit. Person 1 owns PayPal authorization/capture/refunds. Person 2 owns AI SLA extraction. Person 4 owns the frontend.
