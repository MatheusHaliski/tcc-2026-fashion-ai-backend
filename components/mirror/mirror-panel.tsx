"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Badge, Button, Dialog, Skeleton, cn, useToast } from "@/components/ui";
import { MirrorStage, type MirrorPiece } from "@/components/mirror/mirror-stage";
import { loadTexture } from "@/components/three/common";
import { label as label_ } from "@/lib/api/taxonomy";
import { MIRROR_GROUPS, groupRack, latestWins, mirrorLook3d, rackState, type MirrorGroup, type MirrorRackPiece } from "@/lib/mirror/mirror-list";

/*
 * Espelho do quarto (QUARTO-ESPELHO): o avatar 3D da pessoa (o MESMO pipeline do provador: HumanOutfit, molde por
 * subcategoria, classe de caimento, foto recortada → processada) e a lista das peças trazidas para provar, nos quatro
 * lugares. Fonte única da verdade: o estado do espelho no servidor; esta tela só pede e mostra.
 *
 *  - vestir: a peça anterior fica até a nova estar pronta (a foto é pré-carregada e o servidor responde); se falhar,
 *    nada muda; trocas rápidas: só a última conclui (latestWins);
 *  - tirar: sai do corpo, continua na lista; remover da lista: sai da lista e do corpo, nunca do guarda-roupa;
 *  - nada aqui cria ou salva look (sem "Salvar como look"): o look vestido é só o estado do espelho.
 */
export interface MirrorPanelState {
  slots: Record<string, MirrorPiece | MirrorPiece[] | null>;
  rack?: MirrorRackPiece[];
  light?: { kelvin?: number } | null;
}

const STATE_TONE = { APROVADA: "thread", ESTIMADA: "chalk", PROCESSANDO: undefined, SEM_3D: undefined, ERRO: "mark" } as const;

export function MirrorPanel({ state, onState, arrivedId, held }: {
  state: MirrorPanelState | null; onState: (s: MirrorPanelState) => void;
  /** peça que acabou de chegar à lista (destaque) */
  arrivedId?: string | null;
  /** nome da peça que o avatar do quarto está segurando (ainda não chegou à lista) */
  held?: string | null;
}) {
  const { t } = useI18n(); const toast = useToast();
  const [dressing, setDressing] = useState<string | null>(null);
  const [dressedKey, setDressedKey] = useState(0);
  const [picker, setPicker] = useState<{ group: MirrorGroup; pieces: MirrorRackPiece[] } | null>(null);
  const live = useRef(onState); live.current = onState;
  const rack = useMemo(() => state?.rack ?? [], [state?.rack]);
  const groups = useMemo(() => groupRack(rack), [rack]);

  // vestir com a última escolha vencendo; a anterior fica até a nova foto carregar e o servidor confirmar
  const wear = useMemo(() => latestWins<MirrorRackPiece>(async (p) => {
    setDressing(p.id);
    try {
      const l = mirrorLook3d(p);
      for (const u of [l.imageUrl, l.studioUrl]) { const m = mediaUrl(u ?? null); if (m && await loadTexture(m)) break; }
      const r = await api.post<MirrorPanelState>("/api/me/mirror/pieces", { pieceId: p.id });
      live.current(r); setDressedKey((k) => k + 1);
    } catch (e) { toast.fromError(e); } finally { setDressing(null); }
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(fn: () => Promise<MirrorPanelState>) { try { onState(await fn()); } catch (e) { toast.fromError(e); } }
  async function openPicker(group: MirrorGroup) {
    const slot = group === "cima" ? "upper" : group === "baixo" ? "lower" : group === "calcado" ? "shoes" : "accessory";
    try { const r = await api.get<{ pieces: MirrorRackPiece[] }>(`/api/me/mirror/wardrobe?slot=${slot}`); setPicker({ group, pieces: r.pieces ?? [] }); } catch (e) { toast.fromError(e); }
  }

  // animação curta de "vestiu" só depois do sucesso (e nunca com movimento reduzido: o CSS respeita a preferência)
  const [flash, setFlash] = useState(false);
  useEffect(() => { if (!dressedKey) return; setFlash(true); const id = setTimeout(() => setFlash(false), 700); return () => clearTimeout(id); }, [dressedKey]);

  const label: Record<MirrorGroup, string> = { cima: t("room.mirror.cima"), baixo: t("room.mirror.baixo"), calcado: t("room.mirror.calcado"), acessorio: t("room.mirror.acessorio") };
  return (
    <section className="mirror-panel" aria-label={t("room.mirror.titulo")}>
      <div className={cn("mirror-panel-stage", flash && "is-dressed")}>
        {state ? <MirrorStage slots={state.slots} kelvin={state.light?.kelvin} mode="3d" /> : <Skeleton className="h-full w-full" />}
        {dressing && <p className="mirror-panel-status" role="status">{t("room.mirror.vestindo", { name: rack.find((p) => p.id === dressing)?.name ?? "" })}</p>}
      </div>
      {held && <p className="type-caption" role="status"><Badge tone="chalk">{t("room.mirror.segurando")}</Badge> {held}</p>}
      <div className="grid gap-3" data-testid="mirror-rack">
        {MIRROR_GROUPS.map((g) => (
          <div key={g} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2"><h3 className="type-label text-muted">{label[g]}</h3>
              <Button size="sm" variant="ghost" onClick={() => openPicker(g)}>{t("room.mirror.adicionar")}</Button></div>
            {groups[g].length === 0 ? <p className="type-caption text-faint">{t("room.mirror.vazio")}</p> : (
              <ul className="grid gap-1.5">
                {groups[g].map((p) => {
                  const st = rackState(p);
                  return (
                    <li key={p.id} className={cn("mirror-rack-item", p.worn && "is-worn", arrivedId === p.id && "is-arrived")} aria-current={p.worn || undefined}>
                      <img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl ?? null) ?? undefined} alt="" className="h-12 w-12 rounded object-contain bg-surface-2" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate type-body-sm font-medium">{p.name}</p>
                        <p className="flex flex-wrap items-center gap-1.5 type-caption text-muted">
                          <span>{p.subcategory ? label_(p.subcategory) : label[g]}</span>
                          <Badge tone={STATE_TONE[st]}>{t(st === "SEM_3D" ? "room.mirror.so_2d" : st === "ERRO" ? "room.mirror.falha" : st === "PROCESSANDO" ? "room.mirror.processando" : "room.mirror.em_3d")}</Badge>
                          {p.worn && <Badge tone="thread">{t("room.mirror.vestida")}</Badge>}
                          {!p.worn && <span>{t("room.mirror.para_provar")}</span>}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {p.worn
                          ? <Button size="sm" onClick={() => act(() => api.delete<MirrorPanelState>(`/api/me/mirror/pieces/${p.id}`))}>{t("room.mirror.tirar")}</Button>
                          : <Button size="sm" variant="primary" loading={dressing === p.id} onClick={() => wear.request(p)}>{t("room.mirror.vestir")}</Button>}
                        <Button size="sm" variant="ghost" aria-label={t("room.mirror.remover_da_lista", { name: p.name })} onClick={() => act(() => api.delete<MirrorPanelState>(`/api/me/mirror/rack/${p.id}`))}>{t("room.mirror.remover")}</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
      <p className="type-caption text-muted">{t("room.mirror.nota")}</p>
      <Dialog open={!!picker} onClose={() => setPicker(null)} title={t("room.mirror.adicionar_de", { lugar: picker ? label[picker.group] : "" })}>
        <div className="grid grid-cols-3 gap-2">{(picker?.pieces ?? []).map((p) => {
          const inList = rack.some((r) => r.id === p.id);
          return (
            <button key={p.id} type="button" className="surface p-2 text-left hover:bg-surface-2 disabled:opacity-60" disabled={inList} aria-pressed={inList}
              onClick={() => { setPicker(null); act(() => api.post<MirrorPanelState>("/api/me/mirror/rack", { pieceId: p.id })); }}>
              <img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl ?? null) ?? undefined} alt="" className="aspect-square w-full object-contain" />
              <span className="block truncate type-caption">{p.name}</span>
              {inList && <span className="block type-caption text-muted">{t("room.mirror.ja_na_lista")}</span>}
            </button>
          );
        })}</div>
      </Dialog>
    </section>
  );
}
