import type { Actions, PageServerLoad } from './$types';
import { hostActions } from '$lib/server/host';
import { getEventByCode, getRecentEventEntries, listParticipants } from '$lib/server/queries';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { event, isHost } = await parent();
	const joinUrl = new URL(`/a/${event.code}/pripojit`, url.origin).toString();

	// The layout already proved this code resolves.
	const row = await getEventByCode(event.code);
	const entries = row ? await getRecentEventEntries(row.id) : [];

	// The settings panel lists everybody for kicking. Only the host gets it:
	// whoever else is looking at the board has no use for the ids.
	const participants = row && isHost ? await listParticipants(row.id) : [];

	// Raw log, not a summary: the page reduces it, and keeps reducing it as more
	// rows arrive over the stream. The QR is a separate cached response.
	return { entries, joinUrl, participants };
};

// The board is where the host already is - the event was created on this
// screen - so its settings panel carries every host action Správa has.
export const actions: Actions = hostActions((code) => `/a/${code}`);
