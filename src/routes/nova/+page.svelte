<script lang="ts">
	import { DRINKS, type DrinkKey } from '$lib/drinks';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	// Fresh form starts with everything ticked; after an error keep what the user chose.
	function isChecked(key: DrinkKey): boolean {
		return form ? (form.keys?.includes(key) ?? false) : true;
	}
</script>

<main class="flex flex-col gap-6 p-6">
	<h1>Nová akce</h1>

	{#if form?.error}
		<p role="alert">{form.error}</p>
	{/if}

	<form method="POST" class="flex flex-col gap-6">
		<div class="flex flex-col gap-2">
			<label for="name">Název akce</label>
			<input
				id="name"
				name="name"
				required
				maxlength="60"
				value={form?.name ?? ''}
				class="border p-2"
			/>
		</div>

		<fieldset class="flex flex-col gap-2 border p-2">
			<legend>Co se bude pít</legend>
			{#each Object.values(DRINKS) as drink (drink.key)}
				<label class="flex gap-2">
					<input type="checkbox" name="drinks" value={drink.key} checked={isChecked(drink.key)} />
					{drink.label}
				</label>
			{/each}
		</fieldset>

		<button type="submit" class="border p-2">Založit akci</button>
	</form>

	<a href={resolve('/')}>Zpět</a>
</main>
