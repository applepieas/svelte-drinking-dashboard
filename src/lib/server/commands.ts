import { and, eq, isNull } from 'drizzle-orm';
import { db } from './db';
import { entry, event, participant } from './db/schema';
import type { DrinkKey } from '$lib/drinks';

/**
 * Appends a drink. Returns null when this submission was already recorded —
 * the unique index on (event_id, submission_id) is what makes a double tap or a
 * retried request harmless, so the caller does not have to think about it.
 */
export async function addDrink(values: {
	eventId: string;
	participantId: string;
	drinkKey: DrinkKey;
	submissionId: string;
}) {
	const [row] = await db
		.insert(entry)
		.values({ ...values, kind: 'drink' })
		.onConflictDoNothing({ target: [entry.eventId, entry.submissionId] })
		.returning({ seq: entry.seq });
	return row ?? null;
}

/**
 * Undo is a compensating row, never a DELETE: the log stays append-only and the
 * event's history remains complete.
 */
export async function undoDrink(values: {
	eventId: string;
	participantId: string;
	undoesSeq: number;
	submissionId: string;
}) {
	const [row] = await db
		.insert(entry)
		.values({ ...values, kind: 'undo' })
		.onConflictDoNothing({ target: [entry.eventId, entry.submissionId] })
		.returning({ seq: entry.seq });
	return row ?? null;
}

export function closeEvent(eventId: string) {
	return db.update(event).set({ closedAt: new Date() }).where(eq(event.id, eventId));
}

export function reopenEvent(eventId: string) {
	return db.update(event).set({ closedAt: null }).where(eq(event.id, eventId));
}

/**
 * A kick is a timestamp. The person's entries stay in the log and stay attributed
 * to the nick they used, which is also why that nick is not freed up afterwards.
 */
export function kickParticipant(eventId: string, participantId: string) {
	return db
		.update(participant)
		.set({ kickedAt: new Date() })
		.where(
			and(
				eq(participant.id, participantId),
				eq(participant.eventId, eventId),
				isNull(participant.kickedAt)
			)
		)
		.returning({ nick: participant.nick });
}

/** The one place data really is destroyed. Participants and entries cascade. */
export function deleteEvent(eventId: string) {
	return db.delete(event).where(eq(event.id, eventId));
}
