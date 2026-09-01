import { browser } from '$app/environment';
import { isValidProfile, type BacProfile } from './bac';

const KEY = 'naex.profile';

/**
 * Body weight and sex never leave the device: no cookie, no request body, no
 * column. The estimate is computed in the browser from data the server already
 * has (what was drunk and when) plus this, which it never sees.
 */
export function readProfile(): BacProfile | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		return isValidProfile(parsed as Partial<BacProfile>) ? (parsed as BacProfile) : null;
	} catch {
		// Private mode, blocked storage, or someone hand-edited the value.
		return null;
	}
}

export function writeProfile(profile: BacProfile): void {
	if (!browser) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(profile));
	} catch {
		// Nothing to do: the estimate simply will not persist across reloads.
	}
}

export function clearProfile(): void {
	if (!browser) return;
	try {
		localStorage.removeItem(KEY);
	} catch {
		// Ignored for the same reason.
	}
}
