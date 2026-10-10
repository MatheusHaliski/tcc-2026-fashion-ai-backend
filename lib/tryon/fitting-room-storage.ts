/** Chaves existentes: a extração preserva sessões e provas já salvas no navegador. */
export const SESSION_KEY = "fai.tryon.fitting";
export const SAVED_KEY = "fai.tryon.saved";

export const read = <T,>(
  store: "session" | "local",
  key: string,
  fallback: T
): T => {
  try {
    const raw = (
      store === "session" ? sessionStorage : localStorage
    ).getItem(key);

    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const write = (
  store: "session" | "local",
  key: string,
  value: unknown
) => {
  try {
    (
      store === "session" ? sessionStorage : localStorage
    ).setItem(key, JSON.stringify(value));
  } catch {
    // Navegação privada: apenas não persiste.
  }
};
