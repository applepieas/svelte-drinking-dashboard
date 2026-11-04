# Na ex

A real-time drinks board for a party. People log what they drink from their
phones by scanning a QR code; a shared screen - a TV, a laptop, a projector -
shows the standings as it happens.

**[Live demo](https://svelte-drinking-dashboard.svelte-drinking-dashboard.workers.dev/demo)** - fictional data; it moves while somebody is watching.

![The shared screen](docs/screen.png)

The interface is in Czech. Ranking is by ethanol rather than by number of
drinks, so two shots beat five soft drinks.

A SvelteKit rebuild of a Next.js app that real people used at several events.

## Run it at your own party

Everything here fits inside the free tier of both services.

**1. A database.** Any PostgreSQL will do while you are working on it - the
deployed app runs on [Neon](https://neon.tech), and an address that is not
Neon's switches the driver to the ordinary wire protocol.

```sh
git clone https://github.com/applepieas/svelte-drinking-dashboard
cd svelte-drinking-dashboard
pnpm install
cp .env.example .env          # DATABASE_URL, local or Neon
createdb naex                 # if you went local
pnpm db:migrate
```

**2. Try it locally.** `pnpm dev --host`, open the address it prints, create an
event, and scan the QR code with a phone on the same network. `--host` matters:
the QR code points at whatever address you opened, so a phone needs the one on
your network rather than `localhost`.

To run against Neon instead, put its connection string in `.env.neon` as
`DATABASE_URL` (Vite reads it on top of `.env`, and git ignores it). Then
`pnpm db:migrate:neon` once and `pnpm dev:neon --host`, which serves on port
5174 so it can run beside the local one. If that is the deployed app's
database, everything you click there happens in production.

**3. Put it online.** One Worker.

```sh
pnpm wrangler login

pnpm wrangler secret put DATABASE_URL         # the same connection string
pnpm wrangler secret put MAINTENANCE_SECRET   # openssl rand -hex 32
pnpm wrangler secret put RATE_LIMIT_SALT      # openssl rand -hex 32
pnpm build && pnpm wrangler deploy            # prints your URL
```

Rename the Worker in `wrangler.jsonc` first if you like. Housekeeping - seeding
the demo, moving it along, deleting events once their 30 days are up - rides on
the demo's own page loads, at most once every two minutes and after the response
has already gone out. There is no cron trigger; [Fitting the free
plan](#fitting-the-free-plan) says why. The same job sits at `POST /api/udrzba`
behind `MAINTENANCE_SECRET` if you want to run it by hand.

## How it works

**An append-only log, not a counter.** Every drink is a row; there is no `total`
column anywhere. Concurrent writes cannot clobber each other, undo is a
compensating row rather than a `DELETE`, and removing someone from the standings
leaves their history intact. `CHECK` constraints and partial unique indexes
enforce the log's shape in the database, because TypeScript unions stop at the
process boundary.

**Idempotence by unique index.** Every submission carries an id, unique per
event, so a double tap or a retried request resolves to one row.

**One reducer for the standings**, running during server rendering and again in
the browser as events arrive, so a live screen and a reloaded one cannot
disagree.

**Server-Sent Events, not WebSockets.** The flow is one-directional. Phones
write over ordinary form posts, and every message carries an `id:` so a screen
that loses its connection resumes from `Last-Event-ID`.

**The phone works without JavaScript.** Joining, logging, undoing, creating and
closing an event are all plain form posts. `use:enhance` adds optimistic updates
on top, and an end-to-end project runs the whole suite with JavaScript off to
keep it that way.

**Blood alcohol is estimated in the browser.** Weight and sex stay in
`localStorage` and are never sent anywhere. The estimate integrates minute by
minute instead of applying Widmark's formula directly, so alcohol is absorbed
gradually rather than all at once, and the floor at zero sits inside the loop so
elimination stops at sober instead of running up a debt.

**The demo is generated, never recorded.** Its timeline is a pure function of
the clock, so a given minute always produces the same drink by the same invented
person - which is what lets two overlapping maintenance runs collapse into one row.

## Fitting the free plan

Workers on the free plan allow 50 external subrequests and 10 ms of CPU per
invocation. Measured on the deployed Worker:

|                           | CPU      |
| ------------------------- | -------- |
| Stream, 39 polls          | 56 ms    |
| Stream, 5 polls           | 11 ms    |
| Screen render, warm       | 8–12 ms  |
| Screen render, cold start | 44–47 ms |

Roughly 1.2 ms per database query on top of ~10 ms just to invoke the Worker, so
no amount of tuning gets a render under the limit - that is the paid plan, not a
configuration change. What tuning does fix is the stream: it counts its own
queries and retires itself before it runs out, and the browser resumes from
`Last-Event-ID`. Cloudflare tolerates the overage, and nothing has been
terminated in practice, but this is the ceiling the design sits under.

The QR code is served from its own endpoint with an immutable cache rather than
rendered into the page, because encoding one was the most expensive thing the
screen did and it never changes for a given code.

Development does not spend any of that, which is the other reason the driver
follows the address: a local PostgreSQL costs nothing to leave running, and the
free plan's compute hours are better spent on people actually looking at the
demo. The branch is behind `dev`, so the Worker never carries the local driver.

The database has a budget too, and it is the one that bites. Neon's free plan
allows about 190 compute-hours a month and suspends an idle compute after five
minutes. The demo used to be driven by a cron trigger every two minutes, which
means the compute never got to idle: 24/7 is ~720 compute-hours, and the month's
allowance was gone in about eight days. Maintenance now runs on the demo's own
page loads instead, throttled by a conditional `UPDATE` on the event's
`expires_at` so that simultaneous viewers produce one tick between them. Nobody
watching, nothing running, and the database sleeps.

## Tests

```sh
pnpm test                              # unit; integration too when TEST_DATABASE_URL is set
pnpm exec playwright install chromium
pnpm test:e2e                          # includes a run with JavaScript disabled
```

Integration and end-to-end tests need `TEST_DATABASE_URL` pointing at a
**separate** database - they create and delete rows, and a guard refuses to run
if it matches `DATABASE_URL`.

## Scripts

|                    |                                       |
| ------------------ | ------------------------------------- |
| `pnpm dev`         | dev server                            |
| `pnpm check`       | Wrangler types + `svelte-check`       |
| `pnpm lint`        | Prettier + ESLint                     |
| `pnpm db:generate` | write a migration from schema changes |
| `pnpm db:migrate`  | apply pending migrations              |

Built with SvelteKit, TypeScript, Svelte 5, Drizzle, Neon and Cloudflare Workers.
