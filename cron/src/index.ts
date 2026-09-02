/**
 * Calls the app's maintenance endpoint on a schedule.
 *
 * It is a separate Worker because `adapter-cloudflare` generates a worker that
 * exports only `fetch`, so a Cron Trigger has nothing to invoke on the app
 * itself.
 *
 * The call goes through a service binding rather than the app's public address.
 * Cloudflare refuses a plain `fetch()` from one Worker to another on the same
 * account — it answers with error 1042 — and a binding is the supported way,
 * with the side benefit of never leaving Cloudflare's network.
 */
export interface Env {
	/** Service binding to the app Worker. */
	APP: Fetcher;
	/** Absolute URL of the maintenance endpoint; used for its path and origin. */
	MAINTENANCE_URL: string;
	MAINTENANCE_SECRET: string;
}

export default {
	async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(
			(async () => {
				const response = await env.APP.fetch(env.MAINTENANCE_URL, {
					method: 'POST',
					headers: { authorization: `Bearer ${env.MAINTENANCE_SECRET}` }
				});

				// Logged rather than thrown: a failed run is not worth retrying,
				// the next tick is two minutes away and the work is idempotent.
				if (!response.ok) {
					console.error(`maintenance failed: ${response.status} ${await response.text()}`);
					return;
				}

				console.log('maintenance', await response.text());
			})()
		);
	}
} satisfies ExportedHandler<Env>;
