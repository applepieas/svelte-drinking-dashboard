declare global {
	namespace App {
		interface Locals {
			cookieId: string | null;
		}
		interface Platform {
			env: Env;
			context: { waitUntil(promise: Promise<unknown>): void };
		}
	}
}
export {};
