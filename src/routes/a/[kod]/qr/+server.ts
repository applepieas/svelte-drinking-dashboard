import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { QUIET_ZONE } from '$lib/qr';
import { normalizeCode } from '$lib/server/codes';
import { encodeQrPath } from '$lib/server/qr';

/**
 * The join code as an image.
 *
 * Served separately from the screen rather than inlined into it, for two
 * reasons. Encoding is the most expensive thing the dashboard did, on a runtime
 * that allows 10 ms of CPU per request; and the result never changes for a given
 * code, so as its own response it can be cached at the edge and the Worker stops
 * running for it at all.
 */
export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	const code = normalizeCode(params.kod);
	if (!code) error(404, 'Akce nenalezena');

	// Deliberately not checked against the database: this encodes a URL, and a
	// code that does not exist simply produces a QR leading to a 404.
	const { extent, d } = encodeQrPath(new URL(`/a/${code}/pripojit`, url.origin).toString());

	setHeaders({ 'cache-control': 'public, max-age=86400, immutable' });

	return new Response(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-QUIET_ZONE} ${-QUIET_ZONE} ${extent} ${extent}" shape-rendering="crispEdges">` +
			`<rect x="${-QUIET_ZONE}" y="${-QUIET_ZONE}" width="${extent}" height="${extent}" fill="#fff"/>` +
			`<path d="${d}" fill="#000"/>` +
			`</svg>`,
		{ headers: { 'content-type': 'image/svg+xml' } }
	);
};
