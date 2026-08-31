import { describe, expect, it } from 'vitest';
import { NICK_MAX, NICK_MIN, normalizeNick } from './nicks';

/**
 * Characters under test are built from code points on purpose: writing them
 * literally would leave invisible bytes in this file, where nobody reviewing it
 * could see what is being asserted.
 */
const char = (code: number) => String.fromCodePoint(code);
const nickWith = (code: number) => `petr${char(code)}`;

const TAB = 0x09;
const NEWLINE = 0x0a;
const COMBINING_ACUTE = 0x0301;

const CONTROL_CHARS = [
	[0x00, 'null'],
	[0x1b, 'escape'],
	[0x7f, 'delete']
] as const;

// Bidi controls reorder the text around them, so one of these inside a nick can
// scramble an entire row of the leaderboard on the shared screen.
const BIDI_CHARS = [
	[0x202a, 'left-to-right embedding'],
	[0x202e, 'right-to-left override'],
	[0x2066, 'first-strong isolate'],
	[0x2069, 'pop directional isolate']
] as const;

describe('normalizeNick', () => {
	it('accepts a plain nick unchanged', () => {
		expect(normalizeNick('pixelpetr')).toBe('pixelpetr');
	});

	it('keeps Czech diacritics', () => {
		expect(normalizeNick('Bára')).toBe('Bára');
	});

	it('trims surrounding whitespace', () => {
		expect(normalizeNick('  Honza  ')).toBe('Honza');
	});

	it('collapses a doubled space', () => {
		expect(normalizeNick('Modra  Liska')).toBe('Modra Liska');
	});

	it.each([
		[TAB, 'a tab'],
		[NEWLINE, 'a newline']
	])('collapses %i (%s) into a single space', (code) => {
		expect(normalizeNick(`Modra${char(code)}Liska`)).toBe('Modra Liska');
	});

	// Composed and decomposed forms look identical on screen. Without NFC they
	// would be two different nicks and the unique index would admit both.
	it('normalises a decomposed character to its composed form', () => {
		expect(normalizeNick(`Be${char(COMBINING_ACUTE)}ta`)).toBe('Béta');
	});

	it.each([
		['empty', ''],
		['only whitespace', '   '],
		['one character', 'a'],
		['one character once trimmed', ' x ']
	])('rejects a %s nick as too short', (_label, input) => {
		expect(normalizeNick(input)).toBeNull();
	});

	it('rejects a nick over the limit', () => {
		expect(normalizeNick('a'.repeat(NICK_MAX + 1))).toBeNull();
	});

	it('accepts a nick exactly at the limit', () => {
		const nick = 'a'.repeat(NICK_MAX);
		expect(normalizeNick(nick)).toBe(nick);
	});

	it('accepts a nick exactly at the minimum', () => {
		const nick = 'a'.repeat(NICK_MIN);
		expect(normalizeNick(nick)).toBe(nick);
	});

	it.each(CONTROL_CHARS)('rejects a nick containing %i (%s)', (code) => {
		expect(normalizeNick(nickWith(code))).toBeNull();
	});

	it.each(BIDI_CHARS)('rejects a nick containing %i (%s)', (code) => {
		expect(normalizeNick(nickWith(code))).toBeNull();
	});
});
