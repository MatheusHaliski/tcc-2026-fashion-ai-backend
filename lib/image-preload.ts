/** Central image preloader: URL cache, bounded concurrency, full decode, retry with short backoff and ordered fallbacks. */
export const IMAGE_CONCURRENCY = 6;
export const IMAGE_RETRIES = 2;
export const IMAGE_BACKOFF_MS = 150;

const loaded = new Set<string>();
const pending = new Map<string, Promise<boolean>>();
const queue: (() => void)[] = [];
let active = 0;

function pump() {
  while (active < IMAGE_CONCURRENCY && queue.length) queue.shift()!();
}

function fetchOnce(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    queue.push(() => {
      active++;
      const done = (ok: boolean) => { active--; resolve(ok); pump(); };
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      if (typeof image.decode === "function") image.decode().then(() => done(true), () => done(false));
      else { image.onload = () => done(true); image.onerror = () => done(false); }
    });
    pump();
  });
}

async function fetchWithRetry(url: string): Promise<boolean> {
  for (let attempt = 0; attempt <= IMAGE_RETRIES; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, IMAGE_BACKOFF_MS * attempt));
    if (await fetchOnce(url)) return true;
  }
  return false;
}

/** Resolves true once the URL is fully decoded; the same URL is never fetched twice (in flight or loaded). */
export function preloadImage(url: string): Promise<boolean> {
  if (loaded.has(url)) return Promise.resolve(true);
  let promise = pending.get(url);
  if (!promise) {
    promise = fetchWithRetry(url).then((ok) => {
      pending.delete(url);
      if (ok) loaded.add(url);
      return ok;
    });
    pending.set(url, promise);
  }
  return promise;
}

export const isImageLoaded = (url: string | null | undefined) => !!url && loaded.has(url);

/** Tries each source in order (thumbnail, original, ...) and resolves the first that loads, or null. */
export async function preloadFirst(urls: readonly string[]): Promise<string | null> {
  for (const url of urls) if (await preloadImage(url)) return url;
  return null;
}

export function clearImageCache() {
  loaded.clear();
  pending.clear();
}
