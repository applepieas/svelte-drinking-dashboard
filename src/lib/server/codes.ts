const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0, 1
const LENGTH = 6;

/**
 * Rejection sampling keeps every character equally likely. 256 is not divisible by
 * the alphabet length, so a plain modulo would favour the first few characters.
 */
function randomChar(): string {
	const limit = 256 - (256 % ALPHABET.length);
	const buf = new Uint8Array(1);
	for (;;) {
		crypto.getRandomValues(buf);
		if (buf[0] < limit) return ALPHABET[buf[0] % ALPHABET.length];
	}
}

/** Random, not sequential: event codes must not be enumerable. */
export function generateCode(): string {
	let code = '';
	for (let i = 0; i < LENGTH; i++) code += randomChar();
	return code;
}

/**
 * Codes get read off a screen and retyped, so they arrive lowercased, spaced or
 * hyphenated. Normalising on the server means the input field can stay dumb.
 * Returns null when the value cannot be a code at all.
 */
export function normalizeCode(raw: string): string | null {
	const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
	if (code.length !== LENGTH) return null;
	return [...code].every((char) => ALPHABET.includes(char)) ? code : null;
}
