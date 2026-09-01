import { eq, lt } from 'drizzle-orm';
import { DRINKS } from '$lib/drinks';
import {
	DEMO_BACKFILL_MINUTES,
	DEMO_CODE,
	DEMO_NAME,
	DEMO_RESET_HOURS,
	DEMO_ROSTER,
	minuteIndex,
	planMinute
} from '$lib/demo';
import { db } from './db';
import { entry, event, participant } from './db/schema';
import { newHostToken, hashToken } from './tokens';

const HOUR_MS = 3_600_000;
/** Kept well ahead of now so the retention sweep never takes the demo with it. */
const DEMO_EXPIRY_MS = 24 * HOUR_MS;

export interface MaintenanceReport {
	demo: 'seeded' | 'reset' | 'ticked' | 'quiet';
	added: number;
	deletedEvents: number;
}

/** Removes events whose retention window has run out. Everything cascades. */
async function pruneExpiredEvents(now: Date): Promise<number> {
	const gone = await db.delete(event).where(lt(event.expiresAt, now)).returning({ id: event.id });
	return gone.length;
}

async function createDemoEvent(now: Date) {
	// The host token is generated and thrown away: nobody should be able to
	// manage the demo, and no stored value can be used to.
	const hostTokenHash = await hashToken(newHostToken());

	const [row] = await db
		.insert(event)
		.values({
			code: DEMO_CODE,
			name: DEMO_NAME,
			hostTokenHash,
			drinks: Object.values(DRINKS),
			expiresAt: new Date(now.getTime() + DEMO_EXPIRY_MS)
		})
		.returning({ id: event.id, createdAt: event.createdAt });

	await db
		.insert(participant)
		.values(DEMO_ROSTER.map((nick) => ({ eventId: row.id, cookieId: crypto.randomUUID(), nick })));

	return row;
}

/**
 * Replays the demo timeline for a range of minutes.
 *
 * Seeding and ticking are the same operation over a different window, so a
 * fresh demo already has a populated board rather than starting empty in front
 * of whoever just opened the link.
 */
async function replay(eventId: string, fromMinute: number, toMinute: number): Promise<number> {
	const drinks = Object.values(DRINKS);
	const people = await db
		.select({ id: participant.id, nick: participant.nick })
		.from(participant)
		.where(eq(participant.eventId, eventId));
	const byNick = new Map(people.map((person) => [person.nick, person.id]));

	const rows = [];
	for (let minute = fromMinute; minute <= toMinute; minute++) {
		const planned = planMinute(minute, drinks);
		const participantId = planned && byNick.get(planned.nick);
		if (!planned || !participantId) continue;

		rows.push({
			eventId,
			participantId,
			kind: 'drink' as const,
			drinkKey: planned.drinkKey,
			submissionId: planned.submissionId,
			createdAt: new Date(minute * 60_000)
		});
	}

	if (rows.length === 0) return 0;

	const written = await db
		.insert(entry)
		.values(rows)
		// Replaying an overlapping window is normal; the index sorts it out.
		.onConflictDoNothing({ target: [entry.eventId, entry.submissionId] })
		.returning({ seq: entry.seq });

	return written.length;
}

/**
 * Keeps the public demo alive and the database tidy.
 *
 * Called on a schedule rather than on page load: writing rows as a side effect
 * of somebody looking at a page is the kind of thing that is fine until two
 * people look at once.
 */
export async function runMaintenance(now = new Date()): Promise<MaintenanceReport> {
	const deletedEvents = await pruneExpiredEvents(now);
	const nowMinute = minuteIndex(now);

	const existing = await db.query.event.findFirst({ where: eq(event.code, DEMO_CODE) });

	// A demo party that ran all week would show a leaderboard nobody can catch
	// up with, so it starts over.
	if (existing && now.getTime() - existing.createdAt.getTime() > DEMO_RESET_HOURS * HOUR_MS) {
		await db.delete(event).where(eq(event.id, existing.id));
		const fresh = await createDemoEvent(now);
		const added = await replay(fresh.id, nowMinute - DEMO_BACKFILL_MINUTES, nowMinute);
		return { demo: 'reset', added, deletedEvents };
	}

	if (!existing) {
		const fresh = await createDemoEvent(now);
		const added = await replay(fresh.id, nowMinute - DEMO_BACKFILL_MINUTES, nowMinute);
		return { demo: 'seeded', added, deletedEvents };
	}

	// Push the expiry along so the demo outlives its own retention window.
	await db
		.update(event)
		.set({ expiresAt: new Date(now.getTime() + DEMO_EXPIRY_MS) })
		.where(eq(event.id, existing.id));

	// A small overlap covers a missed run without leaving a gap in the timeline.
	const added = await replay(existing.id, nowMinute - 5, nowMinute);
	return { demo: added > 0 ? 'ticked' : 'quiet', added, deletedEvents };
}

/** Used by the /demo route to decide whether there is anything to redirect to. */
export function demoExists() {
	return db.query.event.findFirst({
		where: eq(event.code, DEMO_CODE),
		columns: { id: true }
	});
}
