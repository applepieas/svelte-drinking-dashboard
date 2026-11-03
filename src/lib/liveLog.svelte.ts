import { untrack } from 'svelte';
import { invalidateAll } from '$app/navigation';
import type { LogEntry } from './events';
import { mergeBySeq } from './leaderboard';

/** How long a gap may last before it is worth telling the room about. */
const RECONNECT_GRACE_MS = 8000;

export interface LiveLog {
	/** The server's snapshot with everything the stream has added since. */
	readonly entries: LogEntry[];
	readonly connected: boolean;
	/** False until the first open, so a page that never connected stays quiet. */
	readonly everConnected: boolean;
}

/**
 * Subscribes a page to an event's log and keeps the rows in one place.
 *
 * Two screens read the same event now - the standings and the glass - and both
 * want every row as it lands. The stream belongs here rather than in either of
 * them, so there is one reconnect policy and one definition of what the page is
 * looking at.
 *
 * Call it during component setup: it owns an effect, and the stream closes when
 * the component goes away.
 */
export function liveLog(code: () => string, snapshot: () => LogEntry[]): LiveLog {
	/** Rows that arrived over the stream since the last full load. */
	const streamed = $state<LogEntry[]>([]);
	let connected = $state(true);
	let everConnected = $state(false);

	// The server snapshot stays the source of truth; the stream only adds to it.
	// After invalidateAll() brings a fresh snapshot the overlap merges away.
	const entries = $derived(mergeBySeq(snapshot(), streamed));

	$effect(() => {
		const event = code();
		// untrack, or appending an entry would re-run this effect and reconnect.
		const from = untrack(() => entries.reduce((max, item) => Math.max(max, item.seq), 0));

		const source = new EventSource(`/a/${event}/udalosti?od=${from}`);

		source.addEventListener('open', () => {
			clearTimeout(graceTimer);
			connected = true;
			everConnected = true;
		});

		source.addEventListener('entry', (message) => {
			streamed.push(JSON.parse(message.data) as LogEntry);
			connected = true;
		});

		// Something the log cannot express changed — closed, or someone kicked.
		source.addEventListener('state', () => {
			void invalidateAll();
		});

		/**
		 * Streams are deliberately short-lived, so a closed connection is the
		 * normal case rather than a fault. Announcing every one of them would
		 * leave a permanent "connection lost" banner on a screen that is working
		 * perfectly, so the warning waits to see whether the reconnect succeeds.
		 */
		let graceTimer: ReturnType<typeof setTimeout> | undefined;
		source.onerror = () => {
			clearTimeout(graceTimer);
			graceTimer = setTimeout(() => (connected = false), RECONNECT_GRACE_MS);
		};

		return () => {
			clearTimeout(graceTimer);
			source.close();
		};
	});

	return {
		get entries() {
			return entries;
		},
		get connected() {
			return connected;
		},
		get everConnected() {
			return everConnected;
		}
	};
}
