"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog } from "@/components/ui";

/** "Voltar ao projeto": com alterações não salvas, pergunta antes de sair (o aviso do navegador só cobre fechar a aba). */
export function EditorBackLink({ projectId, dirty }: { projectId: string; dirty: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const href = `/atelier/projects/${projectId}`;
  return (
    <>
      <Link
        className="btn"
        href={href}
        onClick={(event) => {
          if (!dirty) return;
          event.preventDefault();
          setAsking(true);
        }}
      >
        {t("atelier3d.back")}
      </Link>
      <Dialog
        open={asking}
        title={t("atelier3d.leave.title")}
        onClose={() => setAsking(false)}
        footer={
          <>
            <Button variant="primary" onClick={() => setAsking(false)}>
              {t("atelier3d.leave.stay")}
            </Button>
            <Button onClick={() => router.push(href)}>{t("atelier3d.leave.go")}</Button>
          </>
        }
      >
        <p>{t("atelier3d.leave.body")}</p>
      </Dialog>
    </>
  );
}
