/**
 * The maths behind the calorie tracker at /trackweight. Pure functions (no I/O), shared by the page
 * and the tests.
 */

export const ACTIVITY_LEVELS = {
  sedentary: { label: 'Sedentary (desk job, little walking)', factor: 1.2 },
  light: { label: 'Lightly active (on your feet part of the day)', factor: 1.375 },
  moderate: { label: 'Active (on your feet most of the day)', factor: 1.55 },
  very: { label: 'Very active (physical job)', factor: 1.725 }
};

export const DEFAULT_PROFILE = { sex: 'female', age: 30, heightCm: 170, weightKg: 70, activity: 'light', goal: 'maintain', weeklyKg: 0.5 };

const KCAL_PER_KG = 7700;

/** Mifflin–St Jeor basal metabolic rate (kcal/day). */
export const bmr = (p) => 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);

/** Maintenance calories: BMR times daily activity (workouts are logged separately). */
export const tdee = (p) => bmr(p) * ACTIVITY_LEVELS[p.activity].factor;

/**
 * Daily calorie and macro targets. A custom calorie target wins; otherwise maintenance plus or minus
 * the chosen weekly rate, never below 1,200 kcal (women) or 1,500 kcal (men). Protein 1.8 g/kg (at
 * most 40% of calories), fat 27%, carbohydrate the remainder.
 */
export function targets(p) {
  const floor = p.sex === 'male' ? 1500 : 1200;
  const delta = p.goal === 'maintain' ? 0 : ((p.goal === 'lose' ? -1 : 1) * p.weeklyKg * KCAL_PER_KG) / 7;
  const raw = p.customKcal ?? tdee(p) + delta;
  const kcal = Math.round(Math.max(floor, raw) / 10) * 10;
  const protein = Math.round(Math.min(p.weightKg * 1.8, (kcal * 0.4) / 4));
  const fat = Math.round((kcal * 0.27) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, floored: raw < floor };
}

/** kcal burned = MET × body weight (kg) × hours. */
export const exerciseKcal = (met, weightKg, minutes) => Math.round((met * weightKg * minutes) / 60);

/** Per-100 g nutrition scaled to a portion of `grams`. */
export function scale(per100g, grams) {
  const f = grams / 100;
  const r = (n) => Math.round(n * f * 10) / 10;
  return { kcal: Math.round(per100g.kcal * f), protein: r(per100g.protein), carbs: r(per100g.carbs), fat: r(per100g.fat) };
}

export const sumMacros = (items) =>
  items.reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

/** Calendar helpers on local YYYY-MM-DD strings. */
export const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => toISO(new Date());
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return toISO(new Date(y, m - 1, d + n));
}
