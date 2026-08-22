# Social72 CRM

Internal CRM for Social72 (digital marketing + BPO). Phase 1 is live: authentication, users/roles, clients, and navigation.

## Run locally

PostgreSQL 16 must be running. Docker Compose is optional if you already have Postgres.

```bash
# optional
docker compose up -d

copy .env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login)

- Email: `nathan.k@example.net`
- Password: `ChangeMe!Social72` (change after first login)

Public registration is disabled. Super Admin creates users from **Users**.

## Docs

| File | Contents |
| --- | --- |
| [docs/SPEC.md](docs/SPEC.md) | Product source of truth |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack and roadmap |
| [docs/database-schema.sql](docs/database-schema.sql) | Original SQL proposal (Prisma is canonical now) |
