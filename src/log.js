/** Minimal structured logger: one JSON object per line, easy to grep on any host. */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger({ level = 'info', sink = (line) => process.stdout.write(line + '\n') } = {}) {
  const min = LEVELS[level] ?? 20;
  const emit = (name) => (event, fields = {}) => {
    if (LEVELS[name] < min) return;
    sink(JSON.stringify({ t: new Date().toISOString(), level: name, event, ...fields }));
  };
  return { debug: emit('debug'), info: emit('info'), warn: emit('warn'), error: emit('error') };
}
