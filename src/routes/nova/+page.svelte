<script lang="ts">
	import Tally from '$lib/art/Tally.svelte';
	import { DRINKS, OFF_BY_DEFAULT, type DrinkKey } from '$lib/drinks';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	// Fresh form starts with the usual drinks ticked; after an error keep what the user chose.
	function isChecked(key: DrinkKey): boolean {
		return form ? (form.keys?.includes(key) ?? false) : !OFF_BY_DEFAULT.includes(key);
	}

	const labels = Object.fromEntries(
		Object.values(DRINKS).map((drink) => [drink.key, drink.label])
	) as Record<DrinkKey, string>;
</script>

<main class="page">
	<header class="head">
		<h1>Nová akce</h1>
	</header>

	{#if form?.error}
		<p class="alert" role="alert">{form.error}</p>
	{/if}

	<form method="POST" class="form">
		<div class="card stack">
			<label class="eyebrow" for="name">Název akce</label>
			<input
				id="name"
				name="name"
				required
				maxlength="60"
				value={form?.name ?? ''}
				class="field title"
			/>
		</div>

		<fieldset class="card picks">
			<legend class="eyebrow">Co se bude pít</legend>
			<div class="grid">
				{#each Object.values(DRINKS) as drink (drink.key)}
					<label class="pick" style="--tint: {drink.color}">
						<input type="checkbox" name="drinks" value={drink.key} checked={isChecked(drink.key)} />
						<span class="pick-name">{drink.label}</span>
						<span class="pick-glass" aria-hidden="true">
							<Tally keys={[drink.key]} px={1.6} {labels} />
						</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<button type="submit" class="btn btn-strong">Založit akci</button>
	</form>

	<a class="back" href={resolve('/')}>Zpět</a>
</main>

<style>
	.page {
		margin: 0 auto;
		display: flex;
		max-width: 30rem;
		flex-direction: column;
		gap: 18px;
		padding: 24px 16px calc(32px + env(safe-area-inset-bottom));
	}

	.head h1 {
		margin: 0;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	/* The name goes on the wall in this typeface, so it is typed in it too. */
	.title {
		font-family: var(--pixel);
		font-size: 23px;
		min-height: 58px;
	}

	.picks {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.picks legend {
		/* A legend sits in the border by default, which the mat's edge cannot
		   afford; this one is a heading above the tiles instead. */
		float: left;
		width: 100%;
		margin-bottom: 10px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-auto-rows: 1fr;
		gap: 10px;
	}

	/* The checkbox stays a real checkbox - it is what works without JavaScript
	   and what a screen reader announces. The tile is the target around it. */
	.pick {
		display: grid;
		grid-template-areas:
			'box glass'
			'name glass';
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 4px 8px;
		min-height: 78px;
		border: var(--line) solid var(--ink);
		background: var(--paper);
		padding: 10px;
		cursor: pointer;
	}

	.pick:has(input:checked) {
		background: var(--tint);
	}

	.pick input {
		grid-area: box;
		justify-self: start;
		width: 22px;
		height: 22px;
		accent-color: var(--ink);
	}

	.pick:has(input:focus-visible) {
		outline: var(--line) solid var(--ink);
		outline-offset: 2px;
	}

	.pick-name {
		grid-area: name;
		font-family: var(--pixel);
		font-size: 20px;
		line-height: 1;
	}

	.pick-glass {
		grid-area: glass;
		align-self: end;
	}

	/* Unchecked tiles keep the artwork, but as a hint rather than a statement. */
	.pick:not(:has(input:checked)) .pick-glass {
		opacity: 0.38;
	}

	.back {
		align-self: flex-start;
	}
</style>
