/**
 * Versioned front-end files.
 *
 * Every release serves its scripts and styles under /v/<build>/…, and rewrites the absolute
 * imports inside them to the same prefix. A browser, the service worker or a hosting provider's
 * cache can therefore never hand out an old screen after an update: new build, new addresses.
 * Because those addresses never change content, they are cached for a year.
 *
 * The plain /js/… and /shared/… addresses keep working (an old page, an old service worker) and
 * serve the current code with the current prefix, so a stale page repairs itself.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['js', 'css', 'vendor', 'shared'];
// from '/js/x.js'   import('/js/x.js')   import `/shared/…`   new Worker('/js/…')   import '/js/x.js'
const ABSOLUTE = /(\bfrom\s*|\bimport\s*\(\s*|\bnew Worker\(\s*|\bimport\s*)(['"`])\/(js|shared|vendor)\//g;
const JS_TYPE = 'text/javascript; charset=utf-8';

/** A path-safe name for a build id such as "5.5.0+097345b". */
export const buildSegment = (id) => String(id || 'development').replace(/[^A-Za-z0-9._-]/g, '-');

/** @param {{publicDir:string, sharedDir:string, build:{id:string}}} config */
export function createAssets(config) {
  const seg = buildSegment(config.build.id);
  const prefix = `/v/${seg}`;
  const immutable = config.build.id !== 'development';
  const dirs = { js: path.join(config.publicDir, 'js'), css: path.join(config.publicDir, 'css'), vendor: path.join(config.publicDir, 'vendor'), shared: config.sharedDir };
  const rewritten = new Map();

  const version = (source) => source.replace(ABSOLUTE, (_m, head, quote, root) => `${head}${quote}${prefix}/${root}/`);

  /** Resolve "<root>/<rest>" to a file inside that root, or null. */
  function locate(root, rest) {
    if (!ROOTS.includes(root) || !rest || rest.includes('\0')) return null;
    const base = dirs[root];
    const file = path.resolve(base, rest);
    if (file !== base && !file.startsWith(base + path.sep)) return null;
    try {
      return fs.statSync(file).isFile() ? file : null;
    } catch {
      return null;
    }
  }

  const decode = (s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return null;
    }
  };

  function send(res, file, cacheable) {
    res.setHeader('Cache-Control', cacheable && immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (file.endsWith('.js')) {
      let body = rewritten.get(file);
      if (body === undefined) {
        body = version(fs.readFileSync(file, 'utf8'));
        rewritten.set(file, body);
      }
      res.setHeader('Content-Type', JS_TYPE);
      return res.send(body);
    }
    return res.sendFile(file);
  }

  /** Every module reachable through static imports from main.js, as /js/... and /shared/... paths. */
  function startupModules() {
    const seen = new Set();
    const queue = ['/js/main.js'];
    const IMPORT = /(?:\bfrom\s*|\bimport\s*)(['"])(\/(?:js|shared|vendor)\/[^'"]+\.js)\1/g;
    while (queue.length) {
      const url = queue.shift();
      if (seen.has(url)) continue;
      const [, root, ...rest] = url.split('/');
      const file = locate(root, rest.join('/'));
      if (!file) continue;
      seen.add(url);
      for (const m of fs.readFileSync(file, 'utf8').matchAll(IMPORT)) queue.push(m[2]);
    }
    return [...seen];
  }

  return {
    prefix,
    version,
    /** /v/<any build>/<root>/<file>: always the current files, imports pointing at the current build. */
    versioned(req, res, next) {
      const m = /^\/v\/([^/]+)\/(js|css|vendor|shared)\/(.+)$/.exec(req.path);
      const file = m && locate(m[2], decode(m[3]));
      // a page still holding an older build's address gets today's files, but must not cache them
      // for a year under that address (a later visit would then mix old and new code)
      return file ? send(res, file, m[1] === seg) : next();
    },
    /** The plain /js/… and /shared/… addresses, served with versioned imports but never cached for long. */
    plain(req, res, next) {
      const m = /^\/(js|shared)\/(.+\.js)$/.exec(req.path);
      const file = m && locate(m[1], decode(m[2]));
      return file ? send(res, file, false) : next();
    },
    /**
     * index.html pointing at this build's script and stylesheet, with every module the app needs at
     * start-up preloaded in one go. Without that, the browser discovers imports level by level and
     * pays a network round trip per level, which is what makes a slow phone connection feel slow.
     */
    indexHtml: (() => {
      let html = null;
      return () => {
        if (html === null) {
          const preload = startupModules().map((u) => `<link rel="modulepreload" href="${prefix}${u}" />`).join('\n  ');
          html = fs
            .readFileSync(path.join(config.publicDir, 'index.html'), 'utf8')
            .replace('href="/css/app.css"', `href="${prefix}/css/app.css"`)
            .replace('<link rel="stylesheet"', `${preload}\n  <link rel="stylesheet"`)
            .replace('src="/js/main.js"', `src="${prefix}/js/main.js"`);
        }
        return html;
      };
    })(),
    /** The service worker, with this build's cache name and versioned shell entries. */
    serviceWorker() {
      return fs
        .readFileSync(path.join(config.publicDir, 'sw.js'), 'utf8')
        .replace(/const VERSION = '[^']*';/, `const VERSION = 'mw-${config.build.id}';`)
        .replace(/'\/(js|css|vendor)\//g, `'${prefix}/$1/`);
    }
  };
}
