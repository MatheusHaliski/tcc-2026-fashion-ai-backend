/**
 * Anúncio discreto da mudança de Hype para leitores de tela: UMA região viva global (role=status, polite) com throttle
 * de 10 s — uma grade com vários cards mudando não vira uma enxurrada de falas. A seta ▲/▼ e a cor ficam no card.
 */
export const HYPE_ANNOUNCE_THROTTLE_MS = 10_000;
const REGION_ID = "fai-hype-live-region";
let lastAt = Number.NEGATIVE_INFINITY;

function region(): HTMLElement | null {
  if (typeof document === "undefined" || !document.body) return null;
  let node = document.getElementById(REGION_ID);
  if (!node) {
    node = document.createElement("div");
    node.id = REGION_ID;
    node.className = "sr-only";
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.setAttribute("aria-atomic", "true");
    document.body.appendChild(node);
  }
  return node;
}

/** Anuncia o texto se o último anúncio tiver mais de 10 s; devolve se anunciou. */
export function announceHype(text: string, now = Date.now()): boolean {
  if (!text || now - lastAt < HYPE_ANNOUNCE_THROTTLE_MS) return false;
  const node = region();
  if (!node) return false;
  lastAt = now;
  node.textContent = text;
  return true;
}

/** Só para testes. */
export function __resetHypeAnnouncer() {
  lastAt = Number.NEGATIVE_INFINITY;
  if (typeof document !== "undefined") document.getElementById(REGION_ID)?.remove();
}
