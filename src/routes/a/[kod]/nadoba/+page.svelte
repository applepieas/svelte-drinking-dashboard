<script lang="ts">
	import { resolve } from '$app/paths';
	import Tally from '$lib/art/Tally.svelte';
	import Vessel from '$lib/art/Vessel.svelte';
	import type { DrinkKey } from '$lib/drinks';
	import { reduceLog } from '$lib/leaderboard';
	import { liveLog } from '$lib/liveLog.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const log = liveLog(
		() => data.event.code,
		() => data.entries
	);

	const view = $derived(reduceLog(log.entries, data.event.drinks));

	const labels = $derived(
		Object.fromEntries(data.event.drinks.map((drink) => [drink.key, drink.label])) as Record<
			DrinkKey,
			string
		>
	);
	const colours = $derived(
		Object.fromEntries(data.event.drinks.map((drink) => [drink.key, drink.color])) as Record<
			DrinkKey,
			string
		>
	);

	/** What the glass holds, in millilitres of drink rather than of ethanol. */
	const volumeMl = $derived(
		view.byDrink.reduce((sum, item) => {
			const drink = data.event.drinks.find((d) => d.key === item.key);
			return sum + (drink ? drink.volumeMl * item.count : 0);
		}, 0)
	);

	const litres = new Intl.NumberFormat('cs-CZ', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	});

	/** 1 nápoj, 2 nápoje, 0 a 5 nápojů — the shape Czech counting takes. */
	const drinks = (n: number) => `${n} ${n === 1 ? 'nápoj' : n > 1 && n < 5 ? 'nápoje' : 'nápojů'}`;

	const poured = $derived(view.byDrink.reduce((sum, item) => sum + item.count, 0));
</script>

<main class="room">
	<header class="top">
		<h1>{data.event.name}</h1>
		<div class="meta">
			<span><b>{litres.format(volumeMl / 1000)} l</b> v nádobě</span>
			<span><b>{view.totalEthanolMl} ml</b> etanolu</span>
			<a class="swap" href={resolve('/a/[kod]', { kod: data.event.code })}>Žebříček na celou ⟶</a>
		</div>
	</header>

	{#if log.everConnected && !log.connected}
		<p class="alert" role="status">Spojení vypadlo, připojuji se znovu. Data zůstávají.</p>
	{/if}

	<div class="split">
		<section class="jar">
			{#if poured === 0}
				<p class="waiting">Zatím prázdná. První nápoj ji začne plnit.</p>
			{:else}
				<Vessel drinks={data.event.drinks} byDrink={view.byDrink} />
			{/if}
		</section>

		<section class="side">
			<h2 class="eyebrow">Žebříček</h2>
			{#if view.leaderboard.length === 0}
				<p class="waiting">Zatím nikdo nic nezapsal.</p>
			{:else}
				<ol class="ranking" role="list" aria-label="Žebříček">
					{#each view.leaderboard as row, i (row.nick)}
						<li class="rank" class:lead={i === 0}>
							<span class="place num">{i + 1}</span>
							<span class="who">
								<span class="nick">{row.nick}</span>
								<span class="cnt">{drinks(row.drinks)}</span>
							</span>
							<span class="ml">{row.ethanolMl} ml</span>
							<Tally keys={row.mix} px={0.8} {labels} />
						</li>
					{/each}
				</ol>
			{/if}

			{#if view.byDrink.length > 0}
				<div class="legend">
					{#each view.byDrink as drink (drink.key)}
						<span class="key">
							<i style="background: {colours[drink.key]}"></i>
							{labels[drink.key]}
							<b class="num">{drink.count}</b>
						</span>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</main>

<style>
	/* The same room as the board, turned to look at the evening as a quantity
	   rather than a contest: the glass carries the night, the ranking is the
	   column beside it. */
	.room {
		--ink: #15120c;
		--paper: #fff8e8;
		--amber: #ffc60b;
		--ground: #f4eddc;
		--quiet: #6b5b33;
		min-height: 100dvh;
		background: var(--ground);
		overflow: hidden;
		color: var(--ink);
		padding: clamp(14px, 2.2vw, 30px);
		display: flex;
		flex-direction: column;
		gap: clamp(10px, 1.4vw, 18px);
	}

	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px 22px;
	}

	.top h1 {
		margin: 0;
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: clamp(26px, 2.8vw, 40px);
		font-weight: 700;
		line-height: 1;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 22px;
		align-items: baseline;
		font-size: clamp(12px, 1vw, 15px);
		color: var(--quiet);
	}

	.meta b {
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: clamp(18px, 1.8vw, 27px);
		color: var(--ink);
	}

	.swap {
		color: var(--ink);
		text-decoration: none;
		border-bottom: 2px solid var(--ink);
	}

	.alert {
		margin: 0;
		border: 3px solid var(--ink);
		background: var(--amber);
		padding: 10px 14px;
		font-weight: 600;
	}

	.split {
		flex: 1;
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		gap: clamp(10px, 1.4vw, 22px);
		min-height: 0;
	}

	.jar,
	.side {
		border: 4px solid var(--ink);
		background: var(--paper);
		box-shadow: 6px 6px 0 rgb(21 18 12 / 0.18);
		min-height: 0;
	}

	/* The glass is laid into the tile rather than flowed into it. A percentage
	   height has nothing definite to measure against inside a grid whose row is
	   content-sized, so the canvas would take its height from its aspect ratio
	   and grow straight through the bottom of the tile. */
	.jar {
		position: relative;
		padding: clamp(10px, 1.4vw, 20px);
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: clamp(8px, 1vw, 14px);
		padding: clamp(12px, 1.4vw, 20px);
		overflow: hidden;
	}

	.eyebrow {
		margin: 0;
		font-size: clamp(10px, 0.8vw, 12px);
		font-weight: 500;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--quiet);
	}

	.waiting {
		margin: 0;
		color: var(--quiet);
		font-size: clamp(13px, 1.1vw, 16px);
		text-align: center;
	}

	.ranking {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: clamp(5px, 0.6vw, 9px);
		margin: 0;
		padding: 0;
		list-style: none;
		min-height: 0;
		overflow: hidden;
	}

	.rank {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 4px clamp(8px, 1vw, 14px);
		border-bottom: 3px dotted rgb(21 18 12 / 0.22);
		padding-bottom: clamp(5px, 0.6vw, 9px);
	}

	.rank:last-child {
		border-bottom: 0;
	}

	.lead {
		background: var(--amber);
		border-bottom: 0;
		padding: clamp(6px, 0.8vw, 12px);
		margin: calc(-1 * clamp(6px, 0.8vw, 12px));
		margin-bottom: 0;
	}

	.place {
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: clamp(18px, 1.8vw, 28px);
		color: var(--quiet);
		line-height: 1;
	}

	.lead .place {
		color: var(--ink);
	}

	.who {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.nick {
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: clamp(18px, 1.9vw, 30px);
		line-height: 1;
		overflow-wrap: anywhere;
	}

	.cnt {
		font-size: clamp(10px, 0.85vw, 13px);
		color: var(--quiet);
	}

	.lead .cnt {
		color: rgb(21 18 12 / 0.7);
	}

	.ml {
		font-family: 'Pixelify Sans', ui-monospace, monospace;
		font-size: clamp(18px, 1.9vw, 30px);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.rank :global(.tally) {
		grid-column: 2 / -1;
		gap: 3px;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
		border-top: 3px solid var(--ink);
		padding-top: clamp(8px, 1vw, 12px);
		font-size: clamp(11px, 0.95vw, 14px);
		color: var(--quiet);
	}

	.key {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.key i {
		width: 11px;
		height: 11px;
		border: 2px solid var(--ink);
	}

	.key b {
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	@media (min-width: 861px) {
		.room {
			height: 100dvh;
		}
	}

	/* A phone holds one thing at a time: the glass, then the ranking under it. */
	@media (max-width: 860px) {
		.split {
			grid-template-columns: minmax(0, 1fr);
		}

		.jar {
			min-height: 48dvh;
		}
	}
</style>
