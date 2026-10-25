/** The few server calls the tracker makes. The diary itself never leaves the device. */
async function call(method, url, body, signal) {
  let res;
  try {
    res = await fetch(`/api/trackweight${url}`, {
      method,
      credentials: 'same-origin',
      signal,
      headers: { 'X-Requested-With': 'modaward', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw Object.assign(new Error('You appear to be offline. Your diary still works; searching online and photos need a connection.'), { code: 'offline' });
  }
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json().catch(() => null) : null;
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || 'Something went wrong. Please try again.'), { status: res.status, code: data?.error?.code });
  if (data === null) throw new Error('Something went wrong. Please try again.');
  return data;
}

/** { signedIn, usda, photo: 'on' | 'signin' | 'pro' | 'off' } */
export const status = () => call('GET', '/status');
export const searchFoods = (q, signal) => call('GET', `/foods/search?q=${encodeURIComponent(q)}`, undefined, signal).then((r) => r.foods);
export const lookupBarcode = (code) => call('GET', `/foods/barcode/${encodeURIComponent(code)}`).then((r) => r.food);
/** @returns {Promise<{items: object[], notes: string}>} */
export const analyzeMeal = (imageDataUrl, hint) => call('POST', '/analyze-meal', { image: imageDataUrl, hint: hint || undefined });
