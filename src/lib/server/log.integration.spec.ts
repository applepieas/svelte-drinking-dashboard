import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';

/**
 * Replaces the database module for everything under test.
 *
 * Overriding the environment does not work here: `$env/dynamic/private` holds a
 * snapshot taken from `.env` when Vite starts, so the production module would
 * quietly stay pointed at the development database. Swapping the module is the
 * only way to be certain which database these tests write to.
 *
 * `./db` resolves to the same module specifier the code under test uses.
 */
vi.mock('./db', async () => {
	const { drizzle } = await import('drizzle-orm/neon-http');
	const { neon } = await import('@neondatabase/serverless');
	const schema = await import('./db/schema');
	const url = process.env.TEST_DATABASE_URL;
	if (!url) throw new Error('TEST_DATABASE_URL is required for integration tests.');
	return { db: drizzle(neon(url), { schema }) };
});
import { DRINKS } from '$lib/drinks';
import { reduceLog } from '$lib/leaderboard';
import { addDrink, kickParticipant, undoDrink } from './commands';
import { db } from './db';
import { event, participant } from './db/schema';
import { getEventEntries, getParticipantDrinks } from './queries';

/**
 * These exercise guarantees that only exist in the database: the unique indexes
 * behind idempotence, the check constraint on an entry's shape, the partial
 * index that lets a kicked person rejoin, and the cascade. None of it can be
 * proven by unit tests, because none of it lives in TypeScript.
 */

const createdEventIds: string[] = [];

async function makeEvent(name = 'Integration') {
	const [row] = await db
		.insert(event)
		.values({
			code: `T${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
			name,
			hostTokenHash: 'test',
			drinks: [DRINKS.beer, DRINKS.shot, DRINKS.soft],
			expiresAt: new Date(Date.now() + 3_600_000)
		})
		.returning({ id: event.id });
	createdEventIds.push(row.id);
	return row.id;
}

async function makeParticipant(eventId: string, nick: string) {
	const [row] = await db
		.insert(participant)
		.values({ eventId, cookieId: crypto.randomUUID(), nick })
		.returning({ id: participant.id, cookieId: participant.cookieId });
	return row;
}

let eventId: string;

beforeEach(async () => {
	eventId = await makeEvent();
});

afterAll(async () => {
	for (const id of createdEventIds) {
		await db.delete(event).where(eq(event.id, id));
	}
});

describe('append-only log', () => {
	it('records a drink once however many times the same submission arrives', async () => {
		const me = await makeParticipant(eventId, 'petr');
		const submissionId = crypto.randomUUID();

		const first = await addDrink({ eventId, participantId: me.id, drinkKey: 'beer', submissionId });
		const second = await addDrink({
			eventId,
			participantId: me.id,
			drinkKey: 'beer',
			submissionId
		});

		expect(first).not.toBeNull();
		expect(second).toBeNull();
		expect(await getParticipantDrinks(me.id)).toHaveLength(1);
	});

	it('survives the same submission arriving concurrently', async () => {
		const me = await makeParticipant(eventId, 'soubeh');
		const submissionId = crypto.randomUUID();

		const results = await Promise.all(
			Array.from({ length: 5 }, () =>
				addDrink({ eventId, participantId: me.id, drinkKey: 'beer', submissionId })
			)
		);

		expect(results.filter(Boolean)).toHaveLength(1);
		expect(await getParticipantDrinks(me.id)).toHaveLength(1);
	});

	it('lets separate submissions through', async () => {
		const me = await makeParticipant(eventId, 'ruzne');
		for (const drinkKey of ['beer', 'shot', 'soft'] as const) {
			await addDrink({
				eventId,
				participantId: me.id,
				drinkKey,
				submissionId: crypto.randomUUID()
			});
		}
		expect(await getParticipantDrinks(me.id)).toHaveLength(3);
	});

	it('takes a drink back without deleting anything', async () => {
		const me = await makeParticipant(eventId, 'undo');
		const drink = await addDrink({
			eventId,
			participantId: me.id,
			drinkKey: 'beer',
			submissionId: crypto.randomUUID()
		});

		await undoDrink({
			eventId,
			participantId: me.id,
			undoesSeq: drink!.seq,
			submissionId: crypto.randomUUID()
		});

		// Gone from the standings, still present in the log.
		expect(await getParticipantDrinks(me.id)).toHaveLength(0);
		const raw = await getEventEntries(eventId);
		expect(raw.map((row) => row.kind).sort()).toEqual(['drink', 'undo']);
	});

	it('refuses to take the same drink back twice', async () => {
		const me = await makeParticipant(eventId, 'dvakrat');
		const drink = await addDrink({
			eventId,
			participantId: me.id,
			drinkKey: 'beer',
			submissionId: crypto.randomUUID()
		});
		const undoOnce = {
			eventId,
			participantId: me.id,
			undoesSeq: drink!.seq,
			submissionId: crypto.randomUUID()
		};

		await undoDrink(undoOnce);
		await expect(undoDrink({ ...undoOnce, submissionId: crypto.randomUUID() })).rejects.toThrow();
	});

	// Raw SQL on purpose: these assert what the database refuses, and going
	// through the typed helpers would only prove TypeScript refuses it too.
	it('rejects a drink row with no drink on it', async () => {
		const me = await makeParticipant(eventId, 'tvar');
		await expect(
			db.execute(sql`
				insert into entry (event_id, participant_id, kind, drink_key, submission_id)
				values (${eventId}, ${me.id}, 'drink', null, ${crypto.randomUUID()})
			`)
		).rejects.toThrow();
	});

	it('rejects an undo row that points at nothing', async () => {
		const me = await makeParticipant(eventId, 'prazdneundo');
		await expect(
			db.execute(sql`
				insert into entry (event_id, participant_id, kind, undoes_seq, submission_id)
				values (${eventId}, ${me.id}, 'undo', null, ${crypto.randomUUID()})
			`)
		).rejects.toThrow();
	});

	it('rejects a kind the log does not know', async () => {
		const me = await makeParticipant(eventId, 'kind');
		await expect(
			db.execute(sql`
				insert into entry (event_id, participant_id, kind, drink_key, submission_id)
				values (${eventId}, ${me.id}, 'nonsense', 'beer', ${crypto.randomUUID()})
			`)
		).rejects.toThrow();
	});
});

describe('participants', () => {
	it('treats nicks as the same regardless of case', async () => {
		await makeParticipant(eventId, 'Petr');
		await expect(makeParticipant(eventId, 'PETR')).rejects.toThrow();
	});

	it('lets a kicked person rejoin under a new nick', async () => {
		const me = await makeParticipant(eventId, 'puvodni');
		await kickParticipant(eventId, me.id);

		const [again] = await db
			.insert(participant)
			.values({ eventId, cookieId: me.cookieId, nick: 'novy' })
			.returning({ id: participant.id });

		expect(again.id).not.toBe(me.id);
	});

	it('still refuses a second live participant on one device', async () => {
		const me = await makeParticipant(eventId, 'jeden');
		await expect(
			db.insert(participant).values({ eventId, cookieId: me.cookieId, nick: 'dva' })
		).rejects.toThrow();
	});

	it('keeps a kicked person out of the standings but leaves the log intact', async () => {
		const stays = await makeParticipant(eventId, 'zustava');
		const goes = await makeParticipant(eventId, 'odchazi');

		for (const person of [stays, goes]) {
			await addDrink({
				eventId,
				participantId: person.id,
				drinkKey: 'beer',
				submissionId: crypto.randomUUID()
			});
		}
		await kickParticipant(eventId, goes.id);

		const entries = await getEventEntries(eventId);
		expect(entries).toHaveLength(2);

		const view = reduceLog(entries, [DRINKS.beer]);
		expect(view.leaderboard.map((row) => row.nick)).toEqual(['zustava']);
	});
});

describe('deleting an event', () => {
	it('takes its participants and entries with it', async () => {
		const doomed = await makeEvent('Ke smazani');
		const me = await makeParticipant(doomed, 'kaskada');
		await addDrink({
			eventId: doomed,
			participantId: me.id,
			drinkKey: 'beer',
			submissionId: crypto.randomUUID()
		});

		await db.delete(event).where(eq(event.id, doomed));

		expect(await getEventEntries(doomed)).toHaveLength(0);
		const left = await db.select().from(participant).where(eq(participant.eventId, doomed));
		expect(left).toHaveLength(0);
	});
});
