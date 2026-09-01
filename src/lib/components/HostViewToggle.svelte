<script lang="ts">
	import { resolve } from '$app/paths';

	/**
	 * Lets the host flip between the shared screen and the logging client on one
	 * device, which is what makes the whole thing testable from a laptop.
	 *
	 * Host only, on purpose. Guests are deliberately kept away from the standings
	 * while an event is running — they see them on the screen in the room, or in
	 * the summary once it closes.
	 */
	let {
		code,
		current,
		joined
	}: {
		code: string;
		current: 'obrazovka' | 'zapis';
		/** Not joined yet means the write side is still the nick form. */
		joined: boolean;
	} = $props();
</script>

<nav class="toggle" aria-label="Zobrazení pořadatele">
	<a
		href={resolve('/a/[kod]', { kod: code })}
		aria-current={current === 'obrazovka' ? 'page' : undefined}
	>
		Obrazovka
	</a>
	<a
		href={joined
			? resolve('/a/[kod]/zapis', { kod: code })
			: resolve('/a/[kod]/pripojit', { kod: code })}
		aria-current={current === 'zapis' ? 'page' : undefined}
	>
		Zapisovat
	</a>
</nav>

<style>
	.toggle {
		display: inline-flex;
		border: 1px solid #000;
		align-self: flex-start;
	}

	.toggle a {
		padding: 0.4rem 0.9rem;
		text-decoration: none;
		font-size: 0.875rem;
		color: #000;
		background: #fff;
	}

	.toggle a + a {
		border-left: 1px solid #000;
	}

	.toggle a:hover {
		background: #eee;
	}

	.toggle a[aria-current='page'] {
		background: #000;
		color: #fff;
	}
</style>
