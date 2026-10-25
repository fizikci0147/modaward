/**
 * A made-up shirt shading map for tests and for judging the fabric library. Real templates come from photographs
 * (see docs/TEMPLATES.md); this one only has to carry the things that matter to the renderer: a silhouette with
 * sleeves, folds, a darker underarm and a lit shoulder.
 */
import { rng } from '../../src/engine/rng.js';

export function shirtTemplate(width = 700, height = 820, seed = 3) {
  const data = new Uint8ClampedArray(width * height * 4);
  const r = rng(seed);
  const folds = Array.from({ length: 9 }, () => ({ x: 0.25 + r() * 0.5, y: 0.35 + r() * 0.55, a: (r() - 0.5) * 0.7, w: 0.015 + r() * 0.03, s: (r() - 0.5) * 0.5 }));
  const inside = (nx, ny) => {
    // torso
    const torso = ny > 0.12 && ny < 0.97 && Math.abs(nx - 0.5) < 0.2 + 0.015 * Math.sin(ny * 9);
    // shoulders and sleeves
    const sleeve = ny > 0.1 && ny < 0.42 && Math.abs(nx - 0.5) < 0.46 - (ny - 0.1) * 0.15 && Math.abs(nx - 0.5) > 0.17 && ny < 0.2 + (0.5 - Math.abs(nx - 0.5)) * 0.9 + 0.12 - (Math.abs(nx - 0.5) - 0.17) * 0.55 + 0.1;
    const shoulder = ny > 0.1 && ny < 0.2 && Math.abs(nx - 0.5) < 0.33;
    const neck = ny < 0.2 && Math.hypot((nx - 0.5) / 0.09, (ny - 0.1) / 0.075) < 1;
    return (torso || sleeve || shoulder) && !neck;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;
      const o = (y * width + x) * 4;
      // 3x3 supersample for a soft edge
      let cover = 0;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (inside((x + (i + 0.5) / 3) / width, (y + (j + 0.5) / 3) / height)) cover++;
      if (!cover) continue;
      let s = 1 + 0.16 * Math.cos((nx - 0.5) * 7);
      s -= 0.18 * Math.exp(-(((ny - 0.3) / 0.08) ** 2)) * (Math.abs(nx - 0.5) > 0.18 ? 1 : 0);
      for (const f of folds) {
        const d = (nx - f.x) * Math.cos(f.a) + (ny - f.y) * Math.sin(f.a);
        s += f.s * 0.9 * Math.exp(-((d / f.w) ** 2)) * Math.exp(-(((ny - f.y) / 0.25) ** 2));
      }
      const v = Math.max(0, Math.min(255, Math.round(s * 128)));
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = Math.round((cover / 9) * 255);
    }
  }
  return { data, width, height };
}
