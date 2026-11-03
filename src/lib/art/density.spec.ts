import { describe, expect, it } from 'vitest';
import { clampStep, DENSITIES, others, rowsThatFit, split, TOP_TIER } from './density';

describe('split', () => {
	it('gives everybody a big mat while there are few enough', () => {
		expect(split(4, 4, 2)).toEqual({ top: 4, small: 0, rest: 0 });
	});

	it('fills the top tier first', () => {
		const { top, small } = split(9, 4, 2);
		expect(top).toBe(TOP_TIER);
		expect(small).toBe(4);
	});

	// The party this was built for: twenty-five people, one screen. Wide cards
	// leave a tail, small ones fit the room.
	it('shows everybody at twenty-five once the cards are small enough', () => {
		expect(split(25, 8, 3).rest).toBe(0);
		expect(split(25, 3, 2).rest).toBeGreaterThan(0);
	});

	it('never loses anybody', () => {
		for (const columns of [3, 4, 5, 6, 8]) {
			for (const rows of [0, 1, 2, 4]) {
				for (const people of [0, 1, 5, 6, 12, 25, 60]) {
					const { top, small, rest } = split(people, columns, rows);
					expect(top + small + rest).toBe(people);
				}
			}
		}
	});

	// A line of text standing in for one card is longer than the card it saves.
	it('stretches by one rather than leaving a single person to a caption', () => {
		const { small, rest } = split(TOP_TIER + 9, 4, 2);
		expect(rest).toBe(0);
		expect(small).toBe(9);
	});

	it('starts captioning once two or more would be left out', () => {
		expect(split(TOP_TIER + 10, 4, 2).rest).toBe(2);
	});

	it('puts everybody in the caption when there is no room for cards at all', () => {
		expect(split(20, 4, 0)).toEqual({ top: 5, small: 0, rest: 15 });
	});
});

describe('rowsThatFit', () => {
	it('counts a row only when the whole card and its gap are there', () => {
		expect(rowsThatFit(100, 45, 10)).toBe(2);
		expect(rowsThatFit(99, 45, 10)).toBe(1);
	});

	it('does not need a gap under the last row', () => {
		expect(rowsThatFit(45, 45, 10)).toBe(1);
	});

	it('reports nothing rather than guessing before a card has been measured', () => {
		expect(rowsThatFit(500, 0)).toBe(0);
	});

	it('never returns a negative number of rows', () => {
		expect(rowsThatFit(-50, 40)).toBe(0);
	});
});

describe('others', () => {
	it.each([
		[1, 'A ještě 1 člověk'],
		[2, 'A další 2 lidé'],
		[4, 'A další 4 lidé'],
		[5, 'A dalších 5 lidí'],
		[12, 'A dalších 12 lidí']
	])('counts %i the way Czech does', (n, expected) => {
		expect(others(n)).toBe(expected);
	});
});

describe('clampStep', () => {
	it('keeps the dial on a preset', () => {
		expect(clampStep(-3)).toBe(0);
		expect(clampStep(99)).toBe(DENSITIES.length - 1);
		expect(clampStep(2.4)).toBe(2);
	});
});
