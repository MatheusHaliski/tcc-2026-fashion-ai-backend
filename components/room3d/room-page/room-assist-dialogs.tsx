"use client";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog, Field, Input, Textarea } from "@/components/ui";
import { VistaMeCells } from "@/components/mirror/vista-me-cells";
import type { Look3dPiece } from "@/components/three/common";
import type { RoomData3D } from "@/components/room3d/room-scene";
import { RoomStore } from "@/components/room3d/room-store";
import { AvatarStill } from "./avatar-still";
import type { Api, CopilotState, Me3d, MirrorState, OrganizationPreview, Room, SetState, VistaState } from "./room-page-model";

/** Diálogos de ajuda do quarto: trocar um móvel, organização automática, Vista-me, Copilot e as chaves do quarto. */
export function RoomAssistDialogs({ data, reload, act, furnitureOpen, setFurnitureOpen, preview, setPreview, vista, setVista, runVistaMe, acceptLook, mirror, me3d, vistaLook,
  copilot, setCopilot, askCopilot, keysOpen, setKeysOpen, guest, setGuest }: {
  data: Room; reload: () => unknown; act: (fn: () => Promise<unknown>, ok?: string) => Promise<void>; furnitureOpen: boolean; setFurnitureOpen: SetState<boolean>;
  preview: OrganizationPreview | null; setPreview: SetState<OrganizationPreview | null>; vista: VistaState; setVista: SetState<VistaState>;
  runVistaMe: (kind: "vista-me" | "another", prompt?: string) => Promise<void>; acceptLook: () => Promise<void>; mirror: Api<MirrorState>; me3d: Me3d; vistaLook: Look3dPiece[];
  copilot: CopilotState; setCopilot: SetState<CopilotState>; askCopilot: () => Promise<void>; keysOpen: boolean; setKeysOpen: SetState<boolean>; guest: string; setGuest: SetState<string>;
}) {
  const { t } = useI18n();
  return (
    <>
      <Dialog open={furnitureOpen} onClose={() => setFurnitureOpen(false)} size="xl" title={t("room.settings.furniture.title")}>
        <RoomStore compact onChanged={() => reload()} />
      </Dialog>
      <Dialog open={!!preview} onClose={() => setPreview(null)} title={t("room.organizacao_automatica_rf32_ca08")} footer={<><Button onClick={() => setPreview(null)}>{t("common.cancel")}</Button><Button onClick={() => act(async () => setPreview(await api.get("/api/me/room/organization/preview?useAi=true")))}>{t("scheme.ai")}</Button><Button variant="primary" onClick={() => act(() => api.post("/api/me/room/organization", { labels: preview?.labels ?? {}, moves: preview?.moves ?? [] }), t("room.quarto_organizado")).then(() => setPreview(null))}>{t("dashboard.apply")}</Button></>}>
        {preview?.message && <p className="type-body mb-2">{preview.message}</p>}
        <ul className="fai-list max-h-64 overflow-auto type-body-sm">{(preview?.moves ?? []).map((m, i) => <li key={i}>• {data.pieces[m.pieceId]?.name ?? m.pieceId}: {m.from ?? "?"} → <b>{m.to}</b>{m.why ? ` · ${m.why}` : ""}</li>)}{(preview?.moves ?? []).length === 0 && <li>{t("room.nada_a_mover")}</li>}</ul>
        {preview?.labels && Object.keys(preview.labels).length > 0 && <p className="mt-2 type-caption text-muted">{t("room.rotulos")}{" "}{Object.entries(preview.labels).map(([k, v]) => `gaveta ${k} = ${v}`).join(", ")}</p>}
        <Button className="mt-3" size="sm" variant="ghost" onClick={() => act(() => api.delete("/api/me/room/organization"), t("room.ultima_organizacao_desfeita"))}>{t("room.desfazer_ultima_organizacao")}</Button>
      </Dialog>
      <Dialog open={vista.open} onClose={() => setVista((v) => ({ ...v, open: false }))} size="lg" title={t("common.vista_me")}
        footer={vista.result ? <><Button onClick={() => runVistaMe("another")} loading={vista.busy}>{t("room.outra_sugestao")}</Button><Button variant="primary" onClick={acceptLook} disabled={!vista.result.complete}>{t("room.usar_este_look")}</Button></> : undefined}>
        <p className="type-body-sm mb-2 text-muted">{t("room.o_vista_me_usa_so")}</p>
        <VistaMeCells busy={vista.busy} lastPrompt={mirror.data?.prompt} onRun={(prompt) => void runVistaMe("vista-me", prompt)} />
        {vista.result && <div className="mt-2 flex flex-wrap items-start gap-4">
          {!me3d.loading && <figure className="vista-still shrink-0" aria-label={t("room.previa_do_look")}>
            <AvatarStill avatar={me3d.avatar} sex={me3d.sex} body={me3d.body} pieces={vistaLook} background="#EEEAE2" alt={t("mirror.previa_2d_alt", { n: vistaLook.length })} />
          </figure>}
          <div className="min-w-0 flex-1 basis-56">
            {vista.result.message && <p className="type-body-sm">{vista.result.message}</p>}
            <ul className="fai-list mt-2">{(vista.result.sequence ?? []).map((x) => <li key={x.pieceId} className="flex items-center gap-2 type-body-sm"><span className="inline-block h-2 w-2 rounded-full bg-mark" />{x.legend}</li>)}</ul>
            {vista.result.postIt && <p className="mt-2 rounded bg-chalk-soft p-2 type-caption">📝 {vista.result.postIt}</p>}
          </div>
        </div>}
      </Dialog>
      <Dialog open={copilot.open} onClose={() => setCopilot((c) => ({ ...c, open: false, point: null }))} title={t("room.busto_de_costura_copilot")}
        footer={<Button variant="primary" loading={copilot.busy} disabled={!copilot.q.trim()} onClick={askCopilot}>{t("room.perguntar")}</Button>}>
        <Field label={t("room.pergunte_ao_copilot")} id="cp-q"><Textarea id="cp-q" rows={2} value={copilot.q} placeholder={t("room.onde_esta_meu_blazer_azul")} onChange={(e) => setCopilot((c) => ({ ...c, q: e.target.value }))} /></Field>
        {copilot.text && <p className="type-body-sm whitespace-pre-line">{copilot.text}</p>}
        {copilot.point && <p className="type-caption text-muted mt-1">{t("room.o_busto_esta_apontando_para", { replace: copilot.point.replace("door:", t("room.porta")).replace("drawer:", t("room.gaveta_2")) })}</p>}
      </Dialog>
      <Dialog open={keysOpen} onClose={() => setKeysOpen(false)} title={t("room.gancho_da_chave_do_quarto")}
        footer={<Button variant="primary" disabled={!guest.trim()} onClick={() => act(async () => { const prof = await api.get<{ user?: { id: string }; id?: string }>(`/api/profiles/${encodeURIComponent(guest.replace(/^@/, ""))}`); await api.post("/api/me/room/keys", { guestId: prof.user?.id ?? prof.id }); setGuest(""); }, t("room.chave_entregue"))}>{t("room.dar_a_chave")}</Button>}>
        <p className="type-body-sm mb-2">{t("room.quem_tem_a_chave_pode")}</p>
        <ul className="mb-3 flex flex-wrap gap-1">{((data as unknown as RoomData3D).keys ?? []).map((k) => <li key={k.id} className="chip">🔑 @{k.username}</li>)}{((data as unknown as RoomData3D).keys ?? []).length === 0 && <li className="type-caption text-muted">{t("room.nenhuma_chave_entregue_ainda")}</li>}</ul>
        <Field label={t("room.entregar_a_chave_para_usuario")} id="key-guest"><Input id="key-guest" value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="@paris_lea" /></Field>
      </Dialog>
    </>
  );
}
