export type DrinkKey = 'beer' | 'wine' | 'shot' | 'soft';

export interface DrinkDef {
  key: DrinkKey;
  label: string;
  volumeMl: number;
  ethanolMl: number;
  color: string;
}

export const DRINKS: Record<DrinkKey, DrinkDef> = {
  beer: { key: 'beer', label: 'Pivo',   volumeMl: 500, ethanolMl: 22, color: '#F2B33D' },
  wine: { key: 'wine', label: 'Víno',   volumeMl: 200, ethanolMl: 24, color: '#D2607F' },
  shot: { key: 'shot', label: 'Panák',  volumeMl: 40,  ethanolMl: 16, color: '#8C7BF0' },
  soft: { key: 'soft', label: 'Nealko', volumeMl: 300, ethanolMl: 0, color: '#45C6E0' }
};

export const isDrinkKey = (v: unknown): v is DrinkKey =>
  typeof v === 'string' && v in DRINKS;