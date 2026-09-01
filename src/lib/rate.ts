/** Roughly a drink every ten seconds, with room for a short burst. */
export const DRINKS_PER_MINUTE = 6;
export const EVENTS_PER_HOUR_PER_IP = 10;
/** Beyond this the leaderboard stops being readable on a screen anyway. */
export const MAX_PARTICIPANTS = 60;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;

export interface RateVerdict {
	allowed: boolean;
	/** Seconds until the next attempt can succeed. Zero when allowed. */
	retryAfter: number;
}

/**
 * Sliding window rather than fixed buckets: a fixed bucket lets someone spend a
 * whole allowance at 12:59:59 and another at 13:00:00.
 *
 * Pure and free of database imports, so the awkward cases — exactly at the
 * limit, timestamps out of order, an empty history — are unit tests rather than
 * guesswork.
 */
export function slidingWindow(
	timestampsMs: number[],
	limit: number,
	windowMs: number,
	nowMs: number
): RateVerdict {
	const inWindow = timestampsMs.filter((at) => nowMs - at < windowMs).sort((a, b) => a - b);
	if (inWindow.length < limit) return { allowed: true, retryAfter: 0 };

	// The oldest hit still counting against us; when it ages out, a slot frees up.
	const blocking = inWindow[inWindow.length - limit];
	return {
		allowed: false,
		retryAfter: Math.max(1, Math.ceil((blocking + windowMs - nowMs) / 1000))
	};
}
