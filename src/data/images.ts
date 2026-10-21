/**
 * Demo catalogue photographs (freely licensed, from Wikimedia Commons), bundled
 * with the app so they load instantly and work offline.
 *
 * Image references stored on records are plain strings:
 *   - "asset:<key>"  → one of the bundled photos below
 *   - anything else  → a URI (a seller's uploaded photo / cloud storage URL)
 */
import type { ImageSourcePropType } from 'react-native';

const BUNDLED = {
  kale: require('../../assets/produce/kale.jpg'),
  spinach: require('../../assets/produce/spinach.jpg'),
  managu: require('../../assets/produce/managu.jpg'),
  kunde: require('../../assets/produce/kunde.jpg'),
  cabbage: require('../../assets/produce/cabbage.jpg'),
  tomatoes: require('../../assets/produce/tomatoes.jpg'),
  onions: require('../../assets/produce/onions.jpg'),
  carrots: require('../../assets/produce/carrots.jpg'),
  capsicum: require('../../assets/produce/capsicum.jpg'),
  frenchBeans: require('../../assets/produce/frenchBeans.jpg'),
  eggplant: require('../../assets/produce/eggplant.jpg'),
  bananas: require('../../assets/produce/bananas.jpg'),
  mangoes: require('../../assets/produce/mangoes.jpg'),
  avocados: require('../../assets/produce/avocados.jpg'),
  oranges: require('../../assets/produce/oranges.jpg'),
  watermelon: require('../../assets/produce/watermelon.jpg'),
  pineapple: require('../../assets/produce/pineapple.jpg'),
  passion: require('../../assets/produce/passion.jpg'),
  lemons: require('../../assets/produce/lemons.jpg'),
  potatoes: require('../../assets/produce/potatoes.jpg'),
  sweetPotatoes: require('../../assets/produce/sweetPotatoes.jpg'),
  cassava: require('../../assets/produce/cassava.jpg'),
  arrowroots: require('../../assets/produce/arrowroots.jpg'),
  dhania: require('../../assets/produce/dhania.jpg'),
  garlic: require('../../assets/produce/garlic.jpg'),
  ginger: require('../../assets/produce/ginger.jpg'),
  chillies: require('../../assets/produce/chillies.jpg'),
  herbs: require('../../assets/produce/herbs.jpg'),
  beans: require('../../assets/produce/beans.jpg'),
  greenGrams: require('../../assets/produce/greenGrams.jpg'),
  maize: require('../../assets/produce/maize.jpg'),
  legumes: require('../../assets/produce/legumes.jpg'),
  eggs: require('../../assets/produce/eggs.jpg'),
  vegetables: require('../../assets/produce/vegetables.jpg'),
  fruits: require('../../assets/produce/fruits.jpg'),
  marketNairobi: require('../../assets/produce/marketNairobi.jpg'),
  vendors: require('../../assets/produce/vendors.jpg'),
  marketKisii: require('../../assets/produce/marketKisii.jpg'),
  marketStall: require('../../assets/produce/marketStall.jpg'),
  darajani: require('../../assets/produce/darajani.jpg'),
} satisfies Record<string, ImageSourcePropType>;

export type ImageKey = keyof typeof BUNDLED;

/** Reference string for a bundled photo, as stored on records. */
export const asset = (key: ImageKey) => `asset:${key}`;

/** Turn a stored image reference into something <Image> can render. */
export function resolveImage(ref?: string | null): ImageSourcePropType | null {
  if (!ref) return null;
  if (ref.startsWith('asset:')) return BUNDLED[ref.slice(6) as ImageKey] ?? null;
  return { uri: ref };
}

export const IMAGES = BUNDLED;
