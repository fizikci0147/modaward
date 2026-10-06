'use strict';
/**
 * Startup file for hosts that expect a CommonJS entry point (Hostinger Node.js apps, Passenger).
 * The application itself is ES modules under ./src; this shim loads it.
 *
 * If startup fails (missing dependencies, unsupported Node version, unwritable data folder…) the
 * host would otherwise show an opaque "503 Service Unavailable". Instead we record the reason in
 * startup-error.log and serve a small 503 page. Set SHOW_STARTUP_ERRORS=1 to print the reason on
 * that page too (turn it off again once things work).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

function failedToStart(err) {
  const message = String((err && err.message) || err).slice(0, 500);
  try {
    fs.appendFileSync(path.join(__dirname, 'startup-error.log'), `${new Date().toISOString()} node ${process.version}\n${(err && err.stack) || message}\n\n`);
  } catch (_) {
    /* read-only folder: the console output below still reaches the host's log */
  }
  console.error('ModaWard failed to start:', err);
  const detail = process.env.SHOW_STARTUP_ERRORS === '1'
    ? `\nReason: ${message}\nNode.js: ${process.version}\n\nMore detail is in startup-error.log in the app folder.\nRun "npm run doctor" in the app folder for a full check.\n`
    : '\nSet the environment variable SHOW_STARTUP_ERRORS=1 and restart to see why,\nor open startup-error.log in the app folder.\n';
  http
    .createServer((req, res) => {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60', 'Cache-Control': 'no-store' });
      res.end(`ModaWard failed to start.\n${detail}`);
    })
    .listen(process.env.PORT || 8080);
}

import('./src/main.js').catch(failedToStart);
