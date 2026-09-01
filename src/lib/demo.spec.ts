import { describe, expect, it } from 'vitest';
import { DEMO_ROSTER, minuteIndex, planMinute } from './demo';
import { DRINKS } from './drinks';

const drinks = Object.values(DRINKS);
const MINUTE = 60_000;

describe('minuteIndex', () => {
	it('counts whole minutes', () => {
		expect(minuteIndex(0)).toBe(0);
		expect(minuteIndex(MINUTE * 7)).toBe(7);
	});

	it('ignores seconds within a minute', () => {
		expect(minuteIndex(MINUTE * 7 + 59_000)).toBe(7);
	});

	it('accepts a Date as readily as a number', () => {
		expect(minuteIndex(new Date(MINUTE * 7))).toBe(7);
	});
});

describe('planMinute', () => {
	// This is what makes a tick idempotent: two overlapping maintenance runs
	// produce identical rows, which the unique index then collapses into one.
	it('always plans the same thing for the same minute', () => {
		for (const minute of [0, 1, 5, 12345, 29_000_000]) {
			expect(planMinute(minute, drinks)).toEqual(planMinute(minute, drinks));
		}
	});

	it('gives every planned drink a submission id derived from its minute', () => {
		const planned = Array.from({ length: 500 }, (_, i) => planMinute(i, drinks)).filter(
			(item) => item !== null
		);
		expect(planned.length).toBeGreaterThan(0);
		for (const item of planned) {
			expect(item.submissionId).toMatch(/^demo-\d+$/);
		}
	});

	it('never plans two drinks with the same submission id', () => {
		const ids = Array.from({ length: 1000 }, (_, i) => planMinute(i, drinks)?.submissionId).filter(
			Boolean
		);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('leaves most minutes empty', () => {
		const window = 1000;
		const busy = Array.from({ length: window }, (_, i) => planMinute(i, drinks)).filter(Boolean);
		// About one in five. The exact rate matters: this is how fast the demo
		// depicts people drinking.
		expect(busy.length).toBeGreaterThan(window * 0.1);
		expect(busy.length).toBeLessThan(window * 0.3);
	});

	it('spreads drinks across everyone on the roster', () => {
		const nicks = new Set(
			Array.from({ length: 2000 }, (_, i) => planMinute(i, drinks)?.nick).filter(Boolean)
		);
		expect(nicks.size).toBe(DEMO_ROSTER.length);
	});

	it('uses every drink the event offers', () => {
		const keys = new Set(
			Array.from({ length: 2000 }, (_, i) => planMinute(i, drinks)?.drinkKey).filter(Boolean)
		);
		expect(keys.size).toBe(drinks.length);
	});

	it('plans nothing when the event has no drinks', () => {
		for (let minute = 0; minute < 50; minute++) {
			expect(planMinute(minute, [])).toBeNull();
		}
	});
});
