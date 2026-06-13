# Wordscodex Staging Deployment

This deployment exposes only one public port for the staging app. PostgreSQL,
Redis, and the API stay inside the Docker Compose network.

## Server Setup

Create `deployment/staging/.env` on the server:

```bash
PUBLIC_PORT=18080
PUBLIC_ORIGIN=http://192.144.129.104:18080
POSTGRES_PASSWORD=<server-only-random-value>
JWT_ACCESS_SECRET=<server-only-32-char-min-secret>
AUTH_DEV_CODE=123456
```

`AUTH_DEV_CODE` is enabled only for this HTTP staging rehearsal so the email-code
flow can be verified without an email provider. Do not set it for production.

## Commands

Run from the repository root on the server:

```bash
docker-compose --env-file deployment/staging/.env -f deployment/staging/docker-compose.yml up -d --build postgres redis
docker-compose --env-file deployment/staging/.env -f deployment/staging/docker-compose.yml run --rm api pnpm --filter @wordscodex/api db:deploy
docker-compose --env-file deployment/staging/.env -f deployment/staging/docker-compose.yml run --rm api pnpm --filter @wordscodex/api db:seed
docker-compose --env-file deployment/staging/.env -f deployment/staging/docker-compose.yml up -d --build api web
```

Verify:

```bash
curl -fsS http://192.144.129.104:18080/api/v1/health
curl -fsS http://192.144.129.104:18080/
```
