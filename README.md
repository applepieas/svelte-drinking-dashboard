# Na ex

Real-time party drinks dashboard. People log what they drink from their phones; a
shared screen shows the standings and a live ticker as it happens.

A SvelteKit rebuild of a Next.js app that real people used at several events. The
deployed demo will run on fictional data only.

> **Status: work in progress.** Everything below is implemented and covered by
> tests, and the project is ready to deploy — see _Deploying_ at the bottom.

## Stack

|           |                                                                   |
| --------- | ----------------------------------------------------------------- |
| Framework | SvelteKit + TypeScript, Svelte 5 (runes)                          |
| Realtime  | Server-Sent Events via `+server.ts` (`ReadableStream`)            |
| Database  | Neon Postgres + Drizzle ORM                                       |
| Target    | Cloudflare Workers (`adapter-cloudflare`)                         |
| Styling   | Tailwind CSS v4 — placeholder only, the visual design comes later |
| Tests     | Vitest (unit + integration) and Playwright (end-to-end)           |

## Architecture notes

**An append-only log, not a counter.** Every drink is a row in `entry`; there is
no `total` column anywhere. Concurrent writes cannot clobber each other, "undo"
is a compensating row rather than a `DELETE`, and a kick is a timestamp, so the
history of an event stays intact even when someone is removed from the standings.

**The log enforces its own shape.** `CHECK` constraints reject a drink with no
drink on it and an undo that points at nothing; a partial unique index makes it
impossible to take the same drink back twice. TypeScript unions stop at the
process boundary, so the guarantees live in the database.

**Idempotence by unique index.** Every submission carries an id, unique per
event. A double tap, a retried request, or a back-button resubmit all resolve to
one row without the application having to think about it.

**One reducer for the standings.** `reduceLog` turns raw entries into the
leaderboard, and it runs on the server during SSR and again in the browser as
events stream in. A live screen and a reloaded one cannot disagree, because
there is only one implementation.

**Ranking is by ethanol, not by count.** The millilitres come from the event's
own snapshot of its drinks, so editing a drink definition later cannot rewrite
what an old event scored.

**SSE, not WebSockets.** The flow is one-directional, server to screen. Phones
write over ordinary HTTP form posts. Every message carries an `id:`, so a screen
that drops its connection replays what it missed via `Last-Event-ID`.

**The delivery mechanism is behind an interface.** A write and a stream are
separate Worker invocations sharing no memory, so `EventBus` is implemented by
re-reading the log on a timer. The polling reaches slightly further back than the
last sequence number it saw, because `bigserial` hands out numbers before commit
and a strict `seq > last` query can step over a row for good. Swapping in a
Durable Object — one instance per event, holding the streams — would not change
anything above the interface.

**The phone client works without JavaScript.** Logging a drink, taking it back,
joining, creating and closing an event are all plain form posts. `use:enhance`
adds optimistic updates on top, and an end-to-end project runs the whole suite
with JavaScript switched off to keep it that way.

**Blood alcohol is estimated in the browser.** Body weight and sex are kept in
`localStorage` and never sent anywhere. The estimate integrates minute by minute
rather than applying Widmark's formula directly, so alcohol is absorbed
gradually instead of appearing all at once, and the floor at zero sits inside
the loop so elimination stops at sober rather than running up a debt that would
swallow the next drink.

**The demo is generated, never recorded.** `/demo` points at a permanent event
whose participants and history are invented. Its timeline is a pure function of
the clock: a given minute always produces the same drink by the same person, so
the submission id can be derived from the minute and two overlapping maintenance
runs collapse into one row instead of two. Real events this was used at had real
people on the board, and none of those names belong on a public page.

**Housekeeping is an endpoint, not a `scheduled` handler.** `adapter-cloudflare`
emits a worker with only `fetch`, so `POST /api/udrzba` does the work instead —
delete events past their retention window, keep the demo running — and a cron
trigger calls it. It refuses to run without `MAINTENANCE_SECRET`, and compares
the key as a digest rather than as a string.

**Streams retire themselves to fit the free plan.** Workers on the free plan
allow 50 external subrequests per invocation, and every poll of the log is one
of them. Rather than degrade partway through an evening, a stream counts its own
queries and closes cleanly once it has spent its budget — about a minute. The
browser reconnects and resumes from `Last-Event-ID`, which was written to
survive dropped connections and turns out to be exactly what makes a
deliberately short-lived stream invisible.

**The join code is a cached image, not part of the page.** Encoding a QR was the
most expensive thing the screen did, on a runtime that allows 10 ms of CPU per
request, and its result never changes for a given code. As its own response it
is cached at the edge and the Worker stops running for it.

**Rate limiting reads the log.** Because every drink is already a timestamped
row, spam protection needs no store of its own. Event creation is limited per
address, and only a salted digest of that address is ever stored.

## Running locally

```sh
pnpm install
cp .env.example .env     # then set DATABASE_URL to a Neon connection string
pnpm db:migrate
pnpm dev
```

### Changing the schema

```sh
# 1. edit src/lib/server/db/schema.ts
pnpm db:generate         # writes drizzle/NNNN_*.sql
cat drizzle/NNNN_*.sql   # 2. read it — this is the point of the workflow
pnpm db:migrate          # 3. apply, to every database that needs it
```

`drizzle-kit push` is deliberately not wired up. It cost this project two bugs:
it silently declined to add a `WHERE` clause to an index that already existed,
and it left one database a column behind another, because nothing recorded what
had been applied where. A migration file is reviewable, repeatable and tracked
in `drizzle.__drizzle_migrations`.

## Tests

Unit tests run on their own. Integration and end-to-end tests need
`TEST_DATABASE_URL` pointing at a **separate** database — they create and delete
rows, and a setup guard refuses to run if it matches `DATABASE_URL`.

```sh
pnpm test                                  # unit; integration too when TEST_DATABASE_URL is set
pnpm exec playwright install chromium      # once
pnpm test:e2e                              # end-to-end, including a no-JavaScript run
```

## Maintenance and the demo

```sh
curl -X POST localhost:5173/api/udrzba -H "authorization: Bearer $MAINTENANCE_SECRET"
```

Run once, this seeds the demo with a couple of hours of history and makes
`/demo` resolve. Run on a schedule, it keeps the demo moving, restarts the party
every six hours, and deletes events whose 30 days are up. It is safe to call
repeatedly and safe to call twice at once.

## Scripts

| Command            |                                       |
| ------------------ | ------------------------------------- |
| `pnpm dev`         | dev server                            |
| `pnpm check`       | Wrangler types + `svelte-check`       |
| `pnpm lint`        | Prettier + ESLint                     |
| `pnpm test`        | Vitest                                |
| `pnpm test:e2e`    | Playwright                            |
| `pnpm db:generate` | write a migration from schema changes |
| `pnpm db:migrate`  | apply pending migrations              |
| `pnpm db:studio`   | Drizzle Studio                        |

## Deploying

Cloudflare Workers on the free plan, and a Postgres database on Neon. Two
Workers: the app, and a small one that owns the cron schedule — `adapter-cloudflare`
generates a worker exporting only `fetch`, so a Cron Trigger has nothing to call
on the app itself.

```sh
pnpm wrangler login

# 1. the app
pnpm wrangler secret put DATABASE_URL       # production connection string
pnpm wrangler secret put MAINTENANCE_SECRET # any long random value
pnpm wrangler secret put RATE_LIMIT_SALT    # any long random value
pnpm build && pnpm wrangler deploy

# 2. the scheduler, pointed at the app that was just deployed
pnpm wrangler secret put MAINTENANCE_SECRET -c cron/wrangler.jsonc  # the same value
pnpm wrangler deploy -c cron/wrangler.jsonc \
  --var MAINTENANCE_URL:https://<the-app>.workers.dev/api/udrzba
```

Migrations are applied from a machine that has the production connection string,
not from the Worker:

```sh
DATABASE_URL=<production> pnpm db:migrate
```

The demo seeds itself on the first maintenance run, so `/demo` starts working
within a couple of minutes of the scheduler going live.
