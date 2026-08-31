declare global {
  namespace App {
    interface Locals {
      cookieId: string;
    }
    interface Platform {
      env: { DATABASE_URL: string };
      context: { waitUntil(promise: Promise<unknown>): void };
    }
  }
}
export {};