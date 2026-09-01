import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { StreamMessage } from '$lib/events';
import { bus } from '$lib/server/bus';
import { normalizeCode } from '$lib/server/codes';
import { getEventByCode } from '$lib/server/queries';

/** Comment frames keep proxies from closing an idle stream. */
const HEARTBEAT_MS = 15_000;

/**
 * Streams are retired on a schedule rather than left to live forever. The
 * browser reconnects by itself and resumes from Last-Event-ID, so nothing is
 * lost, and no leak can outlive this.
 */
const MAX_STREAM_MS = 10 * 60_000;

export const GET: RequestHandler = async ({ params, url, request }) => {
	const code = normalizeCode(params.kod);
	if (!code) error(404, 'Akce nenalezena');

	const event = await getEventByCode(code);
	if (!event) error(404, 'Akce nenalezena');

	// EventSource cannot set headers on the first connect, so the page passes what
	// it already has as a query parameter. On a reconnect the browser sends
	// Last-Event-ID by itself, and that wins.
	const resumed = Number(request.headers.get('last-event-id'));
	const declared = Number(url.searchParams.get('od'));
	const fromSeq = Number.isSafeInteger(resumed)
		? resumed
		: Number.isSafeInteger(declared)
			? declared
			: 0;

	let unsubscribe: (() => void) | undefined;
	let heartbeat: ReturnType<typeof setInterval> | undefined;
	let lifetime: ReturnType<typeof setTimeout> | undefined;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const encoder = new TextEncoder();
			let open = true;

			/** False once the consumer is gone, which is what stops the poll loop. */
			const write = (chunk: string): boolean => {
				if (!open) return false;
				try {
					controller.enqueue(encoder.encode(chunk));
					return true;
				} catch {
					// The client vanished between the check and the write.
					open = false;
					return false;
				}
			};

			const send = (message: StreamMessage): boolean =>
				message.type === 'entry'
					? write(
							`id: ${message.entry.seq}\nevent: entry\ndata: ${JSON.stringify(message.entry)}\n\n`
						)
					: write('event: state\ndata: {}\n\n');

			const stop = () => {
				open = false;
				clearInterval(heartbeat);
				clearTimeout(lifetime);
				unsubscribe?.();
				try {
					controller.close();
				} catch {
					// Already closed by the runtime.
				}
			};

			unsubscribe = bus.subscribe({ eventId: event.id, fromSeq, onMessage: send });
			heartbeat = setInterval(() => {
				if (!write(': ping\n\n')) stop();
			}, HEARTBEAT_MS);
			lifetime = setTimeout(stop, MAX_STREAM_MS);

			// Belt and braces: the abort signal is the clean path, but it does not
			// fire on every runtime, and a leaked poll loop queries the database
			// once a second forever.
			request.signal.addEventListener('abort', stop);
		},

		cancel() {
			clearInterval(heartbeat);
			clearTimeout(lifetime);
			unsubscribe?.();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			// no-transform stops Cloudflare buffering the stream into uselessness.
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive'
		}
	});
};
