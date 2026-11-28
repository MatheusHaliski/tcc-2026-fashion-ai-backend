"use client";
/**
 * "Jogar contra alguém": escolhe o jogo (quando não vem fixo), o modo da sala (por turnos nos jogos de confronto, mesma
 * semente em todos) e a pessoa pela busca na rede FAI. O convite sai na hora e a tela vai para a sala.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chip, Dialog, Field, Select, useToast } from "@/components/ui";
import { BuscarAdversario } from "@/components/flair/multi/buscar-adversario";
import { useNomeDoJogo } from "@/components/flair/multi/use-nome-do-jogo";
import { convidar } from "@/lib/flair/multi/api";
import { JOGOS_DA_SALA, modosDoJogo, rotaDaSala } from "@/lib/flair/multi/filtros";
import type { Adversario, ModoSala } from "@/lib/flair/multi/types";
import { useI18n } from "@/lib/i18n/i18n";

interface Props {
  /** o jogo já escolhido (na tela do jogo); sem ele, a pessoa escolhe */
  jogo?: string | null;
  rodada?: string | null;
  onClose: () => void;
}

export function ConvidarDialog({ jogo: fixo = null, rodada = null, onClose }: Props) {
  const { t } = useI18n();
  const nome = useNomeDoJogo();
  const router = useRouter();
  const toast = useToast();
  const [jogo, setJogo] = useState(fixo ?? "BATALHA_LOOKS");
  const modos = modosDoJogo(jogo);
  const [modo, setModo] = useState<ModoSala>(modos[0]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const modoValido = modos.includes(modo) ? modo : modos[0];
  async function escolher(a: Adversario) {
    setOcupado(a.id);
    try {
      const sala = await convidar({ para: a.id, jogo, modo: modoValido, rodada: modoValido === "ASSINCRONO" ? rodada : null });
      toast.success(t("flair3d.multi.conviteEnviado", { username: a.username }));
      router.push(rotaDaSala(sala.id));
    } catch (e) {
      toast.fromError(e);
    } finally {
      setOcupado(null);
    }
  }
  return (
    <Dialog open onClose={onClose} size="lg" title={t("flair3d.multi.jogarContraAlguem")}>
      <div className="fm-convidar">
        {!fixo && (
          <Field label={t("flair3d.multi.jogo")} id="fm-jogo">
            <Select id="fm-jogo" value={jogo} onChange={(e) => setJogo(e.target.value)} data-testid="fm-jogo">
              {JOGOS_DA_SALA.map((j) => <option key={j} value={j}>{nome(j)}</option>)}
            </Select>
          </Field>
        )}
        <p className="label">{t("flair3d.multi.modoDaSala")}</p>
        <div className="fm-busca-chips" role="group" aria-label={t("flair3d.multi.modoDaSala")}>
          {modos.map((m) => <Chip key={m} active={modoValido === m} onClick={() => setModo(m)}>{t(`flair3d.multi.modo.${m}`)}</Chip>)}
        </div>
        <p className="type-caption text-muted">{t(`flair3d.multi.modo.ajuda.${modoValido}`)}</p>
        <BuscarAdversario key={jogo} jogo={jogo} ocupado={ocupado} onEscolher={(a) => void escolher(a)} />
      </div>
    </Dialog>
  );
}
