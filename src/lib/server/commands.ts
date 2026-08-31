import { db } from './db';
import { entry } from './db/schema';
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
