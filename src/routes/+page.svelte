<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<main class="flex flex-col gap-6 p-6">
	<h1>Na ex</h1>
	<p>Lidé zapisují z telefonu, společná obrazovka to ukazuje živě.</p>

	<a href={resolve('/nova')}>Založit novou akci</a>

	<form method="POST" action="?/pripojit" class="flex flex-col gap-2">
		<label for="code">Připojit se ke stávající akci</label>
		<input id="code" name="code" required autocomplete="off" class="border p-2" />
		{#if form?.error}
			<p role="alert">{form.error}</p>
		{/if}
		<button type="submit" class="border p-2">Připojit</button>
	</form>
</main>
