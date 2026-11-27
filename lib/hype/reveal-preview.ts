/**
 * Editor "Arte do card": o painel de Hype fica abaixo da foto, fora da área visível da prévia em telas de 900 px de
 * altura. Depois de escolher um estilo de AURA Hype, a prévia rola até o painel para a pessoa ver o que está editando.
 */
const PANEL = ".pae-preview .fashion-hype-metadata, .pae-preview .fashion-hype-matrix, .pae-preview .hype-global-only";

export function revealHypePreview(root: ParentNode = document): boolean {
  const panel = root.querySelector<HTMLElement>(PANEL);
  if (!panel || typeof panel.scrollIntoView !== "function") return false;
  panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  return true;
}

/** O painel só existe depois de a prévia redesenhar com o estilo novo: espera um instante antes de rolar. */
export function revealHypePreviewSoon(delayMs = 250): void {
  if (typeof window === "undefined") return;
  window.setTimeout(() => revealHypePreview(), delayMs);
}
