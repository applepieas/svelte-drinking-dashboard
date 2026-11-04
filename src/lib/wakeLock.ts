/**
 * Keeps the screen on while the board is showing.
 *
 * Nobody touches the board during a party, so without this the TV or laptop
 * dims and locks a few minutes in. The browser drops the lock whenever the tab
 * is hidden, so it is asked for again each time the tab comes back.
 *
 * Best effort: a browser without the API, or one that refuses (battery saver,
 * plain http on a LAN address), just behaves as before. Returns the cleanup.
 */
export function keepScreenAwake(): () => void {
	if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return () => {};

	let lock: WakeLockSentinel | null = null;
	let stopped = false;

	const request = async () => {
		if (stopped || document.visibilityState !== 'visible') return;
		try {
			lock = await navigator.wakeLock.request('screen');
		} catch {
			lock = null;
		}
	};

	const onVisibility = () => void request();
	document.addEventListener('visibilitychange', onVisibility);
	void request();

	return () => {
		stopped = true;
		document.removeEventListener('visibilitychange', onVisibility);
		void lock?.release().catch(() => {});
		lock = null;
	};
}
