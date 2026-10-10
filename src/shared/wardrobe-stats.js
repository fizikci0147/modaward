/**
 * Numbers about a closet: how much of it gets worn, what the best-value pieces are, which
 * categories carry the wardrobe. Pure, so it is unit-tested without a server.
 */
import { idleInfo, dormantPieces } from './dormancy.js';

const slim = (g, extra = {}) => ({
  id: g.id,
  name: g.name,
  type: g.type,
  category: g.category,
  color: g.color,
  imageUrl: g.imageUrl ?? null,
  wearCount: g.wearCount ?? 0,
  priceCents: g.priceCents ?? null,
  ...extra
});

/**
 * @param {{garments: object[], counts30: Map<string, number>, counts90: Map<string, number>, today: string}} args
 */
export function wardrobeStats({ garments, counts30, counts90, today }) {
  const list = garments.filter((g) => !g.archived);
  const pieces = list.length;
  const worn30 = list.filter((g) => counts30.has(g.id)).length;
  const worn90 = list.filter((g) => counts90.has(g.id)).length;
  const totalWears = list.reduce((n, g) => n + (g.wearCount ?? 0), 0);
  const priced = list.filter((g) => g.priceCents > 0);
  const totalValueCents = priced.reduce((n, g) => n + g.priceCents, 0);

  const withCpw = priced.map((g) => ({ g, cpw: g.priceCents / Math.max(1, g.wearCount ?? 0), worn: (g.wearCount ?? 0) > 0 }));
  // best value: cheapest per wear among pieces that have actually been worn a few times
  const bestValue = withCpw
    .filter((x) => x.g.wearCount >= 2)
    .sort((a, b) => a.cpw - b.cpw)
    .slice(0, 5)
    .map((x) => slim(x.g, { cpwCents: Math.round(x.cpw) }));
  // worth wearing more: expensive per wear so far (never-worn pieces count their full price)
  const worthWearing = withCpw
    .filter((x) => x.cpw >= 1500)
    .sort((a, b) => b.cpw - a.cpw)
    .slice(0, 5)
    .map((x) => slim(x.g, { cpwCents: Math.round(x.cpw) }));
  const pricedWorn = withCpw.filter((x) => x.worn);
  const avgCpwCents = pricedWorn.length ? Math.round(pricedWorn.reduce((n, x) => n + x.cpw, 0) / pricedWorn.length) : null;

  const mostWorn = [...list]
    .filter((g) => g.wearCount > 0)
    .sort((a, b) => b.wearCount - a.wearCount)
    .slice(0, 5)
    .map((g) => slim(g, { cpwCents: g.priceCents > 0 ? Math.round(g.priceCents / g.wearCount) : null }));

  const dormant = dormantPieces(list, today);
  const byCategory = Object.entries(
    list.reduce((m, g) => {
      const c = (m[g.category] ||= { category: g.category, pieces: 0, wears: 0, worn30: 0 });
      c.pieces += 1;
      c.wears += g.wearCount ?? 0;
      if (counts30.has(g.id)) c.worn30 += 1;
      return m;
    }, {})
  )
    .map(([, v]) => v)
    .sort((a, b) => b.pieces - a.pieces);

  return {
    pieces,
    worn30,
    worn90,
    utilization30: pieces ? Math.round((worn30 / pieces) * 100) : 0,
    utilization90: pieces ? Math.round((worn90 / pieces) * 100) : 0,
    neverWorn: list.filter((g) => !g.wearCount).length,
    dormant: dormant.length,
    dormantTop: dormant.slice(0, 5).map((g) => slim(g, { idleDays: g.idleDays, neverWorn: g.neverWorn })),
    totalWears,
    avgWears: pieces ? Math.round((totalWears / pieces) * 10) / 10 : 0,
    pricedCount: priced.length,
    totalValueCents,
    avgCpwCents,
    bestValue,
    worthWearing,
    mostWorn,
    byCategory,
    hasWearData: totalWears > 0,
    // how long the oldest wear record goes back, so the screen can say "based on N weeks"
    since: list.reduce((min, g) => (g.lastWornOn && (!min || g.lastWornOn < min) ? g.lastWornOn : min), null),
    idleMedian: pieces ? list.map((g) => idleInfo(g, today).days).sort((a, b) => a - b)[Math.floor(pieces / 2)] : 0
  };
}
