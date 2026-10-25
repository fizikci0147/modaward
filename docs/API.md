# HTTP API

JSON over HTTPS. Cookie session (`mw_session`, HttpOnly). Every non-GET request must send `X-Requested-With: modaward`. Errors:

```json
{ "error": { "code": "upgrade_required", "message": "…", "details": { "feature": "closet" } }, "requestId": "a1b2c3" }
```

Common codes: `bad_request` 400, `unauthorized` 401, `upgrade_required` 402, `forbidden` 403, `not_found` 404, `conflict` 409, `location_required` 409, `rate_limited` 429, `unavailable` 503.

## Auth and account

| | |
|---|---|
| `GET /api/auth/me` | `{ user\|null, profile, capabilities, entitlements }` |
| `POST /api/auth/register` `{email,password,name?}` | 201, signs in |
| `POST /api/auth/login` `{email,password}` | |
| `POST /api/auth/logout` | |
| `POST /api/auth/forgot` `{email}` | always 200 |
| `POST /api/auth/reset` `{token,password}` | single-use token |
| `PATCH /api/account` `{name}` · `POST /api/account/password` `{current,next}` | |
| `GET /api/account/export` | everything we hold, as a download |
| `DELETE /api/account` `{password}` | deletes data, photos, cancels billing |

## Profile and closet

| | |
|---|---|
| `GET /api/profile` · `PATCH /api/profile` | partial, deep-merged; returns `{profile, completeness}` |
| `GET /api/geo/search?q=` | city search |
| `GET /api/garments` · `POST /api/garments` | `type`, `color` required; optional `image` (data URL) |
| `POST /api/garments/starter` | add a starter wardrobe |
| `GET/PATCH/DELETE /api/garments/:id` | |
| `PUT/DELETE /api/garments/:id/photo` | |
| `GET /uploads/:file` | owner only |

## Outfits

| | |
|---|---|
| `GET /api/weather` | normalised forecast (metric) for the profile location |
| `POST /api/outfits/recommend` `{date?,occasion,seed?,count?,curate?}` | outfits with items, reasons, warnings, tips |
| `POST /api/plan` `{seed?}` | week plan; days beyond the plan limit are `locked` |
| `POST/DELETE /api/outfits/wear` | log / undo what was worn |
| `POST /api/outfits/feedback` `{itemIds,signal}` | `love · like · wear · save · skip · dislike` |
| `GET /api/outfits/history` | |

## Track Weight (calorie tracker page)

The diary itself is stored on the person's device; these are the only server calls. Searching needs no sign-in.

| | |
|---|---|
| `GET /api/trackweight/status` | `{ signedIn, usda, photo }`: `photo` is `on`, `signin`, `pro` or `off` (why meal photos can or cannot be used) |
| `GET /api/trackweight/foods/search?q=` | `{ foods: [{ id, name, brand?, barcode?, per100g: {kcal, protein, carbs, fat, fiber?}, servingGrams?, servingLabel?, source: 'off'\|'usda' }] }`; 503 if every database is unreachable |
| `GET /api/trackweight/foods/barcode/:code` | `{ food }`; 404 if unknown or malformed, 503 if the database is unreachable |
| `POST /api/trackweight/analyze-meal` `{image, hint?}` | signed in. `image` is a JPEG/PNG/WebP data URL, `hint` up to 300 characters. Returns `{ items: [{ name, grams, kcal, protein_g, carbs_g, fat_g, confidence }], notes }`. 402 `upgrade_required` (paid site, not Pro), 503 (not switched on), 429 (daily allowance), 422 `ai_unsure` (could not read it) |

## Shop

| | |
|---|---|
| `GET /api/shop/retailers` | The original list of stores (id, name, tier, departments) |
| `GET /api/shop/stores` | The store picker: every built-in store (with regions it ships to and where it is a starter store), the regions, the person's region and the stores they added |
| `POST /api/shop/stores` | Add a store: `{ name, url, search? }` (`search` contains `{q}`). Refused for non-public addresses, a store we already list (409), a duplicate, or more than 25. The store is chosen straight away. |
| `DELETE /api/shop/stores/:id` | Remove a store you added (also drops it from your chosen stores) |
| `POST /api/shop/looks` `{kind,storeMode,occasions,seed,limit,curate?}` | looks, `locked` count, weather reference |
| `POST /api/shop/gaps` | closet gaps with suggested pieces |
| `POST /api/shop/feedback` `{lookId,signal,pieceIndex?}` | trains the taste model |
| `GET/POST /api/shop/saved` · `DELETE /api/shop/saved/:id` | |
| `GET /go?r&k&u&s` | signed redirect (logs the click) |

## Intelligence, media, billing, ops

| | |
|---|---|
| `GET /api/insights` | style DNA |
| `POST /api/ai/analyze-garment` `{image}` | Pro; needs `ANTHROPIC_API_KEY` |
| `POST /api/photos/cutout` `{image}` | Pro; needs `REMOVEBG_API_KEY` |
| `POST /api/billing/checkout` `{interval: month\|year}` · `POST /api/billing/portal` | return `{url}` |
| `POST /api/billing/webhook` | Stripe, signature-verified |
| `GET /api/admin/metrics` | `ADMIN_EMAILS` only |
| `GET /health` · `GET /ready` | liveness / DB readiness |
