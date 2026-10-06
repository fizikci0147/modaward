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

## Shop

| | |
|---|---|
| `GET /api/shop/retailers` | |
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
