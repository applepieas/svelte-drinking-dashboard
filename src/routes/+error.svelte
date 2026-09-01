<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<main class="mx-auto flex max-w-md flex-col gap-4 p-6">
	<h1 class="text-2xl font-semibold">{page.status}</h1>
	<p>{page.error?.message ?? 'Něco se pokazilo.'}</p>
	<a href={resolve('/')}>Zpátky na začátek</a>
</main>
