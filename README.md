# Tracework API

Node.js + Express + Prisma REST API for Tracework, backed by PostgreSQL.

```
src/
├── index.ts                 # server start
├── app.ts                   # express app setup
├── config/                  # env, axios, response helpers
├── constants/
├── controllers/             # HTTP request/response
├── routes/                  # URL mapping
├── services/                # business logic
├── micro-services/          # outbound HTTP to other services
├── middlewares/
├── decorators/
├── dtos/
├── interface/
├── exceptions/
└── utils/
```

## Setup

Use a local PostgreSQL 16+ instance, or Docker:

```bash
docker compose up -d
```

Create a database named `workpulse`, then:

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

Default `DATABASE_URL` in `.env.example`:

`postgresql://postgres:postgres@localhost:5432/workpulse?schema=public`

The API listens on `http://localhost:4000`. Point the frontend at it with `VITE_API_URL=http://localhost:4000`.

## Demo login

- Email: `arun@acmetech.io`
- Password: `workpulse`

All seeded users share the same password.
