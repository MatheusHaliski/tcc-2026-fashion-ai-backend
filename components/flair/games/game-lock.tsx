"use client";
import { useI18n } from "@/lib/i18n/i18n";
import type { GameAccess } from "@/lib/flair/games";
import { FaiIcon } from "@/components/fai-icon";
import { LockLinks, LockReasons } from "@/components/flair/games/game-card";

/**
 * Painel de bloqueio da tela do jogo (role="status"): os motivos (nível de XP e/ou guarda-roupa, com o nível atual
 * quando o servidor informou) e os links para destravar. Aparece quando `access.allowed` é false no detalhe e também
 * quando check/submit respondem 403 FAI_LEVEL_REQUIRED / WARDROBE_LEVEL_REQUIRED (fail closed: o cliente não decide).
 */
export function GameLock({ access }: { access: Partial<GameAccess> | null | undefined }) {
  const { t } = useI18n();
  return (
    <div className="ge-lock-panel" role="status" data-testid="game-lock">
      <p className="type-h3 flex items-center gap-2"><FaiIcon id="ACT-41" size={24} decorative />{t("games.lock.title")}</p>
      <LockReasons access={access} />
      <LockLinks access={access} className="ge-lock-actions" />
      <p className="type-caption text-muted">{t("games.lock.hint")}</p>
    </div>
  );
}
