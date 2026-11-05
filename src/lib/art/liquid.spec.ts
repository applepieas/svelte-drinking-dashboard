import { describe, expect, it } from 'vitest';
import { DENSITY, Liquid } from './liquid';
import type { DrinkKey } from '$lib/drinks';

const KEYS: DrinkKey[] = ['beer', 'wine', 'shot', 'soft'];

/** Seeded, so a failure is a failure rather than a bad afternoon. */
function mulberry32(seed: number): () => number {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Small glass, fixed dice: the rules are the same, the test is quick. */
function glass(seed = 1, mixing = 6) {
	return new Liquid(KEYS, { width: 20, height: 40, mixing, random: mulberry32(seed) });
}

function settle(liquid: Liquid, steps = 600) {
	liquid.tick(steps);
}

describe('the glass', () => {
	it('has an inside smaller than the rectangle it is cut from', () => {
		const liquid = glass();
		expect(liquid.capacity).toBeGreaterThan(0);
		expect(liquid.capacity).toBeLessThan(liquid.width * liquid.height);
	});

	it('keeps every drop inside the walls', () => {
		const liquid = glass();
		for (const key of KEYS) liquid.pour(key, 80);
		settle(liquid);

		for (let i = 0; i < liquid.grid.length; i++) {
			if (liquid.grid[i] !== 0) expect(liquid.mask[i]).toBe(1);
		}
	});

	it('never holds more than it can', () => {
		const liquid = glass();
		liquid.pour('beer', liquid.capacity * 3);
		settle(liquid, 1200);
		expect(liquid.filled).toBeLessThanOrEqual(liquid.capacity);
	});
});

describe('layering', () => {
	// The point of the whole thing: poured in any order, they end up stacked by
	// density. Row 0 is the rim, so a heavier drink has the larger mean row.
	it('stacks the drinks by density whatever order they went in', () => {
		const liquid = glass();
		for (const key of ['shot', 'soft', 'wine', 'beer'] as DrinkKey[]) liquid.pour(key, 70);
		settle(liquid, 900);

		const depth = KEYS.map((key) => ({ key, row: liquid.meanRow(key) }));
		const byDepth = [...depth].sort((a, b) => b.row - a.row).map((item) => item.key);
		const byDensity = [...KEYS].sort((a, b) => DENSITY[b] - DENSITY[a]);

		expect(byDepth).toEqual(byDensity);
	});

	it('puts the lightest drink above the heaviest, not merely somewhere else', () => {
		const liquid = glass();
		liquid.pour('soft', 90);
		liquid.pour('shot', 90);
		settle(liquid, 900);

		expect(liquid.meanRow('shot')).toBeLessThan(liquid.meanRow('soft'));
	});

	it('levels out instead of building a cone', () => {
		const liquid = glass(7, 0);
		liquid.pour('beer', 200);
		settle(liquid, 900);

		// The widths of the top two occupied rows differ by a little, not by the
		// slope a heap would leave.
		const rows: number[] = [];
		for (let y = 0; y < liquid.height; y++) {
			let n = 0;
			for (let x = 0; x < liquid.width; x++) if (liquid.grid[y * liquid.width + x] !== 0) n++;
			if (n > 0) rows.push(n);
		}
		expect(rows.length).toBeGreaterThan(3);
		expect(Math.abs(rows[1] - rows[2])).toBeLessThan(liquid.width / 2);
	});
});

describe('taking a drink back', () => {
	it('removes what was poured', () => {
		const liquid = glass();
		liquid.pour('beer', 60);
		settle(liquid, 200);
		const before = liquid.filled;

		liquid.drain('beer', 30);
		expect(liquid.filled).toBe(before - 30);
	});

	it('cancels a pour that has not landed yet rather than digging it out', () => {
		const liquid = glass();
		liquid.pour('wine', 100);
		liquid.tick(2);

		const inGlass = liquid.filled;
		liquid.drain('wine', 60);

		// Everything still queued is cancelled first, so the glass keeps what it
		// already caught.
		expect(liquid.filled).toBe(inGlass);
		expect(liquid.pending).toBe(Math.max(0, 100 - inGlass - 60));
	});

	it('does nothing for a drink the glass does not pour', () => {
		const liquid = new Liquid(['beer'], { width: 20, height: 40, random: mulberry32(3) });
		liquid.pour('wine', 50);
		liquid.tick(20);
		expect(liquid.filled).toBe(0);
	});
});

describe('making room', () => {
	it('keeps the mix when it throws half away', () => {
		const liquid = glass();
		liquid.pour('beer', 120);
		liquid.pour('soft', 60);
		settle(liquid, 500);

		const before = liquid.counts();
		liquid.thin(0.5);
		const after = liquid.counts();

		const ratio = (counts: Record<string, number>) => counts.beer / counts.soft;
		expect(after.beer + after.soft).toBeLessThan(before.beer + before.soft);
		expect(ratio(after)).toBeCloseTo(ratio(before), 0);
	});

	it('empties completely when asked', () => {
		const liquid = glass();
		liquid.pour('beer', 80);
		settle(liquid, 200);
		liquid.empty();
		expect(liquid.filled).toBe(0);
		expect(liquid.pending).toBe(0);
	});
});
