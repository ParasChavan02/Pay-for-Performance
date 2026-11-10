# MongoDB Infrastructure Guide — Pay-for-Performance

This guide covers local MongoDB deployment with Docker Compose, connecting `apps/api`, and switching between local MongoDB and MongoDB Atlas.

---

## 1. Local MongoDB with Docker Compose

A pre-configured Docker Compose file is located at `infra/mongodb/docker-compose.yml`.

### Starting the Database
From the root directory:
```bash
docker compose -f infra/mongodb/docker-compose.yml up -d
```

### Stopping the Database
```bash
docker compose -f infra/mongodb/docker-compose.yml down
```

### Data Persistence
Data is persistently stored in the named Docker volume `p4p_mongodb_data`. Your data remains safe across container restarts. To completely wipe the local database volume:
```bash
docker compose -f infra/mongodb/docker-compose.yml down -v
```

---

## 2. API Connection Configuration

The main API (`apps/api`) reads its connection string from the `MONGODB_URI` environment variable in `apps/api/.env`.

### Local Docker Connection String
```env
MONGODB_URI=mongodb://127.0.0.1:27017/pay_for_performance
```

### MongoDB Atlas Cloud Connection String
For production or cloud hackathon testing:
```env
MONGODB_URI=mongodb://<user>:<password>@<shard-00>:27017,<shard-01>:27017,<shard-02>:27017/pay_for_performance?ssl=true&replicaSet=<replicaSet>&authSource=admin&retryWrites=true&w=majority
```

---

## 3. Database Seeding & Verification

To populate the database with demonstration services, contracts, and metric history:
```bash
npm run seed
```

---

## 4. Running Backend Tests

Backend tests in `apps/api` run against MongoDB in-memory / mocked connection or live test database:
```bash
npm --prefix apps/api test
```
All 134 automated unit and integration tests will execute.
