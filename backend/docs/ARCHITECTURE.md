# Architecture

The API uses thin Express controllers, module-local services, Mongoose persistence models, Zod request validation, and shared middleware. Person 3 owns monitoring, SLA evaluation, deterministic settlement calculation, policy, approvals, and the append-only audit trail. Payment execution remains owned by Person 1 and is intentionally absent.

Financial values are persisted as MongoDB Decimal128. `paymentId` is unique, preventing duplicate settlement creation. The health endpoint exposes Mongoose's live connection state.
