import { and, desc, eq, isNull, notExists, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from './db';
import { entry, event, participant } from './db/schema';
import type { DrinkDef } from '$lib/drinks';

/** Maps an entry's drink key to its ethanol content, per this event's snapshot. */
function drinkEthanolCase(drinks: DrinkDef[]) {
	const branches = drinks.map(
		(drink) => sql`when ${entry.drinkKey} = ${drink.key} then ${drink.ethanolMl}`
	);
	return sql`case ${sql.join(branches, sql` `)} else 0 end`;
}

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
 * Ranked by ethanol, not by number of drinks — a shot and a beer are not the
 * same achievement.
 *
 * The millilitres come from the event's own `drinks` snapshot rather than the
 * global DRINKS table, so editing a drink definition later cannot rewrite what
 * an old event scored. That snapshot is compiled into a CASE here because the
 * value deliberately lives on the event, not on every entry row.
 */
export function getLeaderboard(eventId: string, drinks: DrinkDef[]) {
	if (drinks.length === 0) return Promise.resolve([]);

	const ethanolMl = sql<number>`sum(${drinkEthanolCase(drinks)})::int`;

	return db
		.select({
			nick: participant.nick,
			ethanolMl,
			drinks: sql<number>`count(*)::int`
		})
		.from(entry)
		.innerJoin(participant, eq(participant.id, entry.participantId))
		.where(
			and(
				eq(entry.eventId, eventId),
				eq(entry.kind, 'drink'),
				// Kicked people drop off the board, but their rows stay in the log.
				isNull(participant.kickedAt),
				isLive
			)
		)
		.groupBy(participant.id, participant.nick)
		.orderBy(desc(ethanolMl), participant.nick);
}

export function getRecentEntries(eventId: string, limit = 10) {
	return db
		.select({
			seq: entry.seq,
			nick: participant.nick,
			drinkKey: entry.drinkKey,
			createdAt: entry.createdAt
		})
		.from(entry)
		.innerJoin(participant, eq(participant.id, entry.participantId))
		.where(
			and(
				eq(entry.eventId, eventId),
				eq(entry.kind, 'drink'),
				// Kicked people are gone from the screen entirely, ticker included.
				isNull(participant.kickedAt),
				isLive
			)
		)
		.orderBy(desc(entry.seq))
		.limit(limit);
}

export async function countDrinks(participantId: string) {
	const [row] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(entry)
		.where(and(eq(entry.participantId, participantId), eq(entry.kind, 'drink'), isLive));
	return row?.total ?? 0;
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
