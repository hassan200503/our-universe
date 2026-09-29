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
| Home: the night stage with a journey verse that changes on every visit, a live journey clock, the road ahead, a moment from your journey | `/` |
| Messages: typing indicator, sent / delivered / read ticks, swipe or hold to reply, reactions, edit, delete for me or for everyone | `/together/chat` |
| Voice and video calls, from Messages, the partner menu in the header, or the home page | anywhere |
| Together room: listen and watch in sync, with the chat beside you; it keeps playing (as a mini-player) through Messages, calls and the rest of the site | `/together` |
| Our Story: memories, milestones, adventures, plans, saved discoveries | `/story` |
| Each person's world: profile, dashboard, journal, radar, skills, Knowledge Vault | `/world/[slug]` |
| Hassan only: Things I'm Building, Questions I'm Thinking About | `/world/hassan/projects`, `/world/hassan/thinking` |
| For You (interleaves every followed topic; favourite topics get double space) | `/discover` |
| Topic feeds with category filters: software, technology, philosophy, nature, biotech, birds, knitting, environment | `/discover/[topic]` |
| Something We Both Might Like: items touching both a technology and a life-science thread | `/discover/together` |
| Things We Are Learning (shared) | `/learning` |
| Research: real studies read and cited, step-by-step lessons with a quiz, or the simple version; share threads with each other | `/research` |
| Weekly digest (any past week) | `/digest` |
| Global search | `/search` |
| Personalisation: interests, favourite topics, muted/starred sources, hidden categories and keywords | `/settings` |
| Opt-in public profile (public skills and projects only) | `/p/[slug]` |
| Source health | `/discover/sources` |

### Names

Her name is **Whitney**, and that is what every profile, route and heading uses. "Sumaiya" is a pet name Hassan gave her. It lives only in her optional `nickname` field, which she can edit or clear, and it never appears on public pages.

### Privacy

Everything personal has a visibility: 🔒 **private** (owner only), 💞 **shared** (the two of you), or 🌍 **public** (only on an enabled public profile). Vault and thinking-journal entries default to private. The rule is implemented once, in `visibleTo()` (`src/lib/context.ts`), and every read goes through it.

## Messages and calls

- **Messages** live in their own table (`messages`), so replies, reactions, edits and "delete for everyone" keep their place in the conversation. Clients poll `/api/chat?since=…` every 1.5 s while you're both online (4 s otherwise, paused in the background). Each send carries an id made on the device, so a retry is stored once.
- **Typing and receipts** come from `chat_state`: `typing_until` for the dots, `last_delivered_id` (set when a partner's device fetches) and `last_read_id` (set while the chat is on screen) for ✓, ✓✓ and blue ✓✓.
- **Calls** are peer-to-peer WebRTC: audio and video go directly between the two browsers, encrypted end to end. The server only relays the handshake (`calls`, `call_signals`) through `/api/call`. Every call negotiates both audio and video, so turning the camera on mid-call is instant; a data channel carries mute, camera and hang-up; the caller restarts ICE when a network changes. Calls ring anywhere on the site within a few seconds (the pulse checks in every 3 s while your partner is online), and each call leaves a line in the chat.
- **Alerts like a phone's messenger** use Web Push (`public/sw.js`): calls ring (and keep ringing every few seconds until answered, declined or missed) and messages pop up, even when the site is closed or nobody is signed in on that device. After signing in on a new device, a "Stay within reach" sheet asks to turn them on (on iPhone it shows the Add to Home Screen steps first); Settings → Calls & alerts and a banner in Messages do the same. Subscriptions refresh on every visit and survive signing out. "Decline" on a call notification carries a signed token, so it works on a signed-out device; "Answer" opens the call (through sign-in if needed). The app icon shows the unread count. VAPID keys are derived from the session secret, so there is nothing to configure.

## Research

- **Ask anything** at `/research` in one of three modes: *Research studies* (finds papers in [OpenAlex](https://openalex.org), a free index of 250M+ scholarly works, and has Gemini synthesise them with numbered citations that open each study), *Learn it* (a step-by-step lesson ending in a self-check) and *Explain simply*. Answers stream in as they're written, with three follow-up questions to go further.
- **Threads** keep the conversation, so follow-ups have context. Share a thread and it appears in your partner's Research too; they can read it and ask follow-ups. **Quiz me** writes five multiple-choice questions on what a thread covered. **Save to learning** keeps an answer in Things We Are Learning.
- **Gemini** (`src/lib/research/gemini.ts`) tries each model in `GEMINI_MODELS` until one answers, first with Google Search grounding, then without; a model that says "busy" waits at the back of the queue for a minute. When grounding is used, Google's search suggestions are shown with the answer, as Google requires.
- **Keys** come from `GEMINI_API_KEY`, or from Settings → AI research, where the key is checked with Google and stored sealed (AES-256-GCM) in the `kv` table (`src/lib/settings.ts`). The call relay in Settings → Call relay is stored the same way. Neither ever reaches the browser.

## Listening together

- **One player for the whole site.** The room's player lives in the root layout (`src/components/together/room-provider.tsx`), so opening Messages, taking a call or visiting any page never stops the music: outside the room it becomes a mini-player (play/pause for both, back to the room, stop on this device). During a call the music drops to 20% volume.
- **Staying in step.** The server keeps `{playing, position, updatedAt}`; play/pause/seek carry the moment they happened, so request travel time doesn't put anyone behind. Each phone estimates the server clock from its fastest recent round trips, never lets an older reply undo a newer state, and closes gaps by playing up to 5–10% faster or slower. It jumps only for large gaps, never while buffering, only into audio already downloaded (unless far behind), and backs off on slow connections. "Ended" names the state version it judged, so a stale report can't stop a track that was just restarted.

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
npm test          # engine, visibility, journey clock, verse rotation and chat formatting tests
npm run typecheck
npm run lint
```

## Deploy for free (no card)

See [`DEPLOY.md`](DEPLOY.md).

## Where Hassan's profile facts come from

His skills (with his own 1–5 self-ratings and the evidence behind each), projects and introduction come from his public portfolio (hassan200503.github.io) and public GitHub repositories. Nothing was invented, and no contact details are included. Whitney's profile starts almost empty on purpose, for her to write.
