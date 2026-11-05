import { describe, expect, it } from 'vitest';
import { DRINKS, withDrink, type DrinkDef } from './drinks';

const keys = (drinks: DrinkDef[]) => drinks.map((drink) => drink.key);

describe('withDrink', () => {
	it('adds a drink back in its usual place, not at the end', () => {
		const next = withDrink([DRINKS.beer, DRINKS.mixed], 'wine', true);
		expect(keys(next)).toEqual(['beer', 'wine', 'mixed']);
	});

	it('removes a drink and leaves the rest alone', () => {
		const next = withDrink([DRINKS.beer, DRINKS.soft], 'soft', false);
		expect(keys(next)).toEqual(['beer']);
	});

	it('keeps the snapshot of drinks it was not asked about', () => {
		const older = { ...DRINKS.beer, ethanolMl: 20 };
		const next = withDrink([older], 'soft', true);
		expect(next[0]).toBe(older);
	});

	it('changes nothing when the drink is already in the state asked for', () => {
		expect(keys(withDrink([DRINKS.beer], 'beer', true))).toEqual(['beer']);
		expect(keys(withDrink([DRINKS.beer], 'soft', false))).toEqual(['beer']);
	});
});
