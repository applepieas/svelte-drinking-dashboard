/**
 * Host tokens authorise closing or deleting an event. They are bearer tokens:
 * whoever holds one can act as the host, so only their SHA-256 digest is stored.
 * A leaked database dump therefore contains no usable credentials.
 *
 * Web Crypto is used rather than node:crypto so this runs unchanged on Workers.
 */

/** Creates a fresh 128-bit host token. Return this to the client; never store it. */
export function newHostToken(): string {
	return crypto.randomUUID();
}

/** SHA-256 as lowercase hex. Web Crypto, so it runs unchanged on Workers. */
export async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Digests a host token for storage and comparison.
 *
 * No salt: the input is already 128 bits of entropy, so a rainbow table is not a
 * threat and a per-row salt would only prevent looking a token up by its hash.
 */
export function hashToken(token: string): Promise<string> {
	return sha256Hex(token);
}
