<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { LogEntry } from '$lib/events';
	import HostViewToggle from '$lib/components/HostViewToggle.svelte';
	import { mergeBySeq, reduceLog } from '$lib/leaderboard';
	import { QUIET_ZONE } from '$lib/qr';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Rows that arrived over the stream since the last full load. */
	let streamed = $state<LogEntry[]>([]);
	let connected = $state(true);
	let everConnected = $state(false);

	// The server snapshot stays the source of truth; the stream only adds to it.
	// After invalidateAll() brings a fresh snapshot the overlap merges away.
	const entries = $derived(mergeBySeq(data.entries, streamed));
	const view = $derived(reduceLog(entries, data.event.drinks));

	const labelFor = (key: string | null) =>
		data.event.drinks.find((drink) => drink.key === key)?.label ?? '?';

	const time = new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit' });

	$effect(() => {
		const code = data.event.code;
		// untrack, or appending an entry would re-run this effect and reconnect.
		const from = untrack(() => entries.reduce((max, item) => Math.max(max, item.seq), 0));

		const source = new EventSource(`/a/${code}/udalosti?od=${from}`);

		source.addEventListener('open', () => {
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

		// EventSource reconnects on its own; this only drives the banner.
		source.onerror = () => {
			connected = false;
		};

		return () => source.close();
	});
</script>

<main class="mx-auto flex max-w-3xl flex-col gap-6 p-6">
	<header class="flex flex-wrap items-baseline justify-between gap-2">
		<h1 class="text-2xl font-semibold">{data.event.name}</h1>
		<p class="muted num">Kód: {data.event.code}</p>
	</header>

	{#if data.isHost && !data.event.closedAt}
		<HostViewToggle code={data.event.code} current="obrazovka" joined={Boolean(data.me)} />
	{/if}

	{#if everConnected && !connected}
		<p class="alert" role="status">Spojení vypadlo, připojuji se znovu. Data zůstávají.</p>
	{/if}

	{#if data.event.closedAt}
		<p class="alert">Akce skončila. Tohle je konečné pořadí.</p>
	{/if}

	<section class="card flex flex-col gap-3">
		<div class="flex items-baseline justify-between">
			<h2 class="font-semibold">Žebříček</h2>
			<p class="muted num text-sm">celkem {view.totalEthanolMl} ml etanolu</p>
		</div>

		{#if view.leaderboard.length === 0}
			<p class="muted">Zatím nikdo nic nezapsal.</p>
		{:else}
			<ol class="flex flex-col gap-1">
				{#each view.leaderboard as row, index (row.nick)}
					<li class="flex items-baseline gap-3">
						<span class="muted num w-6 text-right text-sm">{index + 1}.</span>
						<span class="grow">{row.nick}</span>
						<span class="muted num text-sm">
							{row.drinks}
							{row.drinks === 1 ? 'nápoj' : 'nápojů'}
						</span>
						<span class="num w-20 text-right font-semibold">{row.ethanolMl} ml</span>
					</li>
				{/each}
			</ol>
		{/if}
	</section>

	{#if view.recent.length > 0}
		<section class="card flex flex-col gap-2">
			<h2 class="font-semibold">Poslední zápisy</h2>
			<ul class="flex flex-col gap-1">
				{#each view.recent as item (item.seq)}
					<li class="muted flex gap-2 text-sm">
						<span class="num">{time.format(new Date(item.at))}</span>
						<span class="text-black">{item.nick}</span>
						<span>{labelFor(item.drinkKey)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if !data.event.closedAt}
		<section class="card flex flex-wrap items-center gap-4">
			<svg
				class="h-40 w-40 shrink-0"
				viewBox="{-QUIET_ZONE} {-QUIET_ZONE} {data.qr.extent} {data.qr.extent}"
				shape-rendering="crispEdges"
				role="img"
				aria-label="QR kód pro připojení k akci {data.event.code}"
			>
				<rect
					x={-QUIET_ZONE}
					y={-QUIET_ZONE}
					width={data.qr.extent}
					height={data.qr.extent}
					fill="#fff"
				/>
				<path d={data.qr.d} fill="#000" />
			</svg>
			<div class="flex flex-col gap-1">
				<h2 class="font-semibold">Přidej se</h2>
				<p class="muted text-sm">Naskenuj kód, nebo zadej na {data.joinUrl.split('/a/')[0]}</p>
				<p class="num text-xl">{data.event.code}</p>
			</div>
		</section>
	{/if}

	{#if data.isHost}
		<a href={resolve('/a/[kod]/sprava', { kod: data.event.code })} class="muted text-sm">
			Správa akce
		</a>
	{/if}
</main>
