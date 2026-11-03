import type { Actions, PageServerLoad } from './$types';
import { hostActions, requireHost } from '$lib/server/host';
import { listParticipants } from '$lib/server/queries';

export const load: PageServerLoad = async (loadEvent) => {
	const { event } = await requireHost(loadEvent);
	return { participants: await listParticipants(event.id) };
};

export const actions: Actions = hostActions((code) => `/a/${code}/sprava`);
