import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { DrinkKey } from '$lib/drinks';
import Tally from './Tally.svelte';

const LABELS: Record<DrinkKey, string> = {
	beer: 'Pivo',
	wine: 'Víno',
	shot: 'Panák',
	soft: 'Nealko'
};

describe('Tally', () => {
	it('draws one glass per drink, in the order they were drunk', async () => {
		const { container } = render(Tally, { keys: ['beer', 'shot', 'beer'], labels: LABELS });
		const marks = container.querySelectorAll('svg');
		expect(marks).toHaveLength(3);
		expect([...marks].map((svg) => svg.querySelector('title')?.textContent)).toEqual([
			'Pivo',
			'Panák',
			'Pivo'
		]);
	});

	it('scales every glass by the same amount', async () => {
		const { container } = render(Tally, { keys: ['beer', 'wine'], px: 2, labels: LABELS });
		const widths = [...container.querySelectorAll('svg')].map((svg) => ({
			w: Number(svg.getAttribute('width')),
			view: svg.getAttribute('viewBox')?.split(' ')[2]
		}));
		for (const { w, view } of widths) expect(w).toBe(Number(view) * 2);
	});

	it('draws nothing at all when nobody has drunk anything', async () => {
		const { container } = render(Tally, { keys: [], labels: LABELS });
		expect(container.querySelectorAll('svg')).toHaveLength(0);
	});
});
