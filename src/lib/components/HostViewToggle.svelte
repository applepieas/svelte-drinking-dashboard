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
		align-self: flex-start;
		border: var(--line) solid var(--ink);
		background: var(--paper);
	}

	.toggle a {
		padding: 0.55rem 1rem;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		text-decoration: none;
		font-size: 14px;
		font-weight: 500;
		color: var(--ink);
	}

	.toggle a + a {
		border-left: var(--line) solid var(--ink);
	}

	.toggle a[aria-current='page'] {
		background: var(--amber);
	}
</style>
