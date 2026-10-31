package br.com.fashionai.application.service;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.awt.image.BufferedImage;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Orquestra a foto de estúdio (RF4) para o rascunho, para uma peça, para o closet inteiro e quando a imagem da peça
 * muda, combinando {@link StudioShots} (geração e arquivos), {@link StudioVersionFlow} (versões e aprovação) e
 * {@link DefaultStudio} (imagem padrão). Autorização, posse e transação ficam no {@link WardrobeService}.
 */
final class WardrobeStudio {
    private final WardrobeItemRepository pieces;
    private final AssetCatalogService assets;
    private final MediaService media;
    private final StudioShots shots;
    private final StudioVersionFlow versions;

    WardrobeStudio(WardrobeItemRepository pieces, AssetCatalogService assets, MediaService media, StudioShots shots,
                   StudioVersionFlow versions) {
        this.pieces = pieces;
        this.assets = assets;
        this.media = media;
        this.shots = shots;
        this.versions = versions;
    }

    /**
     * Refaz a foto de estúdio quando a imagem da peça muda (mesmo fundo de antes). {@code createIfMissing}: peça que não
     * tinha estúdio passa a ter. {@code sameSource}: a foto de origem é a mesma (logo e cortes continuam valendo); numa
     * imagem editada eles são recalculados. Se o estúdio falhar numa imagem nova, a foto antiga sai — estúdio de outra
     * imagem é pior que nenhum. Veja {@link StudioVersionFlow#offerStudio}: um reprocessamento da mesma foto nunca troca a
     * aprovada sozinho.
     */
    void refresh(WardrobeItem w, BufferedImage cutout, boolean createIfMissing, boolean sameSource) {
        if (w.getStudioImageUrl() == null && !createIfMissing) {
            return;
        }
        var hints = sameSource ? PieceStudioHints.studioHints(w) : PieceStudioHints.studioHints(w.getCategory(), w.getSubcategory(), null, null);
        Map<String, Object> info = shots.studioShot(w.getUser().getId(), cutout, w.getStudioBackdrop() == null ? "auto" : w.getStudioBackdrop(),
                "users/" + w.getUser().getId() + "/pieces/" + w.getId() + "/", hints);
        // mesma foto de origem (reprocessamento): com uma aprovada no ar, a nova espera a aprovação
        versions.offerStudio(w, info, !sameSource);
    }

    void defaultStudio(WardrobeItem w) {
        new DefaultStudio(pieces, assets, shots, versions).defaultStudio(w);
    }

    /** Refaz o estúdio do rascunho com outro fundo; {@code force}: recorte incerto que a pessoa conferiu. */
    Map<String, Object> forDraft(UUID userId, UUID draftId, PipelineJob draft, String backdrop, boolean force) {
        Map<String, Object> r = new LinkedHashMap<>(Json.map(draft.getResultJson()));
        if (!Boolean.TRUE.equals(r.get("backgroundRemoved")) && !force) {
            throw new ApiException(422, "SEM_RECORTE", r.get("backgroundWarning") != null
                    ? Msg.t("wardrobe.o_recorte_automatico_ficou_incerto", r.get("backgroundWarning"))
                    : Msg.t("wardrobe.o_estudio_precisa_do_fundo"));
        }
        byte[] png = DraftRecorder.cutout(media, r);
        Map<?, ?> pf = r.get("prefill") instanceof Map<?, ?> m ? m : Map.of();
        Map<?, ?> flat = r.get("flatLayMetadata") instanceof Map<?, ?> m ? m : Map.of();
        var hints = PieceStudioHints.studioHints(pf.get("category") == null ? null : String.valueOf(pf.get("category")),
                pf.get("subcategory") == null ? null : String.valueOf(pf.get("subcategory")), flat.get("truncated_sides"), pf.get("logo"));
        Map<String, Object> info = shots.studioShot(userId, ImageOps.decode(png), backdrop == null ? "auto" : backdrop,
                "users/" + userId + "/drafts/" + draftId + "/", hints);
        if (info == null) {
            throw new ApiException(503, "ESTUDIO_INDISPONIVEL", Msg.t("wardrobe.nao_deu_para_gerar_o"));
        }
        if (!Boolean.TRUE.equals(r.get("backgroundRemoved"))) {
            info.put("forced", true);
        }
        r.put("studio", info);
        draft.setResultJson(Json.write(r));
        return info;
    }

    /** Gera (ou refaz) a foto de estúdio de uma peça já cadastrada; com uma aprovada no ar, a nova fica pendente. */
    void forPiece(UUID userId, UUID id, WardrobeItem w, String backdrop) {
        if (w.isDefaultImage() || w.getImageUrl() == null || w.getPhotoProcessingStatus() != PhotoProcessingStatus.COMPLETED) {
            throw new ApiException(422, "SEM_RECORTE", Msg.t("wardrobe.a_peca_precisa_de_uma"));
        }
        BufferedImage source = shots.studioSource(w);
        if (source == null) {
            throw ApiException.notFound(Msg.t("wardrobe.foto_da_peca"));
        }
        Map<String, Object> info = shots.studioShot(userId, source, backdrop == null ? "auto" : backdrop,
                "users/" + userId + "/pieces/" + id + "/", PieceStudioHints.studioHints(w));
        if (info == null) {
            throw new ApiException(503, "ESTUDIO_INDISPONIVEL", Msg.t("wardrobe.nao_deu_para_gerar_o_2"));
        }
        versions.offerStudio(w, info, false);                            // aprovada no ar → a nova fica pendente
    }

    /** Leva ao estúdio as peças do usuário que ainda não têm foto de estúdio (até 40 por chamada). */
    Map<String, Object> forAll(UUID userId, String backdrop) {
        int done = 0, skipped = 0;
        for (WardrobeItem w : pieces.findByUserIdOrderByCreatedAtDesc(userId)) {
            if (done >= 40) {
                break;
            }
            if (w.getStudioImageUrl() != null || w.getPhotoProcessingStatus() != PhotoProcessingStatus.COMPLETED
                    || w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED) {
                skipped++;
                continue;
            }
            if (w.isDefaultImage()) {
                defaultStudio(w);
                if (w.getStudioImageUrl() != null) {
                    done++;
                } else {
                    skipped++;
                }
                continue;
            }
            BufferedImage source = shots.studioSource(w);
            Map<String, Object> info = source == null ? null : shots.studioShot(userId, source, backdrop == null ? "auto" : backdrop,
                    "users/" + userId + "/pieces/" + w.getId() + "/", PieceStudioHints.studioHints(w));
            if (info == null) {
                skipped++;
                continue;
            }
            versions.offerStudio(w, info, false);                        // sem estúdio antes: entra no ar aguardando aprovação
            done++;
        }
        return Map.of("generated", done, "skipped", skipped);
    }
}
