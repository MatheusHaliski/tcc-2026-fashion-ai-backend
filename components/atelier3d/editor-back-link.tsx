"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog } from "@/components/ui";
import { orderHref } from "@/components/garment-delivery/factory-order-card";

/**
 * Saídas do editor ("Voltar ao projeto" e "Encomendar à Fábrica FashionAI"): com alterações não salvas, pergunta antes
 * de sair (o aviso do navegador só cobre fechar a aba). O checkout confere se a ficha da revisão está completa.
 */
export function EditorBackLink({ projectId, dirty }: { projectId: string; dirty: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const back = `/atelier/projects/${projectId}`;
  const exits = [
    { href: back, label: t("atelier3d.back"), className: "btn" },
    { href: orderHref(projectId), label: t("garmentDelivery.cta.order"), className: "btn btn-ghost" },
  ];
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {exits.map((exit) => (
          <Link
            key={exit.href}
            className={exit.className}
            href={exit.href}
            onClick={(event) => {
              if (!dirty) return;
              event.preventDefault();
              setLeavingTo(exit.href);
            }}
          >
            {exit.label}
          </Link>
        ))}
      </div>
      <Dialog
        open={leavingTo !== null}
        title={t("atelier3d.leave.title")}
        onClose={() => setLeavingTo(null)}
        footer={
          <>
            <Button variant="primary" onClick={() => setLeavingTo(null)}>
              {t("atelier3d.leave.stay")}
            </Button>
            <Button onClick={() => router.push(leavingTo ?? back)}>{t("atelier3d.leave.go")}</Button>
          </>
        }
      >
        <p>{t("atelier3d.leave.body")}</p>
      </Dialog>
    </>
  );
}
