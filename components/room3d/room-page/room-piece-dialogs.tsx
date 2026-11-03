"use client";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog, Field, Input, Select } from "@/components/ui";
import type { useDetailModal } from "@/components/detail-modal";
import { CARE, ORIGIN, type Module, type PieceTag, type Room, type RoomPiece, type SetState } from "./room-page-model";

/** Diálogos das peças do quarto: o módulo com as peças (renomear, mover, levar ao espelho), mover, a etiqueta costurada e a gaveta vazia. */
export function RoomPieceDialogs({ data, act, bringToMirror, modal, open, setOpen, movePiece, setMovePiece, address, setAddress, tag, setTag, addTo, setAddTo, addPiece, setAddPiece }: {
  data: Room; act: (fn: () => Promise<unknown>, ok?: string) => Promise<void>; bringToMirror: (pieceId: string) => Promise<unknown>; modal: ReturnType<typeof useDetailModal>;
  open: Module | null; setOpen: SetState<Module | null>; movePiece: RoomPiece | null; setMovePiece: SetState<RoomPiece | null>; address: string; setAddress: SetState<string>;
  tag: PieceTag | null; setTag: SetState<PieceTag | null>; addTo: string | null; setAddTo: SetState<string | null>; addPiece: string; setAddPiece: SetState<string>;
}) {
  const { t, fmtPriceShort } = useI18n();
  const modulePieces = (m: Module) => (m.hangers ?? m.slots ?? []).map((h) => ({ ...h, piece: h.pieceId ? data.pieces[h.pieceId] : null }));
  const gridPieces = (m: Module) => { const fromSlots = modulePieces(m).filter((x) => x.piece); if (fromSlots.length) return fromSlots.map((x) => x.piece!); return Object.values(data.pieces).filter((p) => p.moduleId === m.id); };
  return (
    <>
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.label ?? ""}>
        {open && (<>
          <p className="type-caption text-muted mb-2">{t("room.capacidade_acabamento", { value: open.mold ?? open.sku, value2: open.widthCm ? t("room.cm", { widthCm: open.widthCm }) : "", value3: open.capacity ?? "—", value4: open.finish?.texture ?? "—" })}</p>
          {open.slotType === "DRAWER" && <div className="mb-3 flex gap-2"><Input aria-label={t("room.rotulo_da_gaveta")} defaultValue={data.drawerLabels[open.id.split(":")[1]] ?? ""} id="drawer-label" placeholder={t("room.rotulo_ex_jeans")} /><Button size="sm" onClick={() => act(() => api.put(`/api/me/room/drawers/${open.id.split(":")[1]}`, { label: (document.getElementById("drawer-label") as HTMLInputElement).value }), t("common.saved"))}>{t("room.renomear")}</Button></div>}
          <ul className="fai-list">{gridPieces(open).map((p) => <li key={p.id} className="flex items-center gap-3 py-2"><img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt="" className="h-12 w-12 rounded bg-surface-2 object-contain" /><div className="min-w-0 flex-1"><Link href={`/pieces/${p.id}`} className="type-body underline">{p.name}</Link><p className="type-caption text-muted">{t("room.usos", { value: p.addressLabel ?? p.address, value2: p.wearCount ?? 0, value3: p.states?.length ? ` · ${p.states.join(", ")}` : "" })}</p></div><Button size="sm" onClick={() => { setMovePiece(p); setAddress(p.address ?? ""); }}>{t("room.mover_2")}</Button><Button size="sm" onClick={() => { setOpen(null); void bringToMirror(p.id); }}>{t("room.levar_ao_espelho")}</Button></li>)}{gridPieces(open).length === 0 && <li className="py-3 type-body text-muted">{t("room.vazio")}</li>}</ul>
          {open.slotType === "SEASON" && <p className="mt-2 type-caption text-muted">{t("room.bau_de_estacao_pecas_fora")}</p>}
        </>)}
      </Dialog>
      <Dialog open={!!movePiece} onClose={() => setMovePiece(null)} title={t("room.mover", { value: movePiece?.name ?? "" })} footer={<Button variant="primary" onClick={() => act(() => api.put(`/api/pieces/${movePiece!.id}/room-address`, { address }), t("room.peca_movida")).then(() => setMovePiece(null))}>{t("room.mover_2")}</Button>}>
        <Field label={t("room.endereco")} id="addr" hint={t("room.door_1_hanger_3_drawer")}><Select id="addr" value={address} onChange={(e) => setAddress(e.target.value)}><option value="">—</option>{data.modules.flatMap((m) => (m.hangers ?? m.slots ?? []).length ? (m.hangers ?? m.slots ?? []).map((h) => <option key={h.address} value={h.address}>{m.label} · {h.address}{h.pieceId ? t("room.ocupado") : ""}</option>) : [<option key={m.id} value={m.id.includes(":") ? m.id : `${m.id}:1`}>{m.label}</option>])}</Select></Field>
        <Input aria-label={t("room.endereco_manual")} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("room.ou_digite_o_endereco")} />
      </Dialog>
      <Dialog open={!!tag} onClose={() => setTag(null)} title={t("room.etiqueta_costurada")} footer={tag ? <><Button onClick={() => { const id = tag.id; setTag(null); void bringToMirror(id); }}>{t("room.levar_ao_espelho")}</Button><Button variant="primary" onClick={() => { const id = tag.id; setTag(null); modal?.openPiece(id); }}>{t("room.ver_peca_completa")}</Button></> : undefined}>
        {tag && <div className="sewn-tag">
          <p className="sewn-tag-brand">{t("room.fai", { name: tag.name })}</p>
          <dl>
            <dt>{t("room.composicao")}</dt><dd>{tag.composition ?? "—"}</dd>
            <dt>{t("room.lavagem")}</dt><dd>{tag.care ?? CARE[tag.composition ?? ""] ?? t("room.siga_a_etiqueta_original")}</dd>
            <dt>{t("room.origem")}</dt><dd>{tag.origin ? ORIGIN[tag.origin] ?? tag.origin.toLowerCase() : "—"}{tag.garimpo && <span className="sewn-tag-seal">{t("common.garimpo")}</span>}</dd>
            <dt>{t("room.usos_2")}</dt><dd className="tabular">{tag.wearCount}{tag.thirtyWears && <span className="sewn-tag-dot" title={t("room.n30_usos")} />}{tag.costPerUse != null && <span className="text-muted">{t("room.r_por_uso_so_voce", { value: fmtPriceShort(Number(tag.costPerUse)) })}</span>}</dd>
            <dt>{t("room.no_quarto")}</dt><dd>{tag.location?.label ?? "—"}</dd>
          </dl>
          {tag.diary.length > 0 && <p className="type-caption text-muted mt-2">{t("room.ultimo_uso", { date: tag.diary[0].date, value: tag.diary[0].occasion !== "null" ? ` · ${tag.diary[0].occasion}` : "" })}</p>}
        </div>}
      </Dialog>
      <Dialog open={!!addTo} onClose={() => setAddTo(null)} title={t("room.adicionar_peca_a_esta_gaveta", { value: addTo ? ` (${addTo.replace("drawer:", t("room.gaveta_2"))})` : "" })}
        footer={<><Link className="btn" href="/pieces/new">{t("room.cadastrar_peca_nova")}</Link><Button variant="primary" disabled={!addPiece} onClick={() => act(() => api.put(`/api/pieces/${addPiece}/room-address`, { address: addTo }), t("room.peca_guardada_na_gaveta")).then(() => setAddTo(null))}>{t("room.guardar_aqui")}</Button></>}>
        <p className="type-body-sm mb-2">{t("room.gaveta_vazia_so_um_sache")}</p>
        <Select aria-label={t("common.peca_2")} value={addPiece} onChange={(e) => setAddPiece(e.target.value)}><option value="">—</option>{Object.values(data.pieces).filter((p) => p.moduleId !== addTo && ["lower_piece", "accessory_piece"].includes(p.category)).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.addressLabel ?? t("room.sem_lugar")}</option>)}</Select>
      </Dialog>
    </>
  );
}
