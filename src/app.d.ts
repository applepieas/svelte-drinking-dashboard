declare global {
  namespace App {
    interface Locals {
      cookieId: string;
    }
    interface Platform {
      env: Env;
      context: { waitUntil(promise: Promise<unknown>): void };
    }
  }
}
export {};