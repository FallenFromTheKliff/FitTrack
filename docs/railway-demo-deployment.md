# FitTrack Railway Demo Deployment

This repo is ready for a professor demo on Railway with four services:

- `web`
- `api`
- `Postgres`
- `Redis`

## Service Source

Use the repository root as the source for both compute services, then set each service's custom Config-as-Code path:

- API: `/apps/api/railway.toml`
- Web: `/apps/web/railway.toml`

Those config files point Railway at the correct Dockerfiles from the monorepo root.

## Required Railway Variables

Set these on the `api` service:

- `PORT=3001`
- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `REDIS_HOST=${{Redis.REDISHOST}}`
- `REDIS_PORT=${{Redis.REDISPORT}}`
- `REDIS_PASSWORD=${{Redis.REDISPASSWORD}}`
- `WEB_ALLOWED_ORIGINS=https://${{web.RAILWAY_PUBLIC_DOMAIN}}`
- `JWT_SECRET=<strong-secret>`

Set these on the `web` service:

- `PORT=8080`
- `HOSTNAME=::`
- `NEXT_PUBLIC_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}/v1`

Optional compatibility variables:

- `WEB_ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080`
- `REDIS_URL=<redis://...>` as an alternative to `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`

## Demo Credentials

The bootstrap script now ensures two email/password accounts:

- Admin: `sertfitadmin@gmail.com` / `aNYTIMEaNYWHERE2@`
- Demo member: `member.demo.fittrack@gmail.com` / `Password1!`

The API pre-deploy step runs schema push plus bootstrap so both accounts are recreated idempotently on each Railway deploy.

## Demo Checks

- `https://<api-domain>/v1/health`
- `https://<api-domain>/v1/docs`
- `https://<web-domain>/login`
- Demo member login and profile update flow
- Admin login

## Not In Scope For This Demo

- Native mobile release
- Prometheus and Grafana
- Avatar uploads unless Cloudflare R2 secrets are configured
- Google OAuth, Twilio, PayMongo, and AI features unless their secrets are configured
