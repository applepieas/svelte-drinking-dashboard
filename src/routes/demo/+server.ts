import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { DEMO_CODE } from '$lib/demo';
import { demoExists } from '$lib/server/demo';

/** A short, memorable link to hand out. The demo itself is an ordinary event. */
export const GET: RequestHandler = async () => {
	if (!(await demoExists())) {
		error(503, 'Ukázková akce se právě připravuje. Zkus to za chvíli.');
	}
	redirect(307, `/a/${DEMO_CODE}`);
};
