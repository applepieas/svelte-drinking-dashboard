/**
 * What a new code may contain.
 *
 * I, L, O, 0 and 1 are out because they are not distinguishable from one another
 * at a glance. 7 is out for the same reason wearing a different hat: the screen
 * sets codes in a pixel face whose seven is a bare diagonal, and people read it
 * off a wall and type it into a phone. A character nobody can name is no use in
 * a code however well it is drawn.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ2345689';
/**
 * What an existing code may contain. Codes handed out before 7 was dropped are
 * still painted on somebody's wall, so they have to keep resolving; they simply
 * stop being issued.
 */
const ACCEPTED = `${ALPHABET}7`;
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
	return [...code].every((char) => ACCEPTED.includes(char)) ? code : null;
}
