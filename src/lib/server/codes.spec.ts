import { describe, expect, it } from 'vitest';
import { generateCode, normalizeCode } from './codes';

describe('normalizeCode', () => {
	it('accepts a code that is already canonical', () => {
		expect(normalizeCode('62NW5Q')).toBe('62NW5Q');
	});

	it('uppercases what the user typed', () => {
		expect(normalizeCode('62nw5q')).toBe('62NW5Q');
	});

	it.each([
		['spaces', '62N W5Q'],
		['a hyphen', '62N-W5Q'],
		['surrounding whitespace', '  62nw5q\n'],
		['a mix of everything', ' 62n-w 5q ']
	])('ignores %s', (_label, input) => {
		expect(normalizeCode(input)).toBe('62NW5Q');
	});

	it.each([
		['empty', ''],
		['too short', '62NW5'],
		['too long', '62NW5QQ']
	])('rejects a %s value', (_label, input) => {
		expect(normalizeCode(input)).toBeNull();
	});

	// I, L, O, 0 and 1 are left out of the alphabet so codes read off a screen
	// cannot be ambiguous. A code containing them was mistyped, not mis-cased,
	// and there is nothing safe to map it onto.
	it.each(['62NW5I', '62NW5L', '62NW5O', '62NW50', '62NW51'])(
		'rejects %s, which uses a character outside the alphabet',
		(input) => {
			expect(normalizeCode(input)).toBeNull();
		}
	);

	it('rejects a value that is only long enough once punctuation is counted', () => {
		expect(normalizeCode('62N-W5')).toBeNull();
	});
});

describe('generateCode', () => {
	const codes = Array.from({ length: 500 }, generateCode);

	it('always produces a code that normalizeCode accepts unchanged', () => {
		for (const code of codes) {
			expect(normalizeCode(code)).toBe(code);
		}
	});

	// Deliberately weak: this catches a generator stuck on one value without
	// depending on the odds of a collision, which would make the test flaky.
	it('does not return a constant', () => {
		expect(new Set(codes).size).toBeGreaterThan(1);
	});
});
