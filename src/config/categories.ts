export type CategoryId = 'ember' | 'midnight' | 'aqua' | 'moss';

export interface CategoryDef {
  id: CategoryId;
  name: string;
  symbol: string;
  /** Short description of the non-color identifiers, used in tutorials. */
  look: string;
  color: number;
  css: string;
  darkColor: number;
  /** Root frequency (Hz) for this category's sorting chime. */
  chimeHz: number;
}

/** Unlock order. The first two are active from the start. */
export const CATEGORY_ORDER: readonly CategoryId[] = ['ember', 'midnight', 'aqua', 'moss'];

export const CATEGORIES: Readonly<Record<CategoryId, CategoryDef>> = {
  ember: {
    id: 'ember', name: 'Ember', symbol: 'Flame', look: 'round with a flame crest',
    color: 0xff7a33, css: '#ff7a33', darkColor: 0xc0281b, chimeHz: 659.25,
  },
  midnight: {
    id: 'midnight', name: 'Midnight', symbol: 'Moon', look: 'tall with pointy ears',
    color: 0x5a6ad0, css: '#7586d4', darkColor: 0x11173a, chimeHz: 587.33,
  },
  aqua: {
    id: 'aqua', name: 'Aqua', symbol: 'Drop', look: 'teardrop with a wave belt',
    color: 0x38cfe6, css: '#38cfe6', darkColor: 0x0f6fa6, chimeHz: 783.99,
  },
  moss: {
    id: 'moss', name: 'Moss', symbol: 'Leaf', look: 'boxy with a leaf sprout',
    color: 0x69c84a, css: '#69c84a', darkColor: 0x28772a, chimeHz: 523.25,
  },
};

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_ORDER as readonly string[]).includes(value);
}
