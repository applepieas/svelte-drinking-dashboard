import type { LogEntry, StreamMessage } from '$lib/events';
import { getEventEntries, getEventVersion } from './queries';

export interface Subscription {
	eventId: string;
	/** Deliver everything after this sequence number, then whatever follows. */
	fromSeq: number;
	/** Returning false means the consumer is gone and polling should stop. */
	onMessage: (message: StreamMessage) => boolean;
	/**
	 * Called when this subscription has spent its query budget. The stream should
	 * close cleanly so the browser reconnects and starts a fresh one.
	 */
	onBudgetSpent: () => void;
}

export interface EventBus {
	/**
	 * Announce a new row to everyone watching. The polling bus ignores this
	 * because its subscribers find the row themselves; a Durable Object
	 * implementation would fan it out here instead.
	 */
	publish(eventId: string, entry: LogEntry): Promise<void>;
	subscribe(subscription: Subscription): () => void;
}

const POLL_MS = 2000;

/**
 * Queries one stream may make before it retires itself.
 *
 * The binding constraint is CPU, not subrequests. The free plan allows 50
 * external subrequests but only 10 ms of CPU per invocation, and a stream
 * accumulates CPU for as long as it lives — measured at roughly 1.4 ms per poll,
 * mostly parsing the database's HTTP response. A stream that polled for a minute
 * measured 56 ms, five times over budget.
 *
 * So streams are short and reconnect often. `Last-Event-ID` already existed to
 * survive a dropped connection, and it is what makes that invisible: the browser
 * resumes where it left off, and each reconnect is a fresh invocation with a
 * fresh budget.
 *
 * Measured on the deployed Worker: 39 queries cost 56 ms, five cost 11, three
 * cost 11 as well. So roughly 1.2 ms per query on top of a fixed ~10 ms just to
 * invoke the Worker — which means no budget gets a stream under the free plan's
 * 10 ms, and shrinking it past a handful only multiplies reconnects for nothing.
 *
 * Twelve is chosen for the screen rather than the limit: about 25 seconds of
 * stream, roughly 20 ms of CPU, and few enough reconnects that the page stays
 * calm. Getting genuinely under 10 ms is not a tuning problem, it is the paid
 * plan.
 */
const QUERY_BUDGET = 12;

/**
 * How far back each poll reaches beyond the highest sequence already delivered.
 *
 * `bigserial` hands out numbers before the transaction commits, so a row can
 * become visible after a higher-numbered one — and a strict `seq > last` query
 * would step over it forever. Re-reading a short tail and discarding what was
 * already sent closes that window.
 */
const SEQ_OVERLAP = 20;

/**
 * Checking for closures and kicks every tick would double the query load for
 * something that changes a handful of times an evening.
 */
const VERSION_EVERY_N_TICKS = 3;

/**
 * Re-reads the log on a timer instead of being told about writes.
 *
 * This is the implementation that works on a plain Worker: a write and a stream
 * are two separate invocations that share no memory, so there is nothing for an
 * in-process emitter to push between. It costs one indexed query per second per
 * screen, which for a handful of screens is nothing, and it trades up to a
 * second of latency that nobody at a party can perceive.
 *
 * The interface exists so this can be swapped for a Durable Object — one
 * instance per event code, holding the streams, broadcasting on write — without
 * anything above it changing.
 */
export function createPollingBus(pollMs = POLL_MS): EventBus {
	return {
		async publish() {
			// Intentionally empty. See the note on the interface.
		},

		subscribe({ eventId, fromSeq, onMessage, onBudgetSpent }) {
			let highestSeq = fromSeq;
			let version: string | null = null;
			let running = false;
			let stopped = false;
			let ticks = 0;
			let queries = 0;
			const delivered = new Set<number>();

			const stop = () => {
				stopped = true;
				clearInterval(timer);
			};

			const tick = async () => {
				// Skip rather than queue: a slow query must not stack up polls.
				if (stopped || running) return;

				// Two, because a version check may follow.
				if (queries + 2 > QUERY_BUDGET) {
					stop();
					onBudgetSpent();
					return;
				}

				running = true;
				try {
					queries++;
					const rows = await getEventEntries(eventId, Math.max(0, highestSeq - SEQ_OVERLAP));
					for (const row of rows) {
						if (delivered.has(row.seq)) continue;
						delivered.add(row.seq);
						highestSeq = Math.max(highestSeq, row.seq);
						// A refused write means nobody is listening any more. Without
						// this the loop would keep querying for a screen that closed
						// hours ago, because an abort signal is not guaranteed to fire.
						if (!onMessage({ type: 'entry', entry: row })) return stop();
					}

					// Only rows still inside the overlap window can come back again.
					for (const seq of delivered) {
						if (seq < highestSeq - SEQ_OVERLAP) delivered.delete(seq);
					}

					if (ticks++ % VERSION_EVERY_N_TICKS === 0) {
						queries++;
						const next = await getEventVersion(eventId);
						if (version !== null && next !== version) {
							if (!onMessage({ type: 'state' })) return stop();
						}
						version = next;
					}
				} catch {
					// Swallowed on purpose: a failed poll must not kill the stream.
					// The next tick retries, and the browser reconnects if we die.
				} finally {
					running = false;
				}
			};

			const timer = setInterval(tick, pollMs);
			// Replay first, so a reconnecting screen catches up immediately rather
			// than waiting out a poll interval.
			void tick();

			return stop;
		}
	};
}

export const bus: EventBus = createPollingBus();
