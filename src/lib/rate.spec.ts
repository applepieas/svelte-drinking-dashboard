import { describe, expect, it } from 'vitest';
import { MINUTE_MS, slidingWindow } from './rate';

const NOW = Date.UTC(2026, 0, 1, 22, 0, 0);
const agoSeconds = (n: number) => NOW - n * 1000;

describe('slidingWindow', () => {
	it('allows the first attempt', () => {
		expect(slidingWindow([], 6, MINUTE_MS, NOW)).toEqual({ allowed: true, retryAfter: 0 });
	});

	it('allows one below the limit', () => {
		const hits = [1, 2, 3, 4, 5].map(agoSeconds);
		expect(slidingWindow(hits, 6, MINUTE_MS, NOW).allowed).toBe(true);
	});

	it('blocks exactly at the limit', () => {
		const hits = [1, 2, 3, 4, 5, 6].map(agoSeconds);
		expect(slidingWindow(hits, 6, MINUTE_MS, NOW).allowed).toBe(false);
	});

	it('ignores hits that have aged out of the window', () => {
		const hits = [61, 62, 63, 64, 65, 66].map(agoSeconds);
		expect(slidingWindow(hits, 6, MINUTE_MS, NOW).allowed).toBe(true);
	});

	// A fixed bucket would let someone spend a whole allowance either side of a
	// boundary; a sliding window frees exactly one slot at a time.
	it('reports when the oldest blocking hit ages out', () => {
		const hits = [50, 40, 30, 20, 10, 1].map(agoSeconds);
		expect(slidingWindow(hits, 6, MINUTE_MS, NOW).retryAfter).toBe(10);
	});

	it('never reports zero seconds while blocked', () => {
		const hits = Array.from({ length: 6 }, () => agoSeconds(59.9));
		const verdict = slidingWindow(hits, 6, MINUTE_MS, NOW);
		expect(verdict.allowed).toBe(false);
		expect(verdict.retryAfter).toBeGreaterThanOrEqual(1);
	});

	it('does not depend on the order it is given', () => {
		const hits = [30, 5, 50, 1, 20, 10].map(agoSeconds);
		expect(slidingWindow(hits, 6, MINUTE_MS, NOW)).toEqual(
			slidingWindow([...hits].reverse(), 6, MINUTE_MS, NOW)
		);
	});
});
