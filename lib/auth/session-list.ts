import { looksLikeUserAgent, parseSessionDevice } from "./session-device";

/** Sessão como `GET /api/auth/sessions` devolve: `device` vem cortado; `userAgent` traz o texto inteiro. */
export interface SessionRow {
  sessionId: string;
  device?: string;
  userAgent?: string;
  ip?: string;
  createdAt?: string;
  lastUsedAt?: string;
  current?: boolean;
}

/** Como a sessão é descrita: navegador e sistema, só um deles, um nome pronto do servidor ou nada reconhecido. */
export type SessionLabel =
  | { kind: "both"; browser: string; system: string }
  | { kind: "system"; system: string }
  | { kind: "browser"; browser: string }
  | { kind: "named"; name: string }
  | { kind: "unknown" };

/**
 * O nome curto lia só `device`, que o servidor corta em 60 caracteres: o "Chrome/…" ficava de fora e a tela mostrava só
 * "Linux". Agora o texto inteiro (`userAgent`) vem primeiro.
 */
export function sessionLabel(s: SessionRow): SessionLabel {
  const raw = s.userAgent && looksLikeUserAgent(s.userAgent) ? s.userAgent : s.device;
  if (!raw) return { kind: "unknown" };
  if (!looksLikeUserAgent(raw)) return { kind: "named", name: raw };
  const { browser, system } = parseSessionDevice(raw);
  if (browser && system) return { kind: "both", browser, system };
  if (system) return { kind: "system", system };
  if (browser) return { kind: "browser", browser };
  return { kind: "unknown" };
}

const time = (s: SessionRow) => Date.parse(s.lastUsedAt ?? s.createdAt ?? "") || 0;

/** "Esta sessão" no topo; depois da mais recente para a mais antiga. */
export function sortSessions(rows: SessionRow[]): SessionRow[] {
  return [...rows].sort((a, b) => Number(!!b.current) - Number(!!a.current) || time(b) - time(a));
}
