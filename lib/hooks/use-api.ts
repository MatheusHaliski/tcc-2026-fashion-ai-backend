"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";

/** Carregamento declarativo: {data, loading, error, reload, setData}. Ignora respostas de requisições canceladas. */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: unknown[] = [], options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);
  const ref = useRef(fetcher);
  ref.current = fetcher;
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true); setError(null);
    ref.current(ctrl.signal)
      .then((d) => { if (!ctrl.signal.aborted) setData(d); })
      .catch((e) => { if (ctrl.signal.aborted || (e as Error).name === "AbortError") return; setError(e instanceof ApiError ? e : new ApiError(0, "ERRO", (e as Error).message)); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick, ...deps]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload, setData };
}

/** Ação assíncrona (submit) com estado de envio e erro tipado. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setBusy(true); setError(null);
    try { return await fn(...args); }
    catch (e) { setError(e instanceof ApiError ? e : new ApiError(0, "ERRO", (e as Error).message)); return undefined; }
    finally { setBusy(false); }
  }, [fn]);
  return { run, busy, error, setError };
}
