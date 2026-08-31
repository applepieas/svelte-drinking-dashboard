<script lang="ts">
	import { resolve } from '$app/paths';
	import { UNDO_WINDOW_SECONDS } from '$lib/entries';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const undoneDrink = $derived(
		data.undoable ? data.event.drinks.find((d) => d.key === data.undoable?.drinkKey) : null
	);
</script>

<main class="mx-auto flex max-w-md flex-col gap-6 p-6">
	<header class="flex flex-col gap-1">
		<h1 class="text-xl font-semibold">{data.event.name}</h1>
		<p class="muted text-sm">
			{data.me.nick} &middot; <span class="num">{data.myTotal}</span>
			{data.myTotal === 1 ? 'zápis' : 'zápisů'}
		</p>
	</header>

	{#if form?.error}
		<p class="alert" role="alert">{form.error}</p>
	{/if}

	<form method="POST" action="?/zapsat" class="flex flex-col gap-2">
		<input type="hidden" name="submissionId" value={data.submissionId} />
		{#each data.event.drinks as drink (drink.key)}
			<button class="btn justify-between" name="drink" value={drink.key}>
				<span>{drink.label}</span>
				<span class="muted num text-sm">{drink.volumeMl} ml</span>
			</button>
		{/each}
	</form>

	{#if data.undoable}
		<form method="POST" action="?/vzitZpet" class="flex flex-col gap-1">
			<input type="hidden" name="submissionId" value={data.submissionId} />
			<input type="hidden" name="seq" value={data.undoable.seq} />
			<button class="btn btn-quiet">Vzít zpět: {undoneDrink?.label ?? 'poslední zápis'}</button>
			<span class="muted text-xs">Jde to do {UNDO_WINDOW_SECONDS} sekund od zápisu.</span>
		</form>
	{/if}

	<!--
		Only the host gets a way through to the board. Everyone else finds out how
		it went on the summary once the event closes — checking the standings
		mid-party is what the shared screen is for.
	-->
	{#if data.isHost}
		<a href={resolve('/a/[kod]', { kod: data.event.code })}>Zobrazit žebříček</a>
	{/if}
</main>
