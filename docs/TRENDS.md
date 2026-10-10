# Trends

ModaWard's outfit engine follows what is in style, but **the person's own taste always comes first**.

## How a trend is used

A trend never creates an outfit and never rescues one the person would not enjoy. It adds a small bonus, only to outfits that are already good for them:

```
bonus = weight × how well the trend fits their style × how much they like the outfit × their "trendiness" setting
```

- *How well the trend fits their style*: every trend names the style archetypes it suits (classic, minimal, street, boho …). If none of those is one of the person's styles, the trend is ignored for them.
- *How much they like the outfit*: the engine's style score for that outfit (their quiz answers, loved/avoided colours, "never" list and what they have loved or skipped). Below "neutral" the bonus is zero.
- *Their setting* (**You → Style → How current should your outfits be?**): Timeless (no trend bonus), A little current (default), Very current (double).
- The total lift is capped at 0.06 (0.12 on "Very current") on a 0–1 score, so it breaks ties between close candidates and nothing more.

When a trend contributed, the outfit says so: "In step with this season: relaxed tailoring."

## What is built in

`src/shared/trends.js` holds one list for autumn/winter and one for spring/summer, chosen by the date and the hemisphere of the person's saved location. They were compiled in **October 2026** from Fall/Winter 2026 and Spring/Summer 2026 reporting (Net-a-Porter, JOOR, FASHION Magazine, Mango, LuisaViaRoma, Ape to Gentleman, H&M, Rath & Co. and New York Fashion Week FW26 data): deep burgundy and oxblood, camel and chocolate neutrals, tonal and all-black dressing, knitwear and a shirt under a knit, relaxed tailoring with sneakers or loafers, the trench and utility rain jacket, big outerwear, rugby stripes, muted checks, denim with tailoring; for spring: warm off-white, bold colour, lilac, florals, light tailoring, flats, straight denim, the polo, fluid dresses.

Fashion moves faster than software releases, so the lists keep themselves current:

- **Automatic monthly refresh** (needs `ANTHROPIC_API_KEY`; switch off with `TRENDS_AUTO_REFRESH=0`). Shortly after start-up and then daily, the app checks the saved lists; when they are a month old it asks Claude, with web search, for what is in style for the current and the next season. The answer is **validated before use**: only real palette colours, garment types, patterns and styles survive, weights are capped, and if fewer than six trends per season remain the whole answer is thrown away and the old lists stay. The new lists are saved to `DATA_DIR/trends.json` (the previous file is kept as `trends.previous.json`), with the sources it used, and take effect immediately. It also supplies each trend's name in all seven languages. Cost: one request a month.
- **Refresh now / go back**: *Business → System check → Trend lists* has *Refresh now* and *Use built-in lists* buttons, and shows when the lists were compiled, where they came from and any error.
- **Old lists fade out.** Lists keep full strength for six months and then lose strength gradually (to a quarter at eighteen months), so a site that never refreshes slowly stops steering people toward last year's looks instead of doing it forever.
- Without an AI key the built-in lists above are used, so plan to update the app (or edit `trends.json` by hand) each season.

## Editing by hand

Put a file named `trends.json` in the app's data folder (`DATA_DIR`) and restart. It can replace either list:

```json
{
  "fw": [
    { "id": "oxblood", "label": "deep oxblood", "weight": 0.05,
      "archetypes": ["classic", "polished"],
      "match": { "colors": ["burgundy"] } },
    { "id": "relaxed-blazer", "label": "the relaxed blazer", "weight": 0.04,
      "match": { "all": [ { "types": ["blazer"] }, { "types": ["sneakers", "loafers"] } ] } }
  ],
  "ss": [ ]
}
```

- `label` is shown to people in the sentence above (it is translated when the exact text exists in a language file; otherwise it appears as written).
- `weight` is clamped to 0.08. `archetypes` is optional (omit for "everyone").
- `match` is one of: `{ "colors": [palette names], "on": "main" | "any" }`, `{ "types": [garment types], "on": "upper" | "main" | "any" }`, `{ "patterns": [...] }`, `{ "tonal": "black" | "warm" }`, or `{ "all": [ ... ] }` combining clauses. Palette names and garment types are the ones in `src/shared/color.js` and `src/shared/taxonomy.js`.
- A list that is missing or malformed is ignored and the built-in one is used.
