import type { Handle, HandleServerError } from '@sveltejs/kit';
import { IDENTITY_COOKIE } from '$lib/server/identity';

export const handle: Handle = async ({ event, resolve }) => {
	// Read only — the cookie is issued on demand, see ensureCookieId().
	event.locals.cookieId = event.cookies.get(IDENTITY_COOKIE) ?? null;
	return resolve(event);
};

/**
 * Only unexpected failures reach here — anything raised with `error()` keeps the
 * message it was given. So this must never pass `error` through to the client:
 * it is a stack trace or a database message, and the page shows it verbatim.
 */
export const handleError: HandleServerError = ({ error, event, status }) => {
	if (status !== 404) {
		console.error(`[${event.request.method} ${event.url.pathname}]`, error);
	}
	return { message: status === 404 ? 'Stránka nenalezena.' : 'Něco se pokazilo. Zkus to znovu.' };
};
