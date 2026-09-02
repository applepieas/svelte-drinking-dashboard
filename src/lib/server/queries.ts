import { and, asc, desc, eq, gt, isNull, notExists, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from './db';
import { entry, event, participant } from './db/schema';
import type { LogEntry } from '$lib/events';

/** An entry is "live" when no undo row points at it. */
const undone = alias(entry, 'undone');
const isLive = notExists(
	db
		.select({ one: sql`1` })
		.from(undone)
		.where(eq(undone.undoesSeq, entry.seq))
);

/** Form actions cannot read load() data, so both paths go through here. */
export function getEventByCode(code: string) {
	return db.query.event.findFirst({ where: eq(event.code, code) });
}

export function findActiveParticipant(eventId: string, cookieId: string) {
	return db.query.participant.findFirst({
		where: and(
			eq(participant.eventId, eventId),
			eq(participant.cookieId, cookieId),
			isNull(participant.kickedAt)
		)
	});
}

/** Kicked participants keep their nick, so this deliberately does not filter them out. */
export function findNickHolder(eventId: string, nick: string) {
	return db.query.participant.findFirst({
		where: and(eq(participant.eventId, eventId), sql`lower(${participant.nick}) = lower(${nick})`)
	});
}

/**
 * The raw log, nick attached, oldest first.
 *
 * Aggregation deliberately does not happen here. The screen reduces the same
 * rows in the browser as events stream in, so keeping a second implementation in
 * SQL would be two things to keep in step.
 */
/**
 * The whole log is serialised into the page and reduced there, so the page can
 * only hold so much of it. A real event runs to a few hundred rows; past this
 * ceiling the oldest are dropped and the standings would understate them.
 */
const SNAPSHOT_LIMIT = 500;

const logColumns = {
	seq: entry.seq,
	nick: participant.nick,
	kind: entry.kind,
	drinkKey: entry.drinkKey,
	undoesSeq: entry.undoesSeq,
	at: entry.createdAt,
	kicked: sql<boolean>`${participant.kickedAt} is not null`
};

type LogRow = { at: Date } & Omit<LogEntry, 'at'>;
const toLogEntries = (rows: LogRow[]): LogEntry[] =>
	rows.map((row) => ({ ...row, at: row.at.toISOString() }));

/** Rows added since a sequence number. Used by the stream, so normally empty. */
export async function getEventEntries(eventId: string, sinceSeq = 0): Promise<LogEntry[]> {
	const rows = await db
		.select(logColumns)
		.from(entry)
		.innerJoin(participant, eq(participant.id, entry.participantId))
		.where(and(eq(entry.eventId, eventId), gt(entry.seq, sinceSeq)))
		.orderBy(asc(entry.seq))
		.limit(SNAPSHOT_LIMIT);

	return toLogEntries(rows);
}

/**
 * The most recent slice of the log, oldest first.
 *
 * Newest rather than oldest matters: taking the first N of a long event would
 * pin the screen to the start of the night and silently ignore everything since.
 */
export async function getRecentEventEntries(
	eventId: string,
	limit = SNAPSHOT_LIMIT
): Promise<LogEntry[]> {
	const rows = await db
		.select(logColumns)
		.from(entry)
		.innerJoin(participant, eq(participant.id, entry.participantId))
		.where(eq(entry.eventId, eventId))
		.orderBy(desc(entry.seq))
		.limit(limit);

	return toLogEntries(rows.reverse());
}

/**
 * Fingerprint of everything about an event that the entry log cannot express.
 * When it changes, watchers are told to refetch instead of patching.
 */
export async function getEventVersion(eventId: string): Promise<string> {
	const [row] = await db
		.select({
			closedAt: event.closedAt,
			participants: sql<number>`count(${participant.id})::int`,
			kicked: sql<number>`count(${participant.kickedAt})::int`
		})
		.from(event)
		.leftJoin(participant, eq(participant.eventId, event.id))
		.where(eq(event.id, eventId))
		.groupBy(event.id, event.closedAt);

	if (!row) return 'gone';
	return `${row.closedAt?.toISOString() ?? 'open'}|${row.participants}|${row.kicked}`;
}

/** One participant's own standing drinks, oldest first. Feeds the phone's estimate. */
export async function getParticipantDrinks(participantId: string) {
	const rows = await db
		.select({ seq: entry.seq, drinkKey: entry.drinkKey, at: entry.createdAt })
		.from(entry)
		.where(and(eq(entry.participantId, participantId), eq(entry.kind, 'drink'), isLive))
		.orderBy(asc(entry.seq));

	return rows.map((row) => ({ ...row, at: row.at.toISOString() }));
}

/** The most recent drink that has not been taken back yet. */
export async function findLastLiveDrink(participantId: string) {
	const [row] = await db
		.select({ seq: entry.seq, drinkKey: entry.drinkKey, createdAt: entry.createdAt })
		.from(entry)
		.where(and(eq(entry.participantId, participantId), eq(entry.kind, 'drink'), isLive))
		.orderBy(desc(entry.seq))
		.limit(1);
	return row ?? null;
}

/** Everyone who ever joined, kicked included — the host needs to see both. */
export function listParticipants(eventId: string) {
	return db
		.select({
			id: participant.id,
			nick: participant.nick,
			kickedAt: participant.kickedAt,
			createdAt: participant.createdAt
		})
		.from(participant)
		.where(eq(participant.eventId, eventId))
		.orderBy(participant.createdAt);
}
