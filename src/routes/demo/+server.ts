import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { DEMO_CODE } from '$lib/demo';
import { demoExists, maintainIfDue } from '$lib/server/demo';

/**
 * A short, memorable link to hand out. The demo itself is an ordinary event.
 *
 * Nothing seeds the demo on a timer any more, so the first visit after it has
 * been wiped builds it here. That one visitor waits a moment; everybody after
 * them walks straight through.
 */
export const GET: RequestHandler = async () => {
	if (!(await demoExists())) {
		await maintainIfDue().catch((reason) => {
			console.error('demo seed failed', reason);
		});
	}
	if (!(await demoExists())) {
		error(503, 'Ukázková akce se právě připravuje. Zkus to za chvíli.');
	}
	redirect(307, `/a/${DEMO_CODE}`);
};
