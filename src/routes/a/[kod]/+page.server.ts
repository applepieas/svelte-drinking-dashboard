import type { PageServerLoad } from './$types';
import { encodeQrPath } from '$lib/server/qr';
import { getEventByCode, getEventEntries } from '$lib/server/queries';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { event } = await parent();
	const joinUrl = new URL(`/a/${event.code}/pripojit`, url.origin).toString();

	// The layout already proved this code resolves.
	const row = await getEventByCode(event.code);
	const entries = row ? await getEventEntries(row.id) : [];

	// Raw log, not a summary: the page reduces it, and keeps reducing it as more
	// rows arrive over the stream.
	return { entries, joinUrl, qr: encodeQrPath(joinUrl) };
};
