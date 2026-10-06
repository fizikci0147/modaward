/**
 * Week planner: picks an outfit per day while spreading pieces across the week, so the same
 * jeans do not appear five times unless the closet leaves no choice.
 */
import { recommend } from './outfit.js';
import { buildContext } from './context.js';

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD string (timezone-independent). */
export function weekday(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** How hard a day is to dress for: planned first so it gets first pick of the closet. */
function difficulty(day) {
  const ctx = buildContext(day);
  let d = 0;
  if (ctx.rain === 'heavy') d += 3;
  else if (ctx.rain === 'light') d += 1.5;
  if (ctx.snow) d += 3;
  d += Math.max(0, 8 - ctx.minFeels) / 4;
  d += Math.max(0, ctx.maxFeels - 28) / 4;
  d += ctx.swing / 10;
  return d;
}

/**
 * @param {object} args
 * @param {object[]} args.garments
 * @param {object[]} args.days            normalised forecast days, chronological
 * @param {object|null} args.profile
 * @param {{lastWorn?:Record<string,number>, recentKeys?:string[]}} [args.history]
 * @param {number[]} [args.workDays]      weekday numbers that count as work (default Mon–Fri)
 * @param {Record<string,string>} [args.occasions]  explicit occasion per date
 * @param {'metric'|'imperial'} [args.units]
 * @param {number|string} [args.seed]
 * @param {number|null} [args.nowHour]    hour of day if days[0] is today
 * @param {number} [args.count]           alternatives per day
 */
export function planWeek(args) {
  const workDays = args.workDays || [1, 2, 3, 4, 5];
  const usage = new Map();
  const order = args.days.map((day, index) => ({ day, index, hard: difficulty(day) })).sort((a, b) => b.hard - a.hard);
  const planned = new Array(args.days.length);

  for (const { day, index } of order) {
    const occasion = args.occasions?.[day.date] || (workDays.includes(weekday(day.date)) ? 'work' : 'casual');
    const avoid = new Map();
    for (const [id, n] of usage) avoid.set(id, Math.min(1, 0.55 * n));

    const result = recommend({
      garments: args.garments,
      day,
      occasion,
      profile: args.profile,
      history: args.history,
      avoid,
      seed: args.seed,
      count: args.count ?? 3,
      units: args.units,
      nowHour: index === 0 ? args.nowHour ?? null : null
    });

    const chosen = result.outfits[0];
    if (chosen) for (const id of chosen.itemIds) usage.set(id, (usage.get(id) || 0) + 1);
    planned[index] = { date: day.date, occasion, ...result };
  }
  return planned;
}

/** What to take along over the period: umbrella days, cold snaps, sun. */
export function weekDigest(days) {
  const notes = [];
  const wet = [];
  let coldest = null;
  let hottest = null;
  for (const day of days) {
    const ctx = buildContext(day);
    if (ctx.rain !== 'none') wet.push(day.date);
    if (!coldest || ctx.minFeels < coldest.v) coldest = { date: day.date, v: ctx.minFeels };
    if (!hottest || ctx.maxFeels > hottest.v) hottest = { date: day.date, v: ctx.maxFeels };
  }
  return { wetDates: wet, coldest, hottest, notes };
}
