import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from './db';
import { event, participant } from './db/schema';

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
