/** A starter wardrobe so a new account sees real recommendations in seconds. */
const BASE = [
  ['tee', 'White tee', '#f7f6f2'],
  ['tee', 'Black tee', '#1c1c1e'],
  ['longsleeve', 'Grey long-sleeve tee', '#8e9096'],
  ['shirt', 'Light blue button-up', '#8fa9c8'],
  ['sweater', 'Navy crewneck sweater', '#1f2f54'],
  ['cardigan', 'Camel cardigan', '#b58750'],
  ['hoodie', 'Grey hoodie', '#8e9096'],
  ['jeans', 'Dark wash jeans', '#2b3a55'],
  ['chinos', 'Khaki chinos', '#a39a6a'],
  ['shorts', 'Beige shorts', '#cdb89a'],
  ['lightjacket', 'Olive field jacket', '#6b6f3a'],
  ['raincoat', 'Navy rain jacket', '#1f2f54'],
  ['wool-coat', 'Charcoal wool coat', '#3d3f44'],
  ['sneakers', 'White sneakers', '#f7f6f2'],
  ['boots', 'Brown boots', '#6b4a32'],
  ['scarf', 'Grey scarf', '#8e9096'],
  ['umbrella', 'Compact umbrella', '#1c1c1e']
];

const WOMEN = [
  ['blouse', 'Cream blouse', '#efe6d2'],
  ['skirt', 'Black midi skirt', '#1c1c1e'],
  ['dress', 'Navy day dress', '#1f2f54'],
  ['sundress', 'Sage sundress', '#a1b49a'],
  ['flats', 'Black flats', '#1c1c1e']
];

const MEN = [
  ['polo', 'Navy polo', '#1f2f54'],
  ['trousers', 'Charcoal trousers', '#3d3f44'],
  ['blazer', 'Navy blazer', '#1f2f54'],
  ['loafers', 'Brown loafers', '#6b4a32']
];

/** @param {'men'|'women'|'unisex'} department */
export function starterWardrobe(department) {
  const extra = department === 'women' ? WOMEN : department === 'men' ? MEN : [...MEN.slice(0, 2), WOMEN[0], WOMEN[1]];
  return [...BASE, ...extra].map(([type, name, color]) => ({ type, name, color, pattern: 'solid' }));
}
