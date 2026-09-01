import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { entry, event, participant } from './db/schema';
import { sha256Hex } from './tokens';
import {
	DRINKS_PER_MINUTE,
	EVENTS_PER_HOUR_PER_IP,
	HOUR_MS,
	MAX_PARTICIPANTS,
	MINUTE_MS,
	slidingWindow
} from '$lib/rate';

export { DRINKS_PER_MINUTE, EVENTS_PER_HOUR_PER_IP, MAX_PARTICIPANTS } from '$lib/rate';

/**
 * Addresses are never stored in the clear. The salt belongs in the environment
 * in production; the fallback exists so a fresh clone runs without setup.
 */
export function hashIp(ip: string): Promise<string> {
	return sha256Hex(`${env.RATE_LIMIT_SALT ?? 'local-development-salt'}:${ip}`);
}

/**
 * Counted straight from the append-only log. Because every drink is already a
 * row with a timestamp, spam protection needs no store of its own.
 */
export async function checkDrinkRate(participantId: string, nowMs = Date.now()) {
	const rows = await db
		.select({ at: entry.createdAt })
		.from(entry)
		.where(
			and(
				eq(entry.participantId, participantId),
				eq(entry.kind, 'drink'),
				gte(entry.createdAt, new Date(nowMs - MINUTE_MS))
			)
		)
		.orderBy(desc(entry.createdAt))
		.limit(DRINKS_PER_MINUTE + 1);

	return slidingWindow(
		rows.map((row) => row.at.getTime()),
		DRINKS_PER_MINUTE,
		MINUTE_MS,
		nowMs
	);
}

/**
 * The product default is a policy, not a constant of nature — the end-to-end
 * suite legitimately creates dozens of events a minute from one address. Raising
 * it there beats special-casing tests inside the limiter.
 */
function eventsPerHour(): number {
	const configured = Number(env.MAX_EVENTS_PER_HOUR);
	return Number.isFinite(configured) && configured > 0 ? configured : EVENTS_PER_HOUR_PER_IP;
}

export async function checkEventCreationRate(ipHash: string, nowMs = Date.now()) {
	const limit = eventsPerHour();
	const rows = await db
		.select({ at: event.createdAt })
		.from(event)
		.where(and(eq(event.creatorIpHash, ipHash), gte(event.createdAt, new Date(nowMs - HOUR_MS))))
		.orderBy(desc(event.createdAt))
		.limit(limit + 1);

	return slidingWindow(
		rows.map((row) => row.at.getTime()),
		limit,
		HOUR_MS,
		nowMs
	);
}

export async function isEventFull(eventId: string): Promise<boolean> {
	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(participant)
		.where(eq(participant.eventId, eventId));
	return (row?.count ?? 0) >= MAX_PARTICIPANTS;
}
