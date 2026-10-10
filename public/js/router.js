import { html, useState, useEffect, useCallback } from '/js/ui.js';

/** Minimal History-API router. Routes are plain paths; the server falls back to index.html. */
const subs = new Set();
const current = () => location.pathname.replace(/\/+$/, '') || '/';

export function navigate(to, { replace = false } = {}) {
  if (to === current() + location.search) return;
  history[replace ? 'replaceState' : 'pushState']({}, '', to);
  subs.forEach((fn) => fn());
  window.scrollTo({ top: 0 });
}

addEventListener('popstate', () => subs.forEach((fn) => fn()));

export function usePath() {
  const [path, setPath] = useState(current());
  useEffect(() => {
    const fn = () => setPath(current());
    subs.add(fn);
    return () => subs.delete(fn);
  }, []);
  return path;
}

/** The query string, kept current as the person navigates (so a link to ?section=… on the same page works). */
export function useSearch() {
  const [search, setSearch] = useState(location.search);
  useEffect(() => {
    const fn = () => setSearch(location.search);
    subs.add(fn);
    return () => subs.delete(fn);
  }, []);
  return search;
}

export const useQuery = () => new URLSearchParams(location.search);

export function Link({ href, children, class: cls, onClick, ...rest }) {
  const go = useCallback(
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onClick?.(e);
      navigate(href);
    },
    [href, onClick]
  );
  return html`<a href=${href} class=${cls} onClick=${go} ...${rest}>${children}</a>`;
}
