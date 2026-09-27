# Our Universe

Hassan's world, Whitney's world, and the story they're writing together, plus live discoveries from the real world.

```
                 OUR UNIVERSE
                      │
        ┌─────────────┼─────────────┐
     HASSAN        OUR STORY      WHITNEY
   software        memories      biotechnology
   technology      plans         birds
   philosophy      milestones    knitting
   nature          discoveries   nature · environment
        └─────────────┼─────────────┘
               SHARED DISCOVERY
            LIVE REAL-WORLD TRENDS
```

## What's inside

| Area | Where |
| --- | --- |
| Our Story: memories, milestones, adventures, plans, saved discoveries | `/story` |
| Each person's world: profile, dashboard, journal, radar, skills, Knowledge Vault | `/world/[slug]` |
| Hassan only: Things I'm Building, Questions I'm Thinking About | `/world/hassan/projects`, `/world/hassan/thinking` |
| For You (interleaves every followed topic; favourite topics get double space) | `/discover` |
| Topic feeds with category filters: software, technology, philosophy, nature, biotech, birds, knitting, environment | `/discover/[topic]` |
| Something We Both Might Like: items touching both a technology and a life-science thread | `/discover/together` |
| Things We Are Learning (shared) | `/learning` |
| Weekly digest (any past week) | `/digest` |
| Global search | `/search` |
| Personalisation: interests, favourite topics, muted/starred sources, hidden categories and keywords | `/settings` |
| Opt-in public profile (public skills and projects only) | `/p/[slug]` |
| Source health | `/discover/sources` |

### Names

Her name is **Whitney**, and that is what every profile, route and heading uses. "Sumaiya" is a pet name Hassan gave her. It lives only in her optional `nickname` field, which she can edit or clear, and it never appears on public pages.

### Privacy

Everything personal has a visibility: 🔒 **private** (owner only), 💞 **shared** (the two of you), or 🌍 **public** (only on an enabled public profile). Vault and thinking-journal entries default to private. The rule is implemented once, in `visibleTo()` (`src/lib/context.ts`), and every read goes through it.

## The Live Trends Engine

```
Source registry (sources.ts) → adapter (RSS/Atom, iNaturalist) → normalise
→ quality filter → deduplicate (normalised URL) → categorise + tag (topics.ts)
→ Postgres → keyset-paginated API (/api/trends) → React Query infinite feed
```

- **Real data only.** 39 sources were checked on 2026-09-27 to be current. An item without a date is dropped rather than shown with a guessed freshness. Items older than a year are skipped, and future timestamps are clamped to now.
- **Honest freshness.** A feed shows **Live** only if its sources publish through the day, were checked in the last 2 hours, and delivered something in the last 24 hours. Otherwise it shows "Sources update daily" and when they were last checked. Cards show relative and absolute publish dates, with the retrieval date on hover and on the detail page.
- **Never on page load.** Pages read only from the database. The scheduled job fetches, and if it stalls, the next visitor's request schedules a short background refresh (`after()`) for sources that are due. Visitors never wait on external APIs.
- **Failure handling.** Sources are claimed atomically, so overlapping runs never double-fetch. Failures back off exponentially (capped at a day) and honour `Retry-After`. The UI shows *"Some discoveries are temporarily unavailable. Your saved content is still here."* with cached content still in place.
- **Attribution and licensing.** We store a title, a ≤280-character excerpt, metadata and a link, never the full article. Images appear only where reuse is clearly allowed: NASA (public domain) and iNaturalist photos under CC licences, each with its credit and licence shown. Every other card uses the topic's own artwork.
- **Quality.** Sources are tiered (official organisations → universities → research institutions → journals → …), and a filter drops coupon, deal and gift-guide posts.
- **Adding a source:** append one line to `src/lib/trends/sources.ts`. **Changing categories:** edit `src/lib/trends/topics.ts`, then run `npm run retag` to re-apply the rules to stored items.

## Run it locally

```bash
npm install
npm run seed            # creates Hassan, Whitney, interests, Hassan's verified skills & projects
npm run ingest -- --force
npm run dev
```

No database setup is needed: without `DATABASE_URL`, an embedded Postgres (PGlite) lives in `.data/`. It allows one process at a time, so stop `npm run dev` before running `seed`, `ingest` or `retag`. The passcodes the seed generated are in `.env.local`.

```bash
npm test          # engine + visibility unit tests
npm run typecheck
npm run lint
```

## Deploy for free (no card)

See [`DEPLOY.md`](DEPLOY.md).

## Where Hassan's profile facts come from

His skills (with his own 1–5 self-ratings and the evidence behind each), projects and introduction come from his public portfolio (hassan200503.github.io) and public GitHub repositories. Nothing was invented, and no contact details are included. Whitney's profile starts almost empty on purpose, for her to write.
