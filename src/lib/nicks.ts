export const NICK_MIN = 2;
export const NICK_MAX = 20;

/**
 * Rejects characters that have no business in a nick rendered on a shared
 * screen: C0/C1 controls, and the bidi overrides that can reorder an entire
 * line of the leaderboard around them.
 */
function hasUnsafeChars(nick: string): boolean {
	for (const char of nick) {
		const code = char.codePointAt(0) ?? 0;
		if (code < 0x20 || code === 0x7f) return true;
		if (code >= 0x202a && code <= 0x202e) return true;
		if (code >= 0x2066 && code <= 0x2069) return true;
	}
	return false;
}

/**
 * The only free text in the app. Unsafe input is rejected rather than stripped:
 * silently handing someone a different nick than they typed is worse than
 * telling them to pick another one.
 */
export function normalizeNick(raw: string): string | null {
	const nick = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
	if (nick.length < NICK_MIN || nick.length > NICK_MAX) return null;
	if (hasUnsafeChars(nick)) return null;
	return nick;
}
