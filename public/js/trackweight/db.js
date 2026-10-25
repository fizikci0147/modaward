/**
 * The diary lives on the person's own device (IndexedDB): entries, workouts, weigh-ins, saved foods
 * and settings. Nothing here is sent to the server. A tiny change feed lets screens re-read after
 * every write (and after a write made in another tab), so the UI never shows stale numbers.
 */
import { useState, useEffect, useRef } from '/js/ui.js';

const NAME = 'trackweight';
const STORES = ['entries', 'foods', 'workouts', 'weights', 'settings'];

let opening = null;
export function openDb() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('This browser does not allow saving data on your device.'));
    const req = indexedDB.open(NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const entries = db.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
      entries.createIndex('date', 'date');
      const foods = db.createObjectStore('foods', { keyPath: 'id', autoIncrement: true });
      foods.createIndex('name', 'name');
      db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true }).createIndex('date', 'date');
      db.createObjectStore('weights', { keyPath: 'date' });
      db.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Could not open the diary on this device. Private browsing or blocked site data can cause this.'));
    req.onblocked = () => reject(new Error('Close the other tabs that have Track Weight open and reload.'));
  });
  opening.catch(() => (opening = null));
  return opening;
}

const asPromise = (req) => new Promise((resolve, reject) => ((req.onsuccess = () => resolve(req.result)), (req.onerror = () => reject(req.error))));

async function run(store, mode, fn) {
  const db = await openDb();
  const tx = db.transaction(store, mode);
  const done = new Promise((resolve, reject) => ((tx.oncomplete = resolve), (tx.onerror = () => reject(tx.error)), (tx.onabort = () => reject(tx.error))));
  const result = await fn(tx.objectStore(store));
  await done;
  return result;
}

// ── change feed ──
const listeners = new Set();
const channel = 'BroadcastChannel' in globalThis ? new BroadcastChannel('trackweight') : null;
const emit = () => listeners.forEach((fn) => fn());
if (channel) channel.onmessage = emit;
const changed = () => (emit(), channel?.postMessage(1));
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

/** Re-run `read()` on mount, whenever `deps` change and after any write. Returns `initial` until the first read. */
export function useQuery(read, deps, initial) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState(null);
  const latest = useRef(read);
  latest.current = read;
  useEffect(() => {
    let live = true;
    const load = () =>
      latest.current().then(
        (v) => live && setValue(v),
        (e) => live && setError(e)
      );
    load();
    const off = onChange(load);
    return () => ((live = false), off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  if (error) throw error;
  return value;
}

// ── generic helpers ──
export const getAll = (store) => run(store, 'readonly', (s) => asPromise(s.getAll()));
export const getByDate = (store, date) => run(store, 'readonly', (s) => asPromise(s.index('date').getAll(date)));
export const getRange = (store, from, to) => run(store, 'readonly', (s) => asPromise(s.index('date').getAll(IDBKeyRange.bound(from, to))));
export const get = (store, key) => run(store, 'readonly', (s) => asPromise(s.get(key)));
export async function put(store, value) {
  const r = await run(store, 'readwrite', (s) => asPromise(s.put(value)));
  changed();
  return r;
}
export const add = put;
export async function remove(store, key) {
  await run(store, 'readwrite', (s) => asPromise(s.delete(key)));
  changed();
}
export async function clear(stores = STORES) {
  for (const s of stores) await run(s, 'readwrite', (st) => asPromise(st.clear()));
  changed();
}

// ── the diary ──
export const MEALS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' }
];

export const entriesFor = async (date) => (await getByDate('entries', date)).sort((a, b) => a.createdAt - b.createdAt);
export const workoutsFor = async (date) => (await getByDate('workouts', date)).sort((a, b) => a.createdAt - b.createdAt);
export const allWeights = async () => (await getAll('weights')).sort((a, b) => (a.date < b.date ? -1 : 1));
export const savedFoods = async () => (await getAll('foods')).sort((a, b) => b.lastUsed - a.lastUsed);

export async function getSetting(key, fallback = null) {
  const row = await get('settings', key);
  return row ? row.value : fallback;
}
export const setSetting = (key, value) => put('settings', { key, value });

/** Save or refresh a food in the person's own library, so it appears under "Recent". */
export async function rememberFood(f) {
  const foods = await getAll('foods');
  const existing = foods.find((x) => x.name === f.name && (x.brand || '') === (f.brand || ''));
  await put('foods', {
    ...(existing || {}),
    name: f.name,
    brand: f.brand,
    barcode: f.barcode,
    per100g: f.per100g,
    servingLabel: f.servingLabel,
    servingGrams: f.servingGrams,
    custom: Boolean(existing?.custom || f.custom),
    lastUsed: Date.now()
  });
}

export async function exportAll() {
  const [entries, foods, workouts, weights, settings] = await Promise.all(STORES.map(getAll));
  return { app: 'modaward-trackweight', version: 1, exportedAt: new Date().toISOString(), entries, foods, workouts, weights, settings };
}

export async function importAll(data) {
  if (data?.app !== 'modaward-trackweight' || !['entries', 'foods', 'workouts', 'weights', 'settings'].every((k) => Array.isArray(data[k]))) {
    throw new Error('That file is not a Track Weight backup.');
  }
  await clear();
  for (const store of STORES) for (const row of data[store]) await run(store, 'readwrite', (s) => asPromise(s.put(row)));
  changed();
}
