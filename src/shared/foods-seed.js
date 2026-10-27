/**
 * The built-in food library for /trackweight, so the app is useful with no connection at all: about 150
 * basic foods (values per 100 g, USDA-style averages) plus several hundred typical dishes from many
 * cuisines (foods-dishes.js, written per serving). Dishes and the "Meals & takeaway" group are marked
 * `approx`: typical values, not any restaurant's or brand's. Online databases cover everything else.
 */
import { DISHES } from './foods-dishes.js';

/** [name, kcal, protein, carbs, fat per 100 g, serving label, serving grams] */
const CATEGORIES = {
  Fruit: [
    ['Apple', 52, 0.3, 14, 0.2, '1 medium', 182],
    ['Banana', 89, 1.1, 23, 0.3, '1 medium', 118],
    ['Orange', 47, 0.9, 12, 0.1, '1 medium', 131],
    ['Strawberries', 32, 0.7, 7.7, 0.3, '1 cup', 152],
    ['Blueberries', 57, 0.7, 14, 0.3, '1 cup', 148],
    ['Raspberries', 52, 1.2, 12, 0.7, '1 cup', 123],
    ['Grapes', 69, 0.7, 18, 0.2, '1 cup', 151],
    ['Watermelon', 30, 0.6, 7.6, 0.2, '1 cup', 152],
    ['Pineapple', 50, 0.5, 13, 0.1, '1 cup', 165],
    ['Mango', 60, 0.8, 15, 0.4, '1 cup', 165],
    ['Avocado', 160, 2, 8.5, 14.7, '½ fruit', 100],
    ['Pear', 57, 0.4, 15, 0.1, '1 medium', 178],
    ['Peach', 39, 0.9, 10, 0.3, '1 medium', 150],
    ['Kiwi', 61, 1.1, 15, 0.5, '1 medium', 69],
    ['Grapefruit', 42, 0.8, 11, 0.1, '½ fruit', 128],
    ['Dates (Medjool)', 277, 1.8, 75, 0.2, '1 date', 24],
    ['Raisins', 299, 3.1, 79, 0.5, '1 small box', 43],
  ],
  Vegetables: [
    ['Broccoli', 34, 2.8, 6.6, 0.4, '1 cup', 91],
    ['Carrot', 41, 0.9, 10, 0.2, '1 medium', 61],
    ['Spinach (raw)', 23, 2.9, 3.6, 0.4, '1 cup', 30],
    ['Kale (raw)', 49, 4.3, 8.8, 0.9, '1 cup', 67],
    ['Tomato', 18, 0.9, 3.9, 0.2, '1 medium', 123],
    ['Cucumber', 15, 0.7, 3.6, 0.1, '1 cup', 104],
    ['Lettuce (romaine)', 17, 1.2, 3.3, 0.3, '1 cup', 47],
    ['Bell pepper', 31, 1, 6, 0.3, '1 medium', 119],
    ['Onion', 40, 1.1, 9.3, 0.1, '1 medium', 110],
    ['Potato (boiled)', 87, 1.9, 20, 0.1, '1 medium', 150],
    ['Sweet potato (baked)', 90, 2, 21, 0.2, '1 medium', 114],
    ['Corn (sweet, cooked)', 96, 3.4, 21, 1.5, '1 cup', 154],
    ['Green beans', 31, 1.8, 7, 0.2, '1 cup', 110],
    ['Cauliflower', 25, 1.9, 5, 0.3, '1 cup', 107],
    ['Zucchini', 17, 1.2, 3.1, 0.3, '1 medium', 196],
    ['Mushrooms', 22, 3.1, 3.3, 0.3, '1 cup', 70],
    ['Cabbage', 25, 1.3, 5.8, 0.1, '1 cup', 89],
    ['Green peas', 81, 5.4, 14, 0.4, '½ cup', 80],
    ['Eggplant', 25, 1, 6, 0.2, '1 cup', 82],
    ['Asparagus', 20, 2.2, 3.9, 0.1, '5 spears', 90],
  ],
  'Grains & bread': [
    ['White rice (cooked)', 130, 2.7, 28, 0.3, '1 cup', 158],
    ['Brown rice (cooked)', 123, 2.7, 26, 1, '1 cup', 195],
    ['Pasta (cooked)', 158, 5.8, 31, 0.9, '1 cup', 140],
    ['Rolled oats (dry)', 379, 13, 67, 6.5, '½ cup', 40],
    ['Oatmeal (cooked)', 71, 2.5, 12, 1.5, '1 cup', 234],
    ['White bread', 265, 9, 49, 3.2, '1 slice', 28],
    ['Whole wheat bread', 252, 12.5, 43, 3.5, '1 slice', 28],
    ['Bagel (plain)', 257, 10, 50, 1.6, '1 medium', 105],
    ['Flour tortilla', 304, 8, 50, 8, '1 medium', 45],
    ['Pita bread', 275, 9, 56, 1.2, '1 pita', 60],
    ['Quinoa (cooked)', 120, 4.4, 21, 1.9, '1 cup', 185],
    ['Couscous (cooked)', 112, 3.8, 23, 0.2, '1 cup', 157],
    ['Corn flakes', 357, 7, 84, 0.4, '1 cup', 28],
    ['Granola', 471, 10, 64, 20, '½ cup', 61],
    ['Pancake', 227, 6, 28, 10, '1 pancake', 38],
    ['Crackers (saltine)', 421, 9, 74, 9, '5 crackers', 15],
    ['Popcorn (air-popped)', 387, 13, 78, 4.5, '3 cups', 24],
    ['French fries', 312, 3.4, 41, 15, '1 medium serving', 117],
  ],
  'Meat, fish & eggs': [
    ['Chicken breast (cooked)', 165, 31, 0, 3.6, '1 breast', 172],
    ['Chicken thigh (cooked)', 209, 26, 0, 11, '100 g', 100],
    ['Ground beef 85% (cooked)', 250, 26, 0, 15, '100 g', 100],
    ['Beef steak, sirloin (cooked)', 206, 29, 0, 9, '100 g', 100],
    ['Pork chop (cooked)', 231, 26, 0, 14, '100 g', 100],
    ['Lamb (cooked)', 294, 25, 0, 21, '100 g', 100],
    ['Turkey breast (roasted)', 135, 30, 0, 1, '100 g', 100],
    ['Bacon (cooked)', 541, 37, 1.4, 42, '3 slices', 24],
    ['Ham (sliced)', 145, 21, 1.5, 5.5, '2 slices', 56],
    ['Hot dog (frankfurter)', 290, 10, 4, 26, '1 frank', 45],
    ['Salmon (cooked)', 206, 22, 0, 12, '1 fillet', 154],
    ['Tuna (canned in water)', 116, 26, 0, 0.8, '1 can', 142],
    ['Shrimp (cooked)', 99, 24, 0.2, 0.3, '100 g', 100],
    ['Cod (cooked)', 105, 23, 0, 0.9, '100 g', 100],
    ['Egg (whole)', 143, 12.6, 0.7, 9.5, '1 large', 50],
    ['Egg white', 52, 11, 0.7, 0.2, '1 large', 33],
    ['Scrambled eggs', 148, 10, 1.6, 11, '2 eggs', 122],
  ],
  'Plant protein': [
    ['Tofu (firm)', 144, 17, 3, 9, '½ cup', 126],
    ['Tempeh', 192, 20, 7.6, 11, '100 g', 100],
    ['Lentils (cooked)', 116, 9, 20, 0.4, '1 cup', 198],
    ['Chickpeas (cooked)', 164, 8.9, 27, 2.6, '1 cup', 164],
    ['Black beans (cooked)', 132, 8.9, 24, 0.5, '1 cup', 172],
    ['Kidney beans (cooked)', 127, 8.7, 23, 0.5, '1 cup', 177],
    ['Whey protein powder', 400, 80, 8, 6, '1 scoop', 30],
  ],
  Dairy: [
    ['Milk, whole', 61, 3.2, 4.8, 3.3, '1 cup', 244],
    ['Milk, 2%', 50, 3.3, 4.8, 2, '1 cup', 244],
    ['Milk, skim', 34, 3.4, 5, 0.1, '1 cup', 245],
    ['Soy milk (unsweetened)', 33, 2.9, 1.7, 1.8, '1 cup', 243],
    ['Almond milk (unsweetened)', 15, 0.6, 0.3, 1.2, '1 cup', 240],
    ['Oat milk', 48, 1, 7.5, 1.5, '1 cup', 240],
    ['Greek yogurt, nonfat', 59, 10, 3.6, 0.4, '1 container', 170],
    ['Greek yogurt, whole', 97, 9, 4, 5, '1 container', 170],
    ['Yogurt, plain low-fat', 63, 5.3, 7, 1.6, '1 cup', 245],
    ['Cheddar cheese', 403, 25, 1.3, 33, '1 slice', 28],
    ['Mozzarella', 280, 28, 3.1, 17, '1 oz', 28],
    ['Feta', 264, 14, 4, 21, '1 oz', 28],
    ['Parmesan', 431, 38, 4, 29, '1 tbsp', 5],
    ['Cottage cheese', 98, 11, 3.4, 4.3, '½ cup', 113],
    ['Cream cheese', 342, 6, 4, 34, '1 tbsp', 14.5],
    ['Butter', 717, 0.9, 0.1, 81, '1 tbsp', 14],
    ['Ice cream (vanilla)', 207, 3.5, 24, 11, '½ cup', 66],
  ],
  'Nuts, oils & spreads': [
    ['Almonds', 579, 21, 22, 50, '1 handful', 28],
    ['Peanuts', 567, 26, 16, 49, '1 handful', 28],
    ['Walnuts', 654, 15, 14, 65, '1 handful', 28],
    ['Cashews', 553, 18, 30, 44, '1 handful', 28],
    ['Sunflower seeds', 584, 21, 20, 51, '1 oz', 28],
    ['Chia seeds', 486, 17, 42, 31, '1 tbsp', 12],
    ['Peanut butter', 588, 25, 20, 50, '2 tbsp', 32],
    ['Chocolate hazelnut spread', 539, 6, 58, 31, '2 tbsp', 37],
    ['Olive oil', 884, 0, 0, 100, '1 tbsp', 13.5],
    ['Coconut oil', 862, 0, 0, 100, '1 tbsp', 13.6],
    ['Mayonnaise', 680, 1, 0.6, 75, '1 tbsp', 14],
    ['Hummus', 166, 8, 14, 9.6, '2 tbsp', 30],
    ['Honey', 304, 0.3, 82, 0, '1 tbsp', 21],
    ['Maple syrup', 260, 0, 67, 0.1, '1 tbsp', 20],
    ['Sugar', 387, 0, 100, 0, '1 tsp', 4],
    ['Ketchup', 101, 1, 27, 0.1, '1 tbsp', 17],
  ],
  'Meals & takeaway (approx.)': [
    ['Pizza, cheese', 266, 11, 33, 10, '1 slice', 107],
    ['Cheeseburger', 270, 15, 23, 13, '1 burger', 119],
    ['Chicken nuggets', 296, 15, 18, 18, '6 pieces', 96],
    ['Sushi roll (California)', 140, 3, 26, 2, '6 pieces', 150],
    ['Fried rice', 163, 3.6, 24, 5.7, '1 cup', 198],
    ['Spaghetti bolognese', 130, 6, 16, 4.5, '1 cup', 248],
    ['Lasagna', 135, 8, 13, 6, '1 piece', 250],
    ['Macaroni and cheese', 164, 7, 20, 6, '1 cup', 200],
    ['Beef taco', 226, 10, 17, 13, '1 taco', 78],
    ['Omelette', 154, 11, 0.6, 12, '2-egg omelette', 120],
    ['Mashed potatoes', 113, 2, 17, 4.2, '1 cup', 210],
    ['Chicken soup', 36, 2.5, 3.5, 1, '1 cup', 248],
    ['Tomato soup', 40, 1, 8, 0.7, '1 cup', 248],
  ],
  'Snacks & sweets': [
    ['Dark chocolate (70–85%)', 598, 7.8, 46, 43, '1 oz', 28],
    ['Milk chocolate', 535, 7.7, 59, 30, '1 bar', 44],
    ['Potato chips', 536, 7, 53, 35, '1 oz', 28],
    ['Chocolate chip cookie', 488, 5, 64, 24, '1 cookie', 30],
    ['Glazed donut', 421, 5, 51, 22, '1 medium', 60],
    ['Croissant', 406, 8.2, 46, 21, '1 medium', 57],
    ['Blueberry muffin', 377, 5, 54, 16, '1 medium', 113],
    ['Chocolate cake', 371, 5, 53, 16, '1 slice', 95],
    ['Protein bar', 360, 30, 35, 10, '1 bar', 60],
    ['Granola bar', 471, 8, 64, 20, '1 bar', 24],
  ],
  Drinks: [
    ['Coffee (black)', 1, 0.1, 0, 0, '1 cup', 240],
    ['Latte (whole milk)', 53, 3.3, 5, 2.8, '12 oz', 360],
    ['Tea (unsweetened)', 1, 0, 0.3, 0, '1 cup', 240],
    ['Orange juice', 45, 0.7, 10, 0.2, '1 cup', 248],
    ['Cola', 42, 0, 10.6, 0, '1 can', 355],
    ['Energy drink', 45, 0, 11, 0, '1 can', 250],
    ['Sports drink', 26, 0, 6.4, 0, '1 bottle', 591],
    ['Fruit smoothie', 60, 0.5, 14, 0.3, '1 cup', 250],
    ['Beer (regular)', 43, 0.5, 3.6, 0, '1 can', 356],
    ['Red wine', 85, 0.1, 2.6, 0, '1 glass', 150],
    ['Spirits (vodka/whiskey)', 231, 0, 0, 0, '1 shot', 42],
  ],
};

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const BASICS = Object.entries(CATEGORIES).flatMap(([category, rows]) =>
  rows.map(([name, kcal, protein, carbs, fat, servingLabel, servingGrams]) => ({
    id: `seed:${slug(name)}`,
    name,
    category,
    // the takeaway group is approximate by nature, like the dishes below
    ...(category.includes('approx') ? { approx: true } : {}),
    per100g: { kcal, protein, carbs, fat },
    servingLabel,
    servingGrams,
  })),
);

const round1 = (n) => Math.round(n * 10) / 10;

/** Dishes are written per serving (see foods-dishes.js); the library stores everything per 100 g. */
const DISH_FOODS = Object.entries(DISHES).flatMap(([category, rows]) =>
  rows.map(([name, servingLabel, servingGrams, kcal, protein, carbs, fat]) => ({
    id: `seed:${slug(name)}`,
    name,
    category,
    approx: true,
    per100g: { kcal: round1((kcal * 100) / servingGrams), protein: round1((protein * 100) / servingGrams), carbs: round1((carbs * 100) / servingGrams), fat: round1((fat * 100) / servingGrams) },
    servingLabel,
    servingGrams,
  })),
);

export const SEED_FOODS = [...BASICS, ...DISH_FOODS];

/** The order of the category chips: the food people look for most comes first. */
export const CATEGORY_ORDER = [
  'Mexican', 'American and fast food', 'Pizza and Italian', 'Asian', 'Indian', 'Mediterranean and Middle Eastern', 'European and British',
  'Latin American and Caribbean', 'Breakfast', 'Salads and bowls', 'Soups', 'Meal-kit style dinners', 'Desserts', 'Drinks', 'Snacks and sauces',
  'Plant-based', 'Fruit', 'Vegetables', 'Grains & bread', 'Meat, fish & eggs', 'Plant protein', 'Dairy', 'Nuts, oils & spreads',
  'Meals & takeaway (approx.)', 'Snacks & sweets',
];

/** Shown first, before anyone has searched: a short list of what most people log. */
export const POPULAR = [
  'Banana', 'Apple', 'Egg (whole)', 'Oatmeal (cooked)', 'Greek yogurt, nonfat', 'Avocado toast', 'Bagel with cream cheese', 'Pancakes (3, with syrup and butter)',
  'Chicken breast (cooked)', 'White rice (cooked)', 'Salmon (cooked)', 'Chicken burrito', 'Bean and cheese burrito', 'Chicken burrito bowl (rice, beans, salsa)',
  'Soft taco, chicken', 'Cheese quesadilla', 'Hamburger (single patty, bun)', 'Double cheeseburger', 'Pepperoni pizza', 'Margherita pizza',
  'Spaghetti with meat sauce', 'Caesar salad with chicken', 'Chicken teriyaki with rice', 'Pad thai with chicken', 'Chicken tikka masala',
  'Chicken shawarma wrap', 'Turkey sandwich (deli)', 'Latte (whole milk)', 'Cappuccino (12 oz, whole milk)', 'Chocolate chip cookie, bakery size',
  'Almonds', 'Peanut butter', 'Protein bar',
];
