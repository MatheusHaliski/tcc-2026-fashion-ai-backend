"use client";
/**
 * Campo "adversário" sem tag digitada: mostra a pessoa escolhida (ou as pessoas, com `multiplo`) e abre a busca na
 * rede FAI para escolher. Usado no duelo 1×1 do FLAIR 2D e nos convidados dos desafios.
 */
import { useState } from "react";
import { Avatar, Button, Chip, Dialog } from "@/components/ui";
import { BuscarAdversario } from "@/components/flair/multi/buscar-adversario";
import type { Adversario } from "@/lib/flair/multi/types";
import { useI18n } from "@/lib/i18n/i18n";

interface Props {
  label: string;
  escolhidas: Adversario[];
  onChange: (pessoas: Adversario[]) => void;
  /** várias pessoas (desafios); senão a nova escolha troca a anterior */
  multiplo?: boolean;
}

export function EscolherAdversario({ label, escolhidas, onChange, multiplo = false }: Props) {
  const { t } = useI18n();
  const [aberto, setAberto] = useState(false);
  function escolher(a: Adversario) {
    onChange(multiplo ? [...escolhidas.filter((x) => x.id !== a.id), a] : [a]);
    if (!multiplo) setAberto(false);
  }
  return (
    <div className="fm-escolher" data-testid="fm-escolher">
      <p className="label">{label}</p>
      <div className="fm-escolhidas">
        {escolhidas.map((a) => (
          <span key={a.id} className="fm-escolhida">
            <Avatar src={a.avatarUrl} name={a.nome ?? a.username} size={28} />@{a.username}
            <Chip onClick={() => onChange(escolhidas.filter((x) => x.id !== a.id))} title={t("flair3d.multi.remover", { username: a.username })}>×</Chip>
          </span>
        ))}
        <Button size="sm" onClick={() => setAberto(true)} data-testid="fm-abrir-busca">
          {escolhidas.length && !multiplo ? t("flair3d.multi.trocarPessoa") : t("flair3d.multi.buscarNaRede")}
        </Button>
      </div>
      {aberto && (
        <Dialog open onClose={() => setAberto(false)} size="lg" title={t("flair3d.multi.buscarNaRede")}
          footer={multiplo ? <Button variant="primary" onClick={() => setAberto(false)}>{t("flair3d.multi.pronto")}</Button> : undefined}>
          <BuscarAdversario selecionados={escolhidas.map((a) => a.id)} rotuloAcao={t("flair3d.multi.escolher")} onEscolher={escolher} />
        </Dialog>
      )}
    </div>
  );
}
