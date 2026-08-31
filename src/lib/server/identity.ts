import type { RequestEvent } from '@sveltejs/kit';

export const IDENTITY_COOKIE = 'pid';

/** Matches event retention: the cookie must not outlive the data it points at. */
const MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Issues an anonymous device id, but only once something actually needs one —
 * shared screens and passers-by never get a cookie. The value identifies a
 * browser, not a person: no nick, no profile, nothing readable.
 */
export function ensureCookieId(event: RequestEvent): string {
	if (event.locals.cookieId) return event.locals.cookieId;

	const cookieId = crypto.randomUUID();
	event.cookies.set(IDENTITY_COOKIE, cookieId, { path: '/', maxAge: MAX_AGE });
	// Also on locals, so the rest of this same request can see it.
	event.locals.cookieId = cookieId;
	return cookieId;
}
