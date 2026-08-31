import type { Handle } from '@sveltejs/kit';
import { IDENTITY_COOKIE } from '$lib/server/identity';

export const handle: Handle = async ({ event, resolve }) => {
	// Read only — the cookie is issued on demand, see ensureCookieId().
	event.locals.cookieId = event.cookies.get(IDENTITY_COOKIE) ?? null;
	return resolve(event);
};
