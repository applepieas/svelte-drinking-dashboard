/**
 * How big the cards are for everybody who is not on a medal.
 *
 * A board hangs on whatever the host has: a laptop on a table, read from half a
 * metre, or a television across a room. No single size is right for both, so
 * this is a dial the host turns until the room can read it.
 *
 * The dial sets the size. How many rows then fit is measured on the night, not
 * guessed here — the alternative is a board that either clips somebody in half
 * or leaves a strip of empty cream under the last row.
 */
export interface Density {
	/** What the host sees while turning the dial. */
	label: string;
	/** Small cards across. */
	columns: number;
	/** Multiplies the small cards' type and padding. */
	scale: number;
}

export const DENSITIES: readonly Density[] = [
	{ label: 'Velké', columns: 3, scale: 1.2 },
	{ label: 'Střední', columns: 4, scale: 1 },
	{ label: 'Menší', columns: 5, scale: 0.86 },
	{ label: 'Drobné', columns: 6, scale: 0.74 },
	{ label: 'Nejmenší', columns: 8, scale: 0.62 }
];

/** Where a board starts before anybody has touched the dial. */
export const DEFAULT_DENSITY = 1;

/** How many people keep a mat of their own at the top of the board. */
export const TOP_TIER = 5;

export interface Split {
	/** People on the big mats. */
	top: number;
	/** People on a small card below them. */
	small: number;
	/** People who are only a number at the bottom. */
	rest: number;
}

/**
 * Divides a leaderboard between the three ways the screen can show somebody.
 *
 * One person left over would be a line of text standing in for a single card,
 * which is both uglier and longer than the card, so the last row stretches by
 * one rather than leaving them out.
 */
export function split(people: number, columns: number, rows: number): Split {
	const top = Math.min(people, TOP_TIER);
	const after = people - top;
	const capacity = Math.max(0, columns * rows);
	if (after <= capacity + 1) return { top, small: after, rest: 0 };
	return { top, small: capacity, rest: after - capacity };
}

/** "ještě 1 člověk", "další 2 lidé", "dalších 7 lidí" — Czech counting again. */
export function others(n: number): string {
	if (n === 1) return 'A ještě 1 člověk';
	if (n > 1 && n < 5) return `A další ${n} lidé`;
	return `A dalších ${n} lidí`;
}

/** Keeps the dial inside the presets however it is nudged. */
export function clampStep(step: number): number {
	return Math.min(DENSITIES.length - 1, Math.max(0, Math.round(step)));
}

/**
 * How many rows of cards fit in the space left under the medals.
 *
 * Deliberately pessimistic about the gap: a row too few leaves a little cream
 * at the bottom, a row too many cuts somebody's name in half on a wall.
 */
export function rowsThatFit(available: number, cardHeight: number, gap = 10): number {
	if (cardHeight <= 0) return 0;
	return Math.max(0, Math.floor((available + gap) / (cardHeight + gap)));
}
