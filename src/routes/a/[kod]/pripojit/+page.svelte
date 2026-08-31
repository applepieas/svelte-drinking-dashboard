<script lang="ts">
	import { NICK_MAX } from '$lib/nicks';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<main class="flex flex-col gap-6 p-6">
	<h1>{data.event.name}</h1>
	<p>Zvol si přezdívku. Uvidí ji ostatní na společné obrazovce.</p>

	{#if form?.error}
		<p role="alert">{form.error}</p>
	{/if}

	<form method="POST" class="flex flex-col gap-4">
		<div class="flex flex-col gap-2">
			<label for="nick">Přezdívka</label>
			<input
				id="nick"
				name="nick"
				required
				maxlength={NICK_MAX}
				autocomplete="off"
				value={form?.nick ?? ''}
				class="border p-2"
			/>
		</div>
		<button type="submit" class="border p-2">Připojit se</button>
	</form>
</main>
