import type { Actions, PageServerLoad } from './$types';
import { switchDrink } from '$lib/server/host';
import { getEventByCode, getRecentEventEntries } from '$lib/server/queries';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { event } = await parent();
	const joinUrl = new URL(`/a/${event.code}/pripojit`, url.origin).toString();

	// The layout already proved this code resolves.
	const row = await getEventByCode(event.code);
	const entries = row ? await getRecentEventEntries(row.id) : [];

	// Raw log, not a summary: the page reduces it, and keeps reducing it as more
	// rows arrive over the stream. The QR is a separate cached response.
	return { entries, joinUrl };
};

export const actions: Actions = {
	// The hidden dial on the board. Host only, like the same switch in Správa.
	napoj: (requestEvent) => switchDrink(requestEvent, (code) => `/a/${code}`)
};
