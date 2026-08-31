<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<main class="flex flex-col gap-6 p-6">
	<h1>{data.name}</h1>
	<p>Kód akce: {data.code}</p>
	<p>{data.isHost ? 'Jsi pořadatel této akce.' : 'Jsi host.'}</p>

	<div class="flex flex-col gap-2">
		<h2>Nápoje</h2>
		<ul class="flex flex-col gap-1">
			{#each data.drinks as drink (drink.key)}
				<li>{drink.label} — {drink.volumeMl} ml</li>
			{/each}
		</ul>
	</div>

	<a href={resolve('/')}>Zpět</a>
</main>
