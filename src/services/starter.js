/** A starter wardrobe so a new account sees real recommendations in seconds. */
import { L, createTranslator } from '../shared/i18n.js';

const BASE = [
  ['tee', L('White tee'), '#f7f6f2'],
  ['tee', L('Black tee'), '#1c1c1e'],
  ['longsleeve', L('Grey long-sleeve tee'), '#8e9096'],
  ['shirt', L('Light blue button-up'), '#8fa9c8'],
  ['sweater', L('Navy crewneck sweater'), '#1f2f54'],
  ['cardigan', L('Camel cardigan'), '#b58750'],
  ['hoodie', L('Grey hoodie'), '#8e9096'],
  ['jeans', L('Dark wash jeans'), '#2b3a55'],
  ['chinos', L('Khaki chinos'), '#a39a6a'],
  ['shorts', L('Beige shorts'), '#cdb89a'],
  ['lightjacket', L('Olive field jacket'), '#6b6f3a'],
  ['raincoat', L('Navy rain jacket'), '#1f2f54'],
  ['wool-coat', L('Charcoal wool coat'), '#3d3f44'],
  ['sneakers', L('White sneakers'), '#f7f6f2'],
  ['boots', L('Brown boots'), '#6b4a32'],
  ['scarf', L('Grey scarf'), '#8e9096'],
  ['umbrella', L('Compact umbrella'), '#1c1c1e']
];

const WOMEN = [
  ['blouse', L('Cream blouse'), '#efe6d2'],
  ['skirt', L('Black midi skirt'), '#1c1c1e'],
  ['dress', L('Navy day dress'), '#1f2f54'],
  ['sundress', L('Sage sundress'), '#a1b49a'],
  ['flats', L('Black flats'), '#1c1c1e']
];

const MEN = [
  ['polo', L('Navy polo'), '#1f2f54'],
  ['trousers', L('Charcoal trousers'), '#3d3f44'],
  ['blazer', L('Navy blazer'), '#1f2f54'],
  ['loafers', L('Brown loafers'), '#6b4a32']
];

/** @param {'men'|'women'|'unisex'} department @param {Function} [t] translator for the item names */
export function starterWardrobe(department, t = createTranslator('en').t) {
  const extra = department === 'women' ? WOMEN : department === 'men' ? MEN : [...MEN.slice(0, 2), WOMEN[0], WOMEN[1]];
  return [...BASE, ...extra].map(([type, name, color]) => ({ type, name: t(name), color, pattern: 'solid' }));
}
