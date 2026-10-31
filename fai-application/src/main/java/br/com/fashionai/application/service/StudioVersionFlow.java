package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.WardrobeItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Versões da foto de estúdio na peça (RF4): a foto aprovada nunca é trocada em silêncio por um processamento novo — o
 * resultado novo fica pendente em {@code flatLayMetadata.studio.pending} até a pessoa aprovar ou descartar. A política
 * dos metadados é a de {@link StudioVersionMetadata}; aqui ficam as transições na peça e a limpeza dos arquivos.
 */
final class StudioVersionFlow {
    private static final Logger log = LoggerFactory.getLogger(WardrobeService.class);
    private final MediaService media;

    StudioVersionFlow(MediaService media) {
        this.media = media;
    }

    /** Grava o resultado do estúdio na peça (foto, fundo, detalhe do logo) e o resumo nos metadados. */
    /** Coloca uma foto de estúdio no ar (nova versão; {@code approved} diz se a pessoa já aprovou). {@code null} tira o estúdio. */
    void applyStudio(WardrobeItem w, Map<String, Object> info, boolean approved) {
        Map<String, Object> meta = new LinkedHashMap<>(Json.map(w.getFlatLayMetadataJson()));
        Map<String, Object> cur = StudioVersionMetadata.copyFrom(meta);
        w.setStudioImageUrl(info == null ? null : String.valueOf(info.get("url")));
        w.setStudioBackdrop(info == null ? null : String.valueOf(info.get("backdrop")));
        w.setStudioDetailUrl(info == null || info.get("detailUrl") == null ? null : String.valueOf(info.get("detailUrl")));
        if (info == null) {
            meta.remove("studio");
        } else {
            Map<String, Object> summary = StudioVersionMetadata.summary(info, StudioVersionMetadata.version(cur, () -> w.getStudioImageUrl()) + 1, approved);
            if (cur != null && cur.get("url") != null) {
                summary.put("previous", StudioVersionMetadata.reference(cur));
            }
            meta.put("studio", summary);
        }
        w.setFlatLayMetadataJson(Json.write(meta));
    }

    /**
     * Resultado novo do estúdio. Com uma foto APROVADA no ar e a mesma foto de origem, ele fica pendente (a aprovada
     * continua no feed). Sem aprovada, ou quando a pessoa trocou a foto de origem (a aprovada é de outra imagem), ele
     * entra no ar marcado "aguardando aprovação". Devolve "pending", "applied" ou "failed".
     */
    String offerStudio(WardrobeItem w, Map<String, Object> info, boolean sourceChanged) {
        if (info == null) {
            if (sourceChanged) {
                applyStudio(w, null, false);                    // estúdio de outra imagem é pior que nenhum
            }
            return "failed";
        }
        Map<String, Object> meta = new LinkedHashMap<>(Json.map(w.getFlatLayMetadataJson()));
        Map<String, Object> cur = StudioVersionMetadata.copyFrom(meta);
        if (!sourceChanged && StudioVersionMetadata.approved(cur, w.getStudioImageUrl())) {
            if (cur == null) {                                  // legado: a aprovada ganha o resumo mínimo
                cur = new LinkedHashMap<>(Map.of("url", w.getStudioImageUrl(), "version", 1, "approved", true));
            }
            dropPendingMedia(cur);
            cur.put("pending", StudioVersionMetadata.summary(info, Math.max(StudioVersionMetadata.version(cur, () -> w.getStudioImageUrl()), StudioVersionMetadata.pendingVersion(cur)) + 1, false));
            meta.put("studio", cur);
            w.setFlatLayMetadataJson(Json.write(meta));
            return "pending";
        }
        applyStudio(w, info, false);
        return "applied";
    }

    /** Apaga os arquivos de uma versão pendente que não vai ao ar (melhor esforço: arquivo que sobrar não quebra nada). */
    private void dropPendingMedia(Map<String, Object> cur) {
        if (!(cur.get("pending") instanceof Map<?, ?> p)) {
            return;
        }
        for (String k : List.of("url", "thumbUrl", "feedUrl", "detailUrl", "enhancedUrl")) {
            if (p.get(k) != null) {
                try {
                    media.deleteUrl(String.valueOf(p.get(k)));
                } catch (RuntimeException e) {
                    log.debug("não apagou {}: {}", p.get(k), e.toString());
                }
            }
        }
    }

    /** Aprova a foto de estúdio: a pendente vai ao ar (a anterior fica no histórico) ou a atual é marcada como aprovada. */
    void approve(WardrobeItem w) {
        Map<String, Object> meta = new LinkedHashMap<>(Json.map(w.getFlatLayMetadataJson()));
        Map<String, Object> cur = StudioVersionMetadata.copyFrom(meta);
        String now = java.time.Instant.now().toString();
        if (cur != null && cur.get("pending") instanceof Map<?, ?> pm) {
            Map<String, Object> next = new LinkedHashMap<>();
            pm.forEach((k, v) -> next.put(String.valueOf(k), v));
            next.put("approved", true);
            next.put("approvedAt", now);
            if (w.getStudioImageUrl() != null) {
                Map<String, Object> prev = new LinkedHashMap<>(cur);
                prev.putIfAbsent("url", w.getStudioImageUrl());
                next.put("previous", StudioVersionMetadata.reference(prev));
            }
            w.setStudioImageUrl(String.valueOf(next.get("url")));
            w.setStudioBackdrop(next.get("backdrop") == null ? null : String.valueOf(next.get("backdrop")));
            w.setStudioDetailUrl(next.get("detailUrl") == null ? null : String.valueOf(next.get("detailUrl")));
            meta.put("studio", next);
        } else if (w.getStudioImageUrl() != null && cur != null && Boolean.FALSE.equals(cur.get("approved"))) {
            cur.put("approved", true);
            cur.put("approvedAt", now);
            meta.put("studio", cur);
        } else {
            throw ApiException.conflict("NADA_A_APROVAR", Msg.t("wardrobe.nenhuma_foto_de_estudio_aguardando"));
        }
        w.setFlatLayMetadataJson(Json.write(meta));
    }

    /** Descarta a versão pendente: a aprovada continua no ar e os arquivos da pendente são apagados. */
    void discard(WardrobeItem w) {
        Map<String, Object> meta = new LinkedHashMap<>(Json.map(w.getFlatLayMetadataJson()));
        Map<String, Object> cur = StudioVersionMetadata.copyFrom(meta);
        if (cur == null || !(cur.get("pending") instanceof Map<?, ?>)) {
            throw ApiException.conflict("NADA_A_DESCARTAR", Msg.t("wardrobe.nenhuma_foto_de_estudio_aguardando"));
        }
        dropPendingMedia(cur);
        cur.remove("pending");
        meta.put("studio", cur);
        w.setFlatLayMetadataJson(Json.write(meta));
    }
}
