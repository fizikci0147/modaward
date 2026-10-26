// Builds extruded building meshes off the main thread.
// Input: a run of buildings (tile-sorted) with int16 tile-local rings.
// Output: chunks of <=65k vertices; each vertex is 8 bytes:
// int16 x, int16 y (0.05 m units from tile centre), uint16 z (dm), uint16 local building id.
importScripts('earcut.js');
const cut = self.earcut.default || self.earcut;
self.onmessage = (e) => {
  const { coords, cnt, hdm, tile, start, T, ncol, txm, tym } = e.data;
  const n = cnt.length;
  const MAXV = 65000;
  let off = 0;
  let cur = null;
  const flush = () => {
    if (!cur || cur.nb === 0) return;
    const vb = new ArrayBuffer(cur.nv * 8);
    const dv = new Int16Array(vb), du = new Uint16Array(vb);
    for (let k = 0; k < cur.nv; k++) {
      dv[k * 4] = cur.x[k]; dv[k * 4 + 1] = cur.y[k];
      du[k * 4 + 2] = cur.z[k]; du[k * 4 + 3] = cur.l[k];
    }
    const ib = Uint16Array.from(cur.idx);
    self.postMessage({ chunk: { vb, ib, base: cur.base, nb: cur.nb, ox: cur.ox, oy: cur.oy,
      bbox: [cur.minx * 0.05 + cur.ox, cur.miny * 0.05 + cur.oy, cur.maxx * 0.05 + cur.ox, cur.maxy * 0.05 + cur.oy, cur.maxz * 0.1] } },
      [vb, ib.buffer]);
    cur = null;
  };
  const begin = (t, base) => {
    cur = { t, base, nb: 0, nv: 0, x: [], y: [], z: [], l: [], idx: [],
      ox: ((t % ncol) + txm + 0.5) * T, oy: (Math.floor(t / ncol) + tym + 0.5) * T,
      minx: 1e9, miny: 1e9, maxx: -1e9, maxy: -1e9, maxz: 0 };
  };
  const flat = [];
  for (let i = 0; i < n; i++) {
    const m = cnt[i], t = tile[i], h = hdm[i];
    if (!cur || cur.t !== t || cur.nv + 2 * m > MAXV) { flush(); begin(t, start + i); }
    const lid = start + i - cur.base;
    const v0 = cur.nv;
    flat.length = 0;
    for (let j = 0; j < m; j++) {
      const x = coords[(off + j) * 2], y = coords[(off + j) * 2 + 1];
      flat.push(x, y);
      // top ring then bottom ring
      cur.x.push(x); cur.y.push(y); cur.z.push(h); cur.l.push(lid);
      if (x < cur.minx) cur.minx = x; if (x > cur.maxx) cur.maxx = x;
      if (y < cur.miny) cur.miny = y; if (y > cur.maxy) cur.maxy = y;
    }
    for (let j = 0; j < m; j++) { cur.x.push(flat[j * 2]); cur.y.push(flat[j * 2 + 1]); cur.z.push(0); cur.l.push(lid); }
    if (h > cur.maxz) cur.maxz = h;
    const tri = m === 3 ? [0, 1, 2] : cut(flat);
    for (let k = 0; k < tri.length; k++) cur.idx.push(v0 + tri[k]);
    for (let j = 0; j < m; j++) {
      const a = j, b = (j + 1) % m;
      const ta = v0 + a, tb = v0 + b, ba = v0 + m + a, bb = v0 + m + b;
      cur.idx.push(ba, bb, tb, ba, tb, ta);
    }
    cur.nv += 2 * m; cur.nb++;
    off += m;
  }
  flush();
  self.postMessage({ done: true });
};
