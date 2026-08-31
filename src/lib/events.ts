export interface LiveEntry {
  seq: number;
  nick: string;
  kind: 'drink' | 'undo';
  drinkKey: import('./drinks').DrinkKey | null;
  undoesSeq: number | null;
  at: string;
}