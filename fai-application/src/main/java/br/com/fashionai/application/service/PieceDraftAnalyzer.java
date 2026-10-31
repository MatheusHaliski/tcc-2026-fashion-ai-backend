package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.assets.PieceReferenceCatalog;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.BrandReader;
import br.com.fashionai.application.imaging.BrandRegions;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.imaging.PhotoAcceptance;
import br.com.fashionai.application.imaging.Silhouette;
import br.com.fashionai.application.imaging.SubtypeReferences;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.WardrobeService.Prefill;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.repository.UserRepository;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.service.DraftEvidence.applyOcr;
import static br.com.fashionai.application.service.DraftEvidence.brandSearch;
import static br.com.fashionai.application.service.DraftEvidence.candidates;
import static br.com.fashionai.application.service.DraftEvidence.localGuess;
import static br.com.fashionai.application.service.DraftEvidence.logoRelative;
import static br.com.fashionai.application.service.DraftEvidence.rejection;
import static br.com.fashionai.application.service.PieceAnalysisParser.parseAnalysis;
import static br.com.fashionai.application.service.PieceAnalyzerPrompts.ANALYZER_SYSTEM;
import static br.com.fashionai.application.service.PieceAnalyzerPrompts.MODERATION_SYSTEM;
import static br.com.fashionai.application.service.PieceAnalyzerPrompts.analyzerPrompt;
import static br.com.fashionai.application.service.PiecePrefill.prefill;

/**
 * RF4.CA01–CA03/CA06 — análise da foto da peça até o pré-preenchimento: Flat Lay governado, critérios de aceite locais,
 * moderação (#2), detecção pelo analisador de visão (#1) com a folha de referências e as zonas da marca, critérios que
 * dependem da análise, logo (IA → detector local → OCR) e pré-preenchimento. Foto fora dos critérios → 422 FOTO_RECUSADA.
 * Não grava nada: o {@link DraftRecorder} guarda o rascunho.
 */
final class PieceDraftAnalyzer {
    /** O que a análise apurou e o rascunho precisa guardar. */
    record Detection(User owner, AiOutcome<FlatLayPipeline.Result> pipeline, AiOutcome<LocalVision.ModerationVerdict> moderation,
                     AiOutcome<LocalVision.PieceGuess> analysis, LocalVision.PieceGuess guess, List<PhotoAcceptance.Check> checks,
                     List<PhotoAcceptance.Check> failed, Prefill prefill, double[] logoRel, String logoSource,
                     BrandReader.Found ocr, boolean aiRan) {
    }

    private final UserRepository users;
    private final AiEngine ai;
    private final FlatLayPipeline flatLay;
    private final PieceReferenceCatalog pieceReferences;
    private final BrandReader brandReader;

    PieceDraftAnalyzer(UserRepository users, AiEngine ai, FlatLayPipeline flatLay, PieceReferenceCatalog pieceReferences,
                       BrandReader brandReader) {
        this.users = users;
        this.ai = ai;
        this.flatLay = flatLay;
        this.pieceReferences = pieceReferences;
        this.brandReader = brandReader;
    }

    /** @param lenient critérios de foto reprovados viram orientação; só conteúdo fora da política continua recusado */
    Detection detect(CurrentUser user, byte[] bytes, String category, boolean lenient) {
        ImageOps.requireAcceptedImage(bytes);
        String chosen = category == null || category.isBlank() ? null : category.trim();
        if (chosen != null && !Taxonomy.isValidCategory(chosen)) {
            throw ApiException.badRequest("CATEGORIA_INVALIDA", Msg.t("taxonomy.categoria_invalida"), Map.of("category", Msg.t("taxonomy.categoria_invalida")));
        }
        User owner = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        AiOutcome<FlatLayPipeline.Result> pipeline = ai.execute(user.id(), AiCapability.FLAT_LAY_STANDARDIZER,
                List.of(Msg.t("wardrobe.foto_enviada_kb", bytes.length / 1024)), null, null,
                List.of(new FlatLayRemoteStep(flatLay, bytes)), () -> flatLay.run(bytes, false));
        FlatLayPipeline.Result r = pipeline.value();

        // Critérios de aceite (locais, antes de qualquer IA paga): fundo separado, peça inteira, enquadramento,
        // alinhamento, câmera a 90° (simetria), uma peça por foto, nitidez e luz
        PhotoAcceptance.Report acceptance = PhotoAcceptance.evaluate(chosen, r.originalWidth(), r.originalHeight(), r.cutout(),
                r.truncated(), r.quality());
        if (!acceptance.accepted() && !lenient) {
            throw rejection(acceptance.checks());
        }
        ImageOps.Cutout cutout = r.cutout();
        // a peça endireitada e justa na caixa (alta resolução): base da comparação com as referências e das zonas da marca
        BufferedImage piece = r.studioSource();
        SubtypeReferences refs = pieceReferences.get();
        Silhouette.Descriptor shape = Silhouette.of(piece);
        List<SubtypeReferences.Match> ranking = refs.rank(chosen, shape);
        LocalVision.PieceGuess localGuess = localGuess(LocalVision.analyzePiece(cutout), chosen, ranking);
        String zonesCategory = chosen != null ? chosen : localGuess.category();
        List<BrandRegions.Zone> zones = BrandRegions.zones(piece, zonesCategory);

        // Moderação (#2) — nunca aprova por omissão.
        LocalVision.ModerationVerdict localVerdict = LocalVision.moderate(r.original(), cutout);
        AiOutcome<LocalVision.ModerationVerdict> moderation = ai.text(new AiEngine.TextCall<>(user.id(),
                AiCapability.CONTENT_MODERATOR, MODERATION_SYSTEM, Msg.t("wardrobe.classifique_a_imagem_anexada"),
                List.of(new AiRequest.AiImage(ImageOps.jpeg(ImageOps.scaleToFit(r.original(), 768, 768), 0.85f), "image/jpeg")),
                400, List.of(Msg.t("wardrobe.foto_da_peca_reduzida_a")), PieceAnalysisParser::parseModeration, () -> localVerdict, null));
        LocalVision.ModerationVerdict verdict = moderation.value();

        // Detecção (#1): peça inteira + folha de referências do tipo escolhido + zonas da marca ampliadas
        byte[] sheet = chosen == null ? null : refs.contactSheet(chosen);
        List<AiRequest.AiImage> images = new ArrayList<>();
        images.add(new AiRequest.AiImage(ImageOps.png(ImageOps.composeCentered(piece, 768, 0.06, java.awt.Color.WHITE, false)), "image/png"));
        if (sheet != null) {
            images.add(new AiRequest.AiImage(sheet, "image/png"));
        }
        for (BrandRegions.Zone z : zones) {
            images.add(new AiRequest.AiImage(ImageOps.jpeg(BrandRegions.crop(piece, z), 0.92f), "image/jpeg"));
        }
        AiOutcome<LocalVision.PieceGuess> analysis = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.PIECE_ANALYZER,
                ANALYZER_SYSTEM, analyzerPrompt(chosen, sheet == null ? List.of() : refs.sheetLegend(chosen), zones, ranking),
                images, 1200, List.of(Msg.t("wardrobe.foto_padronizada_da_peca"), Msg.t("wardrobe.vocabulario_da_taxonomia_v3_7")),
                text -> parseAnalysis(text, chosen), () -> localGuess, null));
        LocalVision.PieceGuess guess = analysis.value();
        boolean aiRan = analysis.value() != localGuess;

        // Critérios que dependem da análise: tipo/formato identificável, peça inteira e de frente aos olhos da IA, conteúdo
        List<PhotoAcceptance.Check> checks = new ArrayList<>(acceptance.checks());
        LocalVision.Insights seen = guess.insights();
        String categoryLabel = Msg.t("taxonomy." + (chosen != null ? chosen : guess.category() == null ? "upper_piece" : guess.category()));
        String detectedLabel = seen.detectedCategory() == null ? null : Msg.t("taxonomy." + seen.detectedCategory());
        double categoryConfidence = guess.confidence() == null ? 0 : guess.confidence().getOrDefault("category", 0.0);
        // categoria que a foto parece ter, quando difere da escolhida: a tela oferece "Usar <categoria detectada>"
        String detectedCode = seen.detectedCategory() != null && Taxonomy.isValidCategory(seen.detectedCategory())
                && !seen.detectedCategory().equals(chosen) ? seen.detectedCategory() : null;
        if (chosen != null) {
            // sem referências carregadas (ambiente sem /public) a silhueta não tem com o que comparar: não reprova por ela
            Map<String, Double> bestBy = refs.isEmpty() ? Map.of() : refs.bestByCategory(shape);
            Map.Entry<String, Double> other = bestBy.entrySet().stream().filter(e -> !e.getKey().equals(chosen))
                    .max(Map.Entry.comparingByValue()).orElse(null);
            double bestLocal = bestBy.getOrDefault(chosen, 1.0);
            if (detectedCode == null && other != null && other.getValue() - bestLocal >= PhotoAcceptance.LOCAL_OTHER_MARGIN) {
                detectedCode = other.getKey();
            }
            String seenLabel = detectedLabel != null ? detectedLabel : other == null ? null : Msg.t("taxonomy." + other.getKey());
            checks.add(PhotoAcceptance.shapeCheck(categoryLabel, aiRan ? seen.matchesCategory() : null, categoryConfidence, seenLabel,
                    bestLocal, other == null ? 0 : other.getValue()));
        }
        if (aiRan) {
            checks.addAll(PhotoAcceptance.aiPhotoChecks(seen.fullyVisible(), seen.viewAngle(), seen.singlePiece(), seen.photoConfidence(),
                    zonesCategory));
        }
        if (verdict.status() == ModerationStatus.REJECTED_NOT_CLOTHING || verdict.status() == ModerationStatus.REJECTED_POLICY) {
            checks.add(new PhotoAcceptance.Check("conteudo", false, verdict.confidence(), 0.85,
                    verdict.status() == ModerationStatus.REJECTED_POLICY ? Msg.t("wardrobe.a_foto_viola_a_politica") : Msg.t("photoAcceptance.nao_roupa")));
        }
        List<PhotoAcceptance.Check> failed = checks.stream().filter(c -> !c.ok()).toList();
        // modo lenient: só conteúdo (política / não é roupa) continua recusado; o resto vira orientação
        if (!failed.isEmpty() && (!lenient || failed.stream().anyMatch(c -> "conteudo".equals(c.id())))) {
            throw rejection(checks, failed.stream().anyMatch(c -> "formato".equals(c.id())) ? detectedCode : null);
        }

        // Marca: logo apontado pela IA na imagem 1 (0–1000) → caixa relativa à peça; sem IA, o detector local diz onde está
        double[] logoRel = logoRelative(guess.logoBox(), piece.getWidth(), piece.getHeight());
        String logoSource = logoRel == null ? null : "ia";
        if (logoRel == null) {
            logoRel = BrandRegions.detectLogo(piece);
            logoSource = logoRel == null ? null : "local";
        }
        // Marca não lida pela IA (ou IA fora do ar): o servidor lê o texto do logo (OCR local) na peça e nas zonas
        br.com.fashionai.application.imaging.BrandReader.Found ocr = null;
        if ((guess.brand() == null || guess.brand().isBlank()) && brandReader != null && brandReader.available()) {
            List<BrandRegions.Zone> where = new ArrayList<>(zones);
            if (logoRel != null) {
                where.add(0, new BrandRegions.Zone("logo", logoRel));
            }
            ocr = brandReader.find(piece, where).orElse(null);
            if (ocr != null && ocr.confirmed()) {
                guess = guess.withBrand(ocr.brand());
                if (logoRel == null) {
                    logoRel = ocr.box();
                    logoSource = "ocr";
                }
            }
        }
        Map<String, Object> logo = logoRel == null ? null : Map.of("box", java.util.Arrays.stream(logoRel).boxed().toList(), "source", logoSource);
        Map<String, Object> brandSearch = brandSearch(zones, guess, logoRel, logoSource);
        if (ocr != null) {
            applyOcr(brandSearch, ocr, zones);
        }
        List<Map<String, Object>> candidates = candidates(seen.ranking().isEmpty() ? ranking : seen.ranking(), chosen != null ? chosen : guess.category());
        Prefill prefill = prefill(guess.withInsights(seen.withRanking(seen.ranking().isEmpty() ? ranking : seen.ranking())), logo, candidates,
                brandSearch, checks.stream().map(c -> Map.<String, Object>of("id", c.id(), "value", c.value(), "threshold", c.threshold())).toList());
        return new Detection(owner, pipeline, moderation, analysis, guess, checks, failed, prefill, logoRel, logoSource, ocr, aiRan);
    }
}
