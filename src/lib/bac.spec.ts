import { describe, expect, it } from 'vitest';
import { ELIMINATION_PER_HOUR, estimateBac, hoursToSober, type BacProfile } from './bac';

const PROFILE: BacProfile = { weightKg: 80, sex: 'male' };
const NOON = Date.UTC(2026, 0, 1, 12, 0, 0);
const minutes = (n: number) => n * 60_000;
const hours = (n: number) => n * 3_600_000;

/** A half litre of 4.5% beer. */
const BEER = 22;
/** A 40 ml shot of spirits. */
const SHOT = 16;

describe('estimateBac', () => {
	it('is zero with nothing drunk', () => {
		expect(estimateBac([], PROFILE, NOON)).toBe(0);
	});

	it('is zero without a usable profile', () => {
		const drinks = [{ atMs: NOON, ethanolMl: BEER }];
		expect(estimateBac(drinks, { weightKg: 0, sex: 'male' }, NOON + hours(1))).toBe(0);
	});

	it('ignores drinks with no ethanol in them', () => {
		const soft = [{ atMs: NOON, ethanolMl: 0 }];
		expect(estimateBac(soft, PROFILE, NOON + hours(1))).toBe(0);
	});

	// The whole reason this is an integration rather than the textbook formula.
	it('does not jump the instant a drink is logged', () => {
		const drinks = [{ atMs: NOON, ethanolMl: BEER }];
		const immediately = estimateBac(drinks, PROFILE, NOON + minutes(1));
		const laterOn = estimateBac(drinks, PROFILE, NOON + minutes(30));

		expect(immediately).toBeLessThan(laterOn / 4);
	});

	it('keeps climbing while the drink is still being absorbed', () => {
		const drinks = [{ atMs: NOON, ethanolMl: BEER }];
		const series = [5, 15, 30, 45].map((m) => estimateBac(drinks, PROFILE, NOON + minutes(m)));

		for (let i = 1; i < series.length; i++) {
			expect(series[i]).toBeGreaterThan(series[i - 1]);
		}
	});

	it('falls again once absorption is finished', () => {
		const drinks = [{ atMs: NOON, ethanolMl: BEER }];
		const peak = estimateBac(drinks, PROFILE, NOON + minutes(60));
		const after = estimateBac(drinks, PROFILE, NOON + minutes(150));

		expect(after).toBeLessThan(peak);
	});

	it('never goes negative, however long you wait', () => {
		const drinks = [{ atMs: NOON, ethanolMl: BEER }];
		for (const hoursLater of [4, 12, 24, 72]) {
			expect(estimateBac(drinks, PROFILE, NOON + hours(hoursLater))).toBe(0);
		}
	});

	// If elimination were applied to a running total without a floor, the hours
	// of sobriety before this drink would eat it.
	it('starts from zero after a long dry spell rather than from a negative debt', () => {
		const longGap = [
			{ atMs: NOON, ethanolMl: BEER },
			{ atMs: NOON + hours(12), ethanolMl: BEER }
		];
		const single = [{ atMs: NOON + hours(12), ethanolMl: BEER }];

		const withHistory = estimateBac(longGap, PROFILE, NOON + hours(12) + minutes(45));
		const withoutHistory = estimateBac(single, PROFILE, NOON + hours(12) + minutes(45));

		expect(withHistory).toBeCloseTo(withoutHistory, 3);
		expect(withHistory).toBeGreaterThan(0);
	});

	it('scores spirits above beer for the same volume of liquid', () => {
		const beer = estimateBac([{ atMs: NOON, ethanolMl: BEER }], PROFILE, NOON + minutes(60));
		const shot = estimateBac([{ atMs: NOON, ethanolMl: SHOT }], PROFILE, NOON + minutes(60));

		expect(beer).toBeGreaterThan(shot);
	});

	it('gives a lighter person a higher reading for the same drink', () => {
		const drinks = [{ atMs: NOON, ethanolMl: BEER }];
		const light = estimateBac(drinks, { weightKg: 55, sex: 'male' }, NOON + minutes(45));
		const heavy = estimateBac(drinks, { weightKg: 110, sex: 'male' }, NOON + minutes(45));

		expect(light).toBeGreaterThan(heavy);
	});

	it('gives a woman a higher reading than a man of the same weight', () => {
		const drinks = [{ atMs: NOON, ethanolMl: BEER }];
		const female = estimateBac(drinks, { weightKg: 70, sex: 'female' }, NOON + minutes(45));
		const male = estimateBac(drinks, { weightKg: 70, sex: 'male' }, NOON + minutes(45));

		expect(female).toBeGreaterThan(male);
	});

	it('lands in a plausible range for one beer', () => {
		const drinks = [{ atMs: NOON, ethanolMl: BEER }];
		const peak = estimateBac(drinks, PROFILE, NOON + minutes(50));

		expect(peak).toBeGreaterThan(0.15);
		expect(peak).toBeLessThan(0.35);
	});

	it('does not care what order the drinks arrive in', () => {
		const forwards = [
			{ atMs: NOON, ethanolMl: BEER },
			{ atMs: NOON + minutes(30), ethanolMl: SHOT }
		];
		const backwards = [forwards[1], forwards[0]];

		expect(estimateBac(forwards, PROFILE, NOON + hours(1))).toBe(
			estimateBac(backwards, PROFILE, NOON + hours(1))
		);
	});

	it('is zero when the clock is before the first drink', () => {
		expect(estimateBac([{ atMs: NOON, ethanolMl: BEER }], PROFILE, NOON - minutes(5))).toBe(0);
	});
});

describe('hoursToSober', () => {
	it('is zero when already sober', () => {
		expect(hoursToSober(0)).toBe(0);
	});

	it('divides by the elimination rate', () => {
		expect(hoursToSober(ELIMINATION_PER_HOUR * 2)).toBeCloseTo(2, 6);
	});
});
