<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<main class="flex flex-col gap-6 p-6">
	<h1>{data.event.name}</h1>
	<p>Zapisuješ jako {data.me.nick}.</p>

	<div class="flex flex-col gap-2">
		<h2>Nápoje</h2>
		<ul class="flex flex-col gap-1">
			{#each data.event.drinks as drink (drink.key)}
				<li>{drink.label} — {drink.volumeMl} ml</li>
			{/each}
		</ul>
	</div>

	<a href={resolve('/a/[kod]', { kod: data.event.code })}>Na obrazovku</a>
</main>
