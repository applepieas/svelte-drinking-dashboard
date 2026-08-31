<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const labelFor = (key: string | null) =>
		data.event.drinks.find((drink) => drink.key === key)?.label ?? '?';

	const time = new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit' });
</script>

<main class="mx-auto flex max-w-2xl flex-col gap-6 p-6">
	<header class="flex flex-wrap items-baseline justify-between gap-2">
		<h1 class="text-2xl font-semibold">{data.event.name}</h1>
		<p class="muted num">Kód: {data.event.code}</p>
	</header>

	{#if data.event.closedAt}
		<p class="alert">Akce už skončila.</p>
	{/if}

	<section class="card flex flex-col gap-3">
		<div class="flex items-baseline justify-between">
			<h2 class="font-semibold">Žebříček</h2>
			<p class="muted num text-sm">celkem {data.totalEthanolMl} ml etanolu</p>
		</div>

		{#if data.leaderboard.length === 0}
			<p class="muted">Zatím nikdo nic nezapsal.</p>
		{:else}
			<ol class="flex flex-col gap-1">
				{#each data.leaderboard as row, index (row.nick)}
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

	{#if data.recent.length > 0}
		<section class="card flex flex-col gap-2">
			<h2 class="font-semibold">Poslední zápisy</h2>
			<ul class="flex flex-col gap-1">
				{#each data.recent as item (item.seq)}
					<li class="muted flex gap-2 text-sm">
						<span class="num">{time.format(item.createdAt)}</span>
						<span class="text-black">{item.nick}</span>
						<span>{labelFor(item.drinkKey)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if !data.event.closedAt}
		{#if data.me}
			<a href={resolve('/a/[kod]/zapis', { kod: data.event.code })}>Zapisovat jako {data.me.nick}</a
			>
		{:else}
			<a href={resolve('/a/[kod]/pripojit', { kod: data.event.code })}>Připojit se</a>
		{/if}
	{/if}

	<a href={resolve('/')} class="muted text-sm">Zpět</a>
</main>
