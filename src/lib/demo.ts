import type { DrinkDef, DrinkKey } from './drinks';

/** Fixed so `/demo` can always find it. Uses only characters the alphabet allows. */
export const DEMO_CODE = 'UKAZKA';
export const DEMO_NAME = 'Ukázková párty';

/**
 * Invented, and deliberately so. Real events this was used at had real people on
 * the board, and none of those names belong on a public demo.
 */
export const DEMO_ROSTER = [
	'pixelpetr',
	'modra_liska',
	'honza.exe',
	'kapitan_nula',
	'barborka',
	'tichy_tomas'
] as const;

/** How long a demo party runs before it is wiped and started again. */
export const DEMO_RESET_HOURS = 6;
/** How much history a freshly seeded demo starts with. */
export const DEMO_BACKFILL_MINUTES = 150;

export interface PlannedDrink {
	nick: string;
	drinkKey: DrinkKey;
	/** Stable across repeated runs, which is what makes a tick idempotent. */
	submissionId: string;
}

/**
 * Deterministic hash. A given minute always produces the same drink by the same
 * person, so two overlapping maintenance runs write the same row rather than two
 * — the unique index on (event_id, submission_id) then collapses them.
 */
function scramble(value: number): number {
	let x = Math.trunc(value) ^ 0x5f3a7c1d;
	x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
	x = Math.imul(x ^ (x >>> 12), 0x297a2d39);
	return (x ^ (x >>> 15)) >>> 0;
}

/**
 * Roughly one minute in five carries a drink. Spread over the roster that is
 * about one drink per person every half hour.
 *
 * The figure is deliberate rather than arbitrary. A denser timeline fills the
 * board faster, but the demo is the first thing anyone sees, and it should not
 * depict a rate of drinking that nobody should be presenting as ordinary.
 */
const MINUTES_PER_DRINK = 5;

/** What the demo party does in a given minute, or nothing. */
export function planMinute(minuteIndex: number, drinks: DrinkDef[]): PlannedDrink | null {
	if (drinks.length === 0) return null;

	const roll = scramble(minuteIndex);
	if (roll % MINUTES_PER_DRINK !== 0) return null;

	return {
		nick: DEMO_ROSTER[scramble(minuteIndex + 1) % DEMO_ROSTER.length],
		drinkKey: drinks[scramble(minuteIndex + 2) % drinks.length].key,
		submissionId: `demo-${minuteIndex}`
	};
}

/** Whole minutes since the epoch — the unit the demo timeline is built on. */
export function minuteIndex(at: Date | number): number {
	return Math.floor((at instanceof Date ? at.getTime() : at) / 60_000);
}
