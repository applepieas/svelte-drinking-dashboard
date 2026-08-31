# Na ex

Real-time party drinks dashboard. People log what they drink from their phones; a shared
screen (TV, projector, laptop) shows the leaderboard and a live ticker as it happens.

This is a SvelteKit rebuild of a Next.js app that was actually used by real people at
several events. The deployed demo runs on fictional data only.

> **Status: work in progress.** The schema, shared types and database layer are in place.
> Routes are being built incrementally — see the commit history.

## Stack

|           |                                                        |
| --------- | ------------------------------------------------------ |
| Framework | SvelteKit + TypeScript, Svelte 5 (runes)               |
| Realtime  | Server-Sent Events via `+server.ts` (`ReadableStream`) |
| Database  | Neon Postgres + Drizzle ORM                            |
| Hosting   | Cloudflare Workers (`adapter-cloudflare`)              |
| Styling   | Tailwind CSS v4                                        |

## Architecture notes

**Append-only event log, not a mutable counter.** Every drink is a row in `entry`. There is
no `total` column anywhere — the leaderboard is a query. Concurrent writes can't clobber
each other, "undo" is a compensating row rather than a `DELETE`, and the full history of an
event is available for free.

**SSE, not WebSockets.** The data flow is one-directional: server to screen. Phones write
over ordinary HTTP form posts. Every SSE message carries an `id:`, so a screen that drops
its connection replays what it missed via `Last-Event-ID`.

**The phone client works without JavaScript.** Logging a drink is a plain `<form>` POST
backed by a SvelteKit form action. `use:enhance` upgrades it to an optimistic, no-reload
submit when JS is available, but the no-JS path is the one that defines behaviour.

**Blood alcohol estimation runs entirely client-side.** Body weight is never sent to the
server or stored. Only the ethanol content of each drink is persisted, so the formula can
change without a migration and without stale values in the database.

## Running locally

```sh
pnpm install
cp .env.example .env     # then set DATABASE_URL to a Neon connection string
pnpm db:push
pnpm dev
```

## Scripts

| Command          |                                 |
| ---------------- | ------------------------------- |
| `pnpm dev`       | dev server                      |
| `pnpm check`     | Wrangler types + `svelte-check` |
| `pnpm lint`      | Prettier + ESLint               |
| `pnpm test`      | Vitest                          |
| `pnpm db:push`   | sync schema to the database     |
| `pnpm db:studio` | Drizzle Studio                  |
