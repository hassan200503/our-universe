# Deploying Our Universe for free (no credit card)

This uses the same cardless services as RentManager: **Neon** (Postgres), **Netlify** (the website) and **GitHub Actions** (the scheduled trend refresh).

> Free-tier limits change. Before relying on them, re-check each provider's current pricing page: Neon's free plan, Netlify's free plan (function timeouts, build minutes), and GitHub Actions minutes for **private** repositories.

## 1. Database: Neon

1. Sign up at neon.tech with GitHub (no card).
2. Create a project, then copy the **pooled** connection string (`…-pooler…/neondb?sslmode=require`).
3. From your machine, run the migrations and seed against it:

   ```bash
   DATABASE_URL="postgres://…" SEED_HASSAN_PASSCODE="…" SEED_WHITNEY_PASSCODE="…" npm run db:migrate
   DATABASE_URL="postgres://…" SEED_HASSAN_PASSCODE="…" SEED_WHITNEY_PASSCODE="…" npm run seed
   DATABASE_URL="postgres://…" npm run ingest -- --force
   ```

   Choose the two passcodes yourselves and share Whitney's with her privately.

Neon's free compute scales to zero when idle, so the first visit after a quiet spell takes a second or two longer. Unlike Render's free Postgres, your data is not deleted.

## 2. Website: Netlify

1. Push this repository to a **private** GitHub repo.
2. In Netlify, choose **Add new site → Import from Git** and select the repo. Netlify detects Next.js automatically.
3. Under **Site configuration → Environment variables**, add:
   - `DATABASE_URL`: the Neon pooled string
   - `SESSION_SECRET`: 32+ random characters (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`)
   - `CRON_SECRET`: another random string (only needed if you use the HTTP trigger)
4. Deploy. You get a free `*.netlify.app` address; a custom domain is optional and is the only thing here that costs money.

## 3. Live trends: GitHub Actions

`.github/workflows/ingest.yml` runs every 2 hours. It checks out the code and runs `npm run ingest` directly against Neon, so no web-function timeout applies.

1. In GitHub, go to **Settings → Secrets and variables → Actions** and add `DATABASE_URL`.
2. Open **Actions → Ingest trends → Run workflow** once to confirm it works.

Each run takes about 2 minutes, roughly 720 minutes a month at this schedule. Keep that inside your private-repo free minutes; if you need headroom, change the cron to every 3 hours. As a backup, the site also refreshes due sources on its own when a visitor arrives after a gap.

### Optional HTTP trigger

`GET/POST /api/cron/ingest` with `Authorization: Bearer $CRON_SECRET` runs one short (8-second) batch. Any source it doesn't reach stays due for the next call. A free cron-job.org job can call it hourly as a second heartbeat.

## Costs

Nothing in this setup costs money. The only optional paid item is a custom domain.
