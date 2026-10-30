"use client";
import { useRef } from "react";

import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";

import { Button, useFocusTrap } from "@/components/ui";

import { ExpandedPiece } from "./expanded-piece";
import { ExpandedScheme } from "./expanded-scheme";
import { ExpandedDna } from "./expanded-dna";
export function CreationSuccess({ kind, id, edited, onDone: onDoneProp }: { kind: "scheme" | "piece" | "dna"; id: string; edited?: boolean; onDone?: () => void }) {
  const { t } = useI18n(); const { user } = useAuth(); const router = useRouter();
  // fechar leva ao meu perfil (RF5.CA/RF4): é lá que o look ou a peça recém-criados aparecem
  const onDone = onDoneProp ?? (() => router.push(user ? `/u/${user.username}` : "/lookbook"));
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog, true, onDone);
  const title = kind === "scheme" ? (edited ? t("expanded.sucesso_look_editado") : t("expanded.sucesso_look")) : kind === "dna" ? (edited ? t("expanded.sucesso_dna_editado") : t("expanded.sucesso_dna")) : (edited ? t("expanded.sucesso_peca_editada") : t("expanded.sucesso_peca"));
  return (
    <div className="dialog-backdrop">
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="dialog dialog-card">
        <div className="success-head">
          <p className="type-h2">{title}</p>
          <Button variant="primary" onClick={onDone}>{t("expanded.ir_para_o_perfil")}</Button>
        </div>
        {kind === "scheme" ? <ExpandedScheme id={id} /> : kind === "dna" ? <ExpandedDna id={id} /> : <ExpandedPiece id={id} />}
      </div>
    </div>
  );
}
