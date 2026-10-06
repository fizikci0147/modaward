'use strict';
/**
 * Startup file for hosts that expect a CommonJS entry point (Hostinger Node.js apps, Passenger).
 * The application itself is ES modules under ./src; this shim simply loads it.
 */
import('./src/main.js').catch((err) => {
  console.error('ModaWard failed to start:', err);
  process.exit(1);
});
