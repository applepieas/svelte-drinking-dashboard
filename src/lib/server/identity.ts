import type { RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/environment';

export const IDENTITY_COOKIE = 'pid';

/**
 * How every cookie here is written.
 *
 * `secure` is the awkward one. SvelteKit sets it on every host except literally
 * `localhost`, and a browser refuses to store a `Secure` cookie that arrived
 * over plain http - so in development the phone that scans the QR code joins,
 * is handed an identity it cannot keep, and lands back on the join page being
 * told its own nick is taken. Development is served over http by LAN address,
 * production over https, so the flag follows the build rather than the host.
 */
export const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax', secure: !dev } as const;

/** Matches event retention: the cookie must not outlive the data it points at. */
const MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Issues an anonymous device id, but only once something actually needs one —
 * shared screens and passers-by never get a cookie. The value identifies a
 * browser, not a person: no nick, no profile, nothing readable.
 */
export function ensureCookieId(event: RequestEvent): string {
	if (event.locals.cookieId) return event.locals.cookieId;
	return freshCookieId(event);
}

/**
 * Makes this browser somebody new. The old id is forgotten here and nowhere
 * else: its participant row and drinks stay in the event, so the person it was
 * stays on the board.
 */
export function freshCookieId(event: RequestEvent): string {
	const cookieId = crypto.randomUUID();
	event.cookies.set(IDENTITY_COOKIE, cookieId, { path: '/', maxAge: MAX_AGE, ...COOKIE_OPTIONS });
	// Also on locals, so the rest of this same request can see it.
	event.locals.cookieId = cookieId;
	return cookieId;
}
