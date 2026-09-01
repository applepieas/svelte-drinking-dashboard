import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, lt } from 'drizzle-orm';
import { DEMO_CODE, DEMO_RESET_HOURS } from '$lib/demo';
import { DRINKS } from '$lib/drinks';

// Same reasoning as the other integration spec: the environment cannot be
// redirected after the fact, so the module is replaced instead.
vi.mock('./db', async () => {
	const { drizzle } = await import('drizzle-orm/neon-http');
	const { neon } = await import('@neondatabase/serverless');
	const schema = await import('./db/schema');
	const url = process.env.TEST_DATABASE_URL;
	if (!url) throw new Error('TEST_DATABASE_URL is required for integration tests.');
	return { db: drizzle(neon(url), { schema }) };
});

const { db } = await import('./db');
const { event, entry } = await import('./db/schema');
const { runMaintenance } = await import('./demo');

const HOUR_MS = 3_600_000;

async function removeDemo() {
	await db.delete(event).where(eq(event.code, DEMO_CODE));
}

async function demoRow() {
	return db.query.event.findFirst({ where: eq(event.code, DEMO_CODE) });
}

async function countDemoEntries() {
	const demo = await demoRow();
	if (!demo) return 0;
	const rows = await db.select({ seq: entry.seq }).from(entry).where(eq(entry.eventId, demo.id));
	return rows.length;
}

beforeEach(removeDemo);
afterAll(removeDemo);

describe('demo maintenance', () => {
	it('creates the demo with history rather than an empty board', async () => {
		const report = await runMaintenance();

		expect(report.demo).toBe('seeded');
		expect(report.added).toBeGreaterThan(0);
		expect(await demoRow()).toBeDefined();
	});

	// Two cron runs overlapping, or a retry, must not double the timeline.
	it('writes nothing new when run again straight away', async () => {
		await runMaintenance();
		const before = await countDemoEntries();

		const second = await runMaintenance();

		expect(second.demo).not.toBe('seeded');
		expect(second.added).toBe(0);
		expect(await countDemoEntries()).toBe(before);
	});

	it('is idempotent even when several runs overlap', async () => {
		await runMaintenance();
		const before = await countDemoEntries();

		await Promise.all([runMaintenance(), runMaintenance(), runMaintenance()]);

		expect(await countDemoEntries()).toBe(before);
	});

	it('keeps the demo out of reach of the retention sweep', async () => {
		await runMaintenance();
		const demo = await demoRow();
		expect(demo!.expiresAt.getTime()).toBeGreaterThan(Date.now());
	});

	it('starts the party over once it has run too long', async () => {
		await runMaintenance();
		const first = await demoRow();

		await db
			.update(event)
			.set({ createdAt: new Date(Date.now() - (DEMO_RESET_HOURS + 1) * HOUR_MS) })
			.where(eq(event.id, first!.id));

		const report = await runMaintenance();
		const second = await demoRow();

		expect(report.demo).toBe('reset');
		// A new row, so the old leaderboard is genuinely gone rather than trimmed.
		expect(second!.id).not.toBe(first!.id);
	});

	it('deletes events whose retention window has passed', async () => {
		const [expired] = await db
			.insert(event)
			.values({
				code: 'EXPIR1',
				name: 'Prosla akce',
				hostTokenHash: 'test',
				drinks: [DRINKS.beer],
				expiresAt: new Date(Date.now() - HOUR_MS)
			})
			.returning({ id: event.id });

		const report = await runMaintenance();

		expect(report.deletedEvents).toBeGreaterThan(0);
		expect(await db.query.event.findFirst({ where: eq(event.id, expired.id) })).toBeUndefined();
	});

	it('leaves events that have not expired alone', async () => {
		const [alive] = await db
			.insert(event)
			.values({
				code: 'ALIVE1',
				name: 'Bezici akce',
				hostTokenHash: 'test',
				drinks: [DRINKS.beer],
				expiresAt: new Date(Date.now() + HOUR_MS)
			})
			.returning({ id: event.id });

		try {
			await runMaintenance();
			expect(await db.query.event.findFirst({ where: eq(event.id, alive.id) })).toBeDefined();
		} finally {
			await db.delete(event).where(eq(event.id, alive.id));
		}
	});

	it('leaves no expired events behind afterwards', async () => {
		await runMaintenance();
		const leftovers = await db
			.select({ id: event.id })
			.from(event)
			.where(lt(event.expiresAt, new Date()));
		expect(leftovers).toHaveLength(0);
	});
});
