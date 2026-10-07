package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.AiSeal;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.imaging.ImageProviderPorts;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.imaging.LocalPieceRegions;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PipelineJobStatus;
import br.com.fashionai.domain.model.enums.PipelineJobType;
import br.com.fashionai.domain.repository.PipelineJobRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * RF4 · Várias peças numa foto. Duas etapas, para a pessoa revisar entre elas:
 * <ol>
 *   <li>{@link #detect}: a IA de visão acha cada peça da foto (roupa, calçado, acessório) e devolve, por peça, nome,
 *       tipo, cor, material, estilo, ocasião e a caixa onde ela aparece (em % da foto). Nada vai ao acervo.</li>
 *   <li>{@link #pieceDraft}: para cada peça confirmada, o recorte (ou a foto inteira, quando a pessoa não recortou)
 *       vira um rascunho igual ao da análise de uma peça — Flat Lay, moderação e os mesmos campos em
 *       {@code resultJson} — e o cadastro segue pelo {@code POST /api/pieces} de sempre.</li>
 * </ol>
 * Os critérios de aceite da foto de uma peça (peça inteira, uma peça por foto, câmera a 90°) não se aplicam aqui: a foto
 * tem várias peças por definição e o recorte sai de uma foto vestida.
 */
@Service
public class MultiPieceService {
    /** Teto de peças por foto: acima disso a revisão fica ilegível e a caixa de cada peça, pequena demais. */
    static final int MAX_PIECES = 12;
    /** Lado menor mínimo de uma caixa (% da foto): menos que isso é ruído da detecção, não uma peça. */
    static final double MIN_BOX_PCT = 3.0;

    private final UserRepository users;
    private final PipelineJobRepository jobs;
    private final FlatLayPipeline flatLay;
    private final AiEngine ai;
    private final MediaService media;
    private final Guard guard;
    private final WardrobeService wardrobe;
    private final List<ImageProviderPorts.ImageEditPort> editors;

    public MultiPieceService(UserRepository users, PipelineJobRepository jobs, FlatLayPipeline flatLay, AiEngine ai,
                             MediaService media, Guard guard, WardrobeService wardrobe,
                             List<ImageProviderPorts.ImageEditPort> editors) {
        this.users = users;
        this.jobs = jobs;
        this.flatLay = flatLay;
        this.ai = ai;
        this.media = media;
        this.guard = guard;
        this.wardrobe = wardrobe;
        this.editors = editors;
    }

    /** Caixa da peça em porcentagem (0–100) da largura e da altura da foto: x/y = canto superior esquerdo. */
    public record Box(double x, double y, double width, double height) {
    }

    public record DetectedPiece(int index, String name, String category, String subcategory, String color, String material,
                                String sex, List<String> style, List<String> occasion, Box box, double confidence) {
    }

    /** @param source "ia" quando a visão remota respondeu; "local" = regiões estimadas para revisão */
    public record Detection(UUID draftId, String originalUrl, int width, int height, List<DetectedPiece> pieces,
                            String source, String aiMessage, AiOutcome.Explanation explanation, AiOutcome.Quota quota) {
    }

    /** Rascunho de uma peça da foto: o mesmo contrato do {@code POST /api/pieces} (draftId + imagens). */
    public record PieceDraft(UUID draftId, String processedUrl, String flatLayUrl, String thumbnailUrl, String originalUrl,
                             boolean backgroundRemoved, Map<String, Object> moderation, boolean aiGenerated) {
    }

    /** Cópia da peça recriada por IA: {@code previewUrl} já traz o selo; o cadastro usa {@code aiImageId}. */
    public record AiImage(UUID aiImageId, String previewUrl, AiOutcome.Explanation explanation, AiOutcome.Quota quota) {
    }

    // ================================================================== 1 — detectar

    /**
     * Resultado do núcleo de detecção: as peças, de onde vieram ("ia" ou "local") e o desfecho governado da chamada
     * (consentimento, cota, custo, id da inferência).
     */
    public record PieceDetection(List<DetectedPiece> pieces, String source, AiOutcome<List<DetectedPiece>> outcome) {
    }

    /**
     * Núcleo da detecção, sem efeito colateral fora do motor de IA (nenhum rascunho, job ou arquivo): a IA de visão acha
     * as peças da foto já orientada; sem IA (consentimento, cota, orçamento, provedor), regiões locais a conferir. Usado
     * pelo cadastro de várias peças ({@link #detect}) e pelo FashionAI Lens (RF54).
     */
    public PieceDetection detectPieces(UUID userId, BufferedImage photo) {
        List<DetectedPiece> local = localPieces(photo);
        AiOutcome<List<DetectedPiece>> outcome = ai.text(new AiEngine.TextCall<>(userId, AiCapability.MULTI_PIECE_DETECTOR,
                DETECTOR_SYSTEM, detectorPrompt(),
                List.of(new AiRequest.AiImage(ImageOps.jpeg(ImageOps.scaleToFit(photo, 1568, 1568), 0.9f), "image/jpeg")),
                2500, List.of(Msg.t("multiPiece.foto_reduzida")), MultiPieceService::parseDetections, () -> local, null));
        List<DetectedPiece> pieces = outcome.value() == null ? local : outcome.value();
        return new PieceDetection(pieces, pieces == local ? "local" : "ia", outcome);
    }

    @Transactional
    public Detection detect(CurrentUser user, byte[] bytes) {
        guard.requireCanCreate(user);
        String mime = ImageOps.requireAcceptedImage(bytes);
        User owner = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        BufferedImage photo = ImageOps.decode(bytes);

        PieceDetection detection = detectPieces(user.id(), photo);
        AiOutcome<List<DetectedPiece>> outcome = detection.outcome();
        List<DetectedPiece> pieces = detection.pieces();
        String source = detection.source();

        PipelineJob job = new PipelineJob();
        job.setUser(owner);
        job.setType(PipelineJobType.FLAT_LAY_STANDARDIZATION);
        job.setStatus(PipelineJobStatus.COMPLETED);
        job.setTargetType("MULTI_PIECE_DRAFT");
        job.setProvider(outcome.provider());
        job.setQueuedAt(Instant.now());
        job.setStartedAt(Instant.now());
        jobs.save(job);
        boolean png = "image/png".equals(mime);
        MediaStoragePort.StoredObject original = media.put("users/" + owner.getId() + "/drafts/" + job.getId() + "/original."
                + (png ? "png" : "jpg"), png ? ImageOps.png(photo) : ImageOps.jpeg(photo, 0.95f), png ? "image/png" : "image/jpeg");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("originalUrl", original.url());
        result.put("originalKey", original.key());
        result.put("width", photo.getWidth());
        result.put("height", photo.getHeight());
        result.put("source", source);
        result.put("pieces", pieces);
        result.put("aiInferences", List.of(outcome.inferenceId()));
        job.setResultJson(Json.write(result));
        job.setTotalCostUsd(outcome.costUsd());
        job.setFallbackUsed(outcome.fallbackUsed());
        job.setOutputUrl(original.url());
        job.setFinishedAt(Instant.now());
        return new Detection(job.getId(), original.url(), photo.getWidth(), photo.getHeight(), pieces, source,
                outcome.userMessage(), outcome.explanation(), outcome.quota());
    }

    /** Sem IA de visão: uma peça cobrindo a foto inteira, sem campos — a pessoa preenche e recorta na revisão. */
    public static DetectedPiece localPiece() {
        return new DetectedPiece(0, null, null, null, null, null, null, List.of(), List.of(), new Box(0, 0, 100, 100), 0);
    }

    static List<DetectedPiece> localPieces(BufferedImage photo) {
        List<LocalPieceRegions.Region> regions = LocalPieceRegions.detect(photo);
        if (regions.isEmpty()) return List.of(localPiece());
        List<DetectedPiece> pieces = new ArrayList<>();
        for (LocalPieceRegions.Region region : regions) {
            pieces.add(new DetectedPiece(pieces.size(), null, null, null, null, null, null, List.of(), List.of(),
                    new Box(region.x(), region.y(), region.width(), region.height()), 0.45));
        }
        return List.copyOf(pieces);
    }

    static final String DETECTOR_SYSTEM = """
            Você é o Multi-Piece Detector do Fashion AI. Você recebe UMA foto que pode ter várias peças (roupas, calçados e
            acessórios) — vestidas por alguém, penduradas ou dispostas numa superfície. Identifique CADA peça visível
            separadamente e responda SOMENTE com JSON:
            {"pieces": [{"name": nome curto da peça em português (ex.: "Camiseta branca lisa"),
                         "category": um de [upper_piece, lower_piece, shoes_piece, accessory_piece, full_body_piece],
                         "subcategory": código da lista de subtipos do tipo,
                         "color": código da paleta (a cor principal da peça), "material": código da lista de materiais,
                         "sex": um de [MASCULINO, FEMININO, UNISSEX],
                         "style": até 2 códigos da lista de estilos, "occasion": até 2 códigos da lista de ocasiões,
                         "box": {"x": borda esquerda, "y": borda de cima, "width": largura, "height": altura} em PORCENTAGEM
                                (0–100) da largura e da altura da foto inteira, justa na peça, com pouca folga,
                         "confidence": 0-1}]}
            Regras:
            - Um par de calçados é UMA peça (a caixa cobre os dois pés).
            - Não separe partes da mesma peça nem repita a mesma peça.
            - A caixa cobre só a peça: nada de rosto, cabelo ou cenário além do necessário.
            - Peça quase toda escondida ou cortada pela borda (menos de ~30% visível) fica de fora.
            - No máximo 12 peças, das maiores para as menores.
            Nunca descreva pessoas. Sem nenhuma peça na foto, devolva {"pieces": []}.""";

    /** Vocabulário permitido (docs/taxonomia): o que vier fora dele é descartado no parser. */
    static String detectorPrompt() {
        return "Subtipos por tipo: " + Taxonomy.SUBCATEGORIES + ".\n"
                + "Ocasiões: " + String.join(", ", Taxonomy.OCCASIONS) + ".\n"
                + "Estilos: " + String.join(", ", Taxonomy.STYLES) + ".\n"
                + "Cores (códigos): " + String.join(", ", Taxonomy.COLORS.keySet()) + ".\n"
                + "Materiais: " + String.join(", ", Taxonomy.MATERIALS) + ".\n"
                + "Identifique todas as peças da foto e responda só com o JSON.";
    }

    /**
     * Resposta da IA → peças validadas pela taxonomia (nada fora do vocabulário entra) com a caixa presa dentro da foto.
     * JSON ilegível → null (o motor trata como falha do provedor e tenta o próximo); lista vazia é resposta válida.
     */
    static List<DetectedPiece> parseDetections(String text) {
        Map<String, Object> m = WardrobeService.extractJson(text);
        if (!(m.get("pieces") instanceof List<?> list)) {
            return null;
        }
        List<DetectedPiece> out = new ArrayList<>();
        for (Object o : list) {
            if (out.size() >= MAX_PIECES) {
                break;
            }
            if (!(o instanceof Map<?, ?> p)) {
                continue;
            }
            Box box = box(p.get("box"));
            if (box == null) {
                continue;
            }
            String sub = Taxonomy.activeSubcategory(WardrobeService.str(p.get("subcategory")));   // legado → código novo
            String category = WardrobeService.str(p.get("category"));
            if (sub != null && Taxonomy.categoryOf(sub) != null) {
                category = Taxonomy.categoryOf(sub);
            } else {
                sub = null;
                if (!Taxonomy.isValidCategory(category)) {
                    category = null;
                }
            }
            String name = WardrobeService.str(p.get("name"));
            double conf = p.get("confidence") instanceof Number n ? Math.max(0, Math.min(1, n.doubleValue())) : 0.5;
            out.add(new DetectedPiece(out.size(),
                    name == null || name.isBlank() ? null : InputSanitizer.clean(name, 80),
                    category, sub,
                    WardrobeService.oneOf(WardrobeService.str(p.get("color")), Taxonomy.COLORS.keySet()),
                    WardrobeService.oneOf(WardrobeService.str(p.get("material")), Taxonomy.MATERIALS),
                    WardrobeService.oneOf(WardrobeService.str(p.get("sex")), Taxonomy.SEXES),
                    Taxonomy.keepAllowed(WardrobeService.strings(p.get("style")), Taxonomy.STYLES, Taxonomy.MAX_PIECE_TAGS),
                    Taxonomy.keepAllowed(WardrobeService.strings(p.get("occasion")), Taxonomy.allowedOccasions(category), Taxonomy.MAX_PIECE_TAGS),
                    box, Math.round(conf * 100) / 100.0));
        }
        return out;
    }

    /** Caixa em % presa dentro da foto; sem os quatro números, ou menor que {@link #MIN_BOX_PCT}, a peça é descartada. */
    static Box box(Object o) {
        if (!(o instanceof Map<?, ?> b) || !(b.get("x") instanceof Number x) || !(b.get("y") instanceof Number y)
                || !(b.get("width") instanceof Number w) || !(b.get("height") instanceof Number h)) {
            return null;
        }
        double x0 = clamp(x.doubleValue());
        double y0 = clamp(y.doubleValue());
        double x1 = clamp(x.doubleValue() + w.doubleValue());
        double y1 = clamp(y.doubleValue() + h.doubleValue());
        if (x1 - x0 < MIN_BOX_PCT || y1 - y0 < MIN_BOX_PCT) {
            return null;
        }
        return new Box(round1(x0), round1(y0), round1(x1 - x0), round1(y1 - y0));
    }

    private static double clamp(double v) {
        return Math.max(0, Math.min(100, v));
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    // ================================================================== 2 — rascunho de cada peça

    /**
     * Uma peça confirmada na revisão vira um rascunho de peça: Flat Lay (remoção de fundo), moderação da imagem e os
     * mesmos campos que {@code WardrobeService.create} lê do rascunho da análise de uma peça.
     *
     * @param parentId rascunho da detecção ({@link #detect}); a peça herda dele a detecção como "detected" (RF34 §5)
     * @param index    posição da peça na detecção (null = peça que a pessoa não achou na lista)
     * @param bytes    o recorte da peça, ou a foto inteira quando a pessoa não recortou
     */
    @Transactional
    public PieceDraft pieceDraft(CurrentUser user, UUID parentId, Integer index, byte[] bytes) {
        guard.requireCanCreate(user);
        ImageOps.requireAcceptedImage(bytes);
        User owner = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        PipelineJob parent = ownedParent(user, owner, parentId);
        return draft(user, owner, parent, index, bytes, false);
    }

    /**
     * Rascunho da peça com a cópia recriada por IA no lugar da foto: passa pelo mesmo Flat Lay e pela mesma moderação,
     * e todas as versões gravadas (original, recorte, flat lay, miniatura) levam o selo de IA; a peça sai com a flag.
     */
    @Transactional
    public PieceDraft aiPieceDraft(CurrentUser user, UUID parentId, UUID aiImageId) {
        guard.requireCanCreate(user);
        User owner = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        PipelineJob parent = ownedParent(user, owner, parentId);
        PipelineJob aiJob = jobs.findById(aiImageId).filter(j -> "AI_PIECE_IMAGE".equals(j.getTargetType()))
                .filter(j -> j.getUser().getId().equals(owner.getId()))
                .filter(j -> parentId.toString().equals(Json.map(j.getInputJson()).get("multiPieceDraftId")))
                .orElseThrow(() -> ApiException.notFound(Msg.t("multiPiece.imagem_ia")));
        Map<String, Object> in = Json.map(aiJob.getInputJson());
        Integer index = in.get("index") instanceof Number n && n.intValue() >= 0 ? n.intValue() : null;
        byte[] raw = media.read(String.valueOf(Json.map(aiJob.getResultJson()).get("rawUrl")))
                .orElseThrow(() -> ApiException.notFound(Msg.t("multiPiece.imagem_ia")));
        return draft(user, owner, parent, index, raw, true);
    }

    private PipelineJob ownedParent(CurrentUser user, User owner, UUID parentId) {
        PipelineJob parent = jobs.findById(parentId).filter(j -> "MULTI_PIECE_DRAFT".equals(j.getTargetType()))
                .orElseThrow(() -> ApiException.notFound(Msg.t("multiPiece.rascunho")));
        if (!parent.getUser().getId().equals(owner.getId())) {
            throw guard.deny(user, "draft:" + parentId, Msg.t("wardrobe.rascunho_de_outro_usuario"));
        }
        return parent;
    }

    private PieceDraft draft(CurrentUser user, User owner, PipelineJob parent, Integer index, byte[] bytes, boolean aiImage) {
        UUID parentId = parent.getId();
        Object detected = null;
        if (index != null && Json.map(parent.getResultJson()).get("pieces") instanceof List<?> ps && index >= 0 && index < ps.size()) {
            detected = ps.get(index);
        }

        AiOutcome<FlatLayPipeline.Result> pipeline = ai.execute(user.id(), AiCapability.FLAT_LAY_STANDARDIZER,
                List.of(Msg.t("wardrobe.foto_enviada_kb", bytes.length / 1024)), null, null,
                List.of(wardrobe.flatLayStep(bytes)), () -> flatLay.run(bytes, false));
        FlatLayPipeline.Result r = pipeline.value();

        // Moderação (#2) da imagem que vai para o acervo — nunca aprova por omissão.
        LocalVision.ModerationVerdict localVerdict = LocalVision.moderate(r.original(), r.cutout());
        AiOutcome<LocalVision.ModerationVerdict> moderation = ai.text(new AiEngine.TextCall<>(user.id(),
                AiCapability.CONTENT_MODERATOR, WardrobeService.MODERATION_SYSTEM, Msg.t("wardrobe.classifique_a_imagem_anexada"),
                List.of(new AiRequest.AiImage(ImageOps.jpeg(ImageOps.scaleToFit(r.original(), 768, 768), 0.85f), "image/jpeg")),
                400, List.of(Msg.t("wardrobe.foto_da_peca_reduzida_a")), wardrobe::parseModeration, () -> localVerdict, null));
        LocalVision.ModerationVerdict verdict = moderation.value();
        if (verdict.status() == ModerationStatus.REJECTED_POLICY) {
            throw ApiException.badRequest("CONTEUDO_BLOQUEADO", Msg.t("wardrobe.a_foto_viola_a_politica"));
        }

        PipelineJob job = new PipelineJob();
        job.setUser(owner);
        job.setType(PipelineJobType.FLAT_LAY_STANDARDIZATION);
        job.setStatus(PipelineJobStatus.COMPLETED);
        job.setTargetType("PIECE_DRAFT");
        job.setProvider(pipeline.provider());
        job.setInputJson(Json.write(Map.of("multiPieceDraftId", parentId.toString(), "index", index == null ? -1 : index)));
        job.setQueuedAt(Instant.now());
        job.setStartedAt(Instant.now());
        jobs.save(job);
        String base = "users/" + owner.getId() + "/drafts/" + job.getId() + "/";
        boolean png = r.mimeType().equals("image/png");
        // cópia por IA: o selo vai DEPOIS do Flat Lay (a remoção de fundo apagaria um selo gravado antes)
        String seal = aiImage ? Msg.t("multiPiece.selo_ia") : null;
        BufferedImage originalImg = aiImage ? AiSeal.stamp(r.original(), seal) : r.original();
        byte[] originalBytes = png ? ImageOps.png(originalImg) : ImageOps.jpeg(originalImg, 0.95f);
        MediaStoragePort.StoredObject original = media.put(base + "original." + (png ? "png" : "jpg"), originalBytes,
                png ? "image/png" : "image/jpeg");
        MediaStoragePort.StoredObject processed = media.put(base + "processed.png",
                aiImage ? ImageOps.png(AiSeal.stamp(ImageOps.decode(r.processedPng()), seal)) : r.processedPng(), "image/png");
        MediaStoragePort.StoredObject white = media.put(base + "flatlay.jpg",
                aiImage ? ImageOps.jpeg(AiSeal.stamp(ImageOps.decode(r.processedWhiteJpeg()), seal), 0.92f) : r.processedWhiteJpeg(), "image/jpeg");
        MediaStoragePort.StoredObject thumb = media.put(base + "thumb.png",
                aiImage ? ImageOps.png(AiSeal.stamp(ImageOps.decode(r.thumbnailPng()), seal)) : r.thumbnailPng(), "image/png");

        Map<String, Object> quality = new LinkedHashMap<>();
        quality.put("metrics", r.quality().metrics());
        quality.put("overall", r.quality().overall());
        quality.put("accepted", r.quality().accepted());
        quality.put("threshold", br.com.fashionai.application.imaging.QualityMetrics.ACCEPTANCE_THRESHOLD);
        quality.put("issues", r.quality().issues());
        quality.put("recommendations", r.quality().recommendations());
        Map<String, Object> mod = new LinkedHashMap<>();
        mod.put("status", verdict.status().name());
        mod.put("confidence", verdict.confidence());
        mod.put("reasons", verdict.reasons());
        mod.put("humanReview", verdict.needsHumanReview());
        mod.put("provider", moderation.provider());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("processedUrl", processed.url());
        result.put("flatLayUrl", white.url());
        result.put("thumbnailUrl", thumb.url());
        result.put("originalUrl", original.url());
        result.put("originalKey", original.key());
        result.put("mime", r.mimeType());
        result.put("width", r.originalWidth());
        result.put("height", r.originalHeight());
        result.put("bytes", originalBytes.length);
        result.put("hash", Hashing.sha256(originalBytes));
        result.put("aiGenerated", aiImage);
        result.put("backgroundRemoved", r.backgroundRemoved());
        if (r.cutout().warning() != null) {
            result.put("backgroundWarning", r.cutout().warning());
        }
        result.put("flatLayMetadata", r.metadata());
        result.put("quality", quality);
        result.put("moderation", mod);
        if (detected != null) {
            result.put("prefill", detected);
        }
        result.put("aiInferences", List.of(pipeline.inferenceId(), moderation.inferenceId()));
        job.setResultJson(Json.write(result));
        job.setStagesJson(Json.write(r.stages()));
        job.setQualityScore(BigDecimal.valueOf(r.quality().overall()));
        job.setTotalCostUsd(r.totalCostUsd().add(moderation.costUsd()));
        job.setTotalTimeMs((int) r.totalMs());
        job.setFallbackUsed(r.fallbackUsed());
        job.setOutputUrl(processed.url());
        job.setFinishedAt(Instant.now());
        return new PieceDraft(job.getId(), processed.url(), white.url(), thumb.url(), original.url(), r.backgroundRemoved(), mod, aiImage);
    }

    // ================================================================== 3 — cópia da peça por IA

    /**
     * A pessoa achou a foto da peça ruim: a IA de imagem recria a peça a partir do recorte (ou da foto inteira) como foto
     * de produto. Nada muda no acervo ainda — a revisão mostra a prévia (já com o selo) e a pessoa escolhe qual usar.
     * Sem provedor de imagem, sem consentimento ou com a cota/teto de gasto estourado: 503 IA_INDISPONIVEL com o motivo.
     *
     * @param name/category/color o que a pessoa conferiu na revisão: orienta a IA a recriar a peça certa
     */
    @Transactional
    public AiImage recreate(CurrentUser user, UUID parentId, Integer index, byte[] bytes, String name, String category, String color) {
        guard.requireCanCreate(user);
        ImageOps.requireAcceptedImage(bytes);
        User owner = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        PipelineJob parent = ownedParent(user, owner, parentId);
        byte[] input = ImageOps.jpeg(ImageOps.scaleToFit(ImageOps.decode(bytes), 1024, 1024), 0.92f);
        String prompt = recreatePrompt(name, category, color);

        List<AiEngine.RemoteStep<ImageProviderPorts.ProviderImage>> steps = new ArrayList<>();
        for (ImageProviderPorts.ImageEditPort editor : editors) {
            steps.add(new AiEngine.RemoteStep<>() {
                @Override
                public String provider() {
                    return editor.getClass().getSimpleName().replace("Adapter", "").toLowerCase(Locale.ROOT);
                }

                @Override
                public String model() {
                    return "image-edit";
                }

                @Override
                public boolean available() {
                    return editor.available();
                }

                @Override
                public AiEngine.RemoteResult<ImageProviderPorts.ProviderImage> call() {
                    ImageProviderPorts.ProviderImage img = editor.edit(input, "image/jpeg", prompt)
                            .orElseThrow(() -> new IllegalStateException("provedor não devolveu imagem"));
                    return new AiEngine.RemoteResult<>(img, img.costUsd(), img.provider());
                }
            });
        }
        AiOutcome<ImageProviderPorts.ProviderImage> outcome = ai.execute(user.id(), AiCapability.PIECE_IMAGE_RECREATOR,
                List.of(Msg.t("multiPiece.foto_para_ia")), null, null, steps, () -> null);
        ImageProviderPorts.ProviderImage generated = outcome.value();
        if (generated == null) {
            String why = outcome.userMessage() == null ? Msg.t("multiPiece.ia_indisponivel") : outcome.userMessage();
            throw new ApiException(503, "IA_INDISPONIVEL", why, Map.of("capability", AiCapability.PIECE_IMAGE_RECREATOR.name()));
        }

        BufferedImage img = ImageOps.decode(generated.bytes());
        PipelineJob job = new PipelineJob();
        job.setUser(owner);
        job.setType(PipelineJobType.FLAT_LAY_STANDARDIZATION);
        job.setStatus(PipelineJobStatus.COMPLETED);
        job.setTargetType("AI_PIECE_IMAGE");
        job.setProvider(outcome.provider());
        job.setInputJson(Json.write(Map.of("multiPieceDraftId", parent.getId().toString(), "index", index == null ? -1 : index)));
        job.setQueuedAt(Instant.now());
        job.setStartedAt(Instant.now());
        jobs.save(job);
        String base = "users/" + owner.getId() + "/drafts/" + parent.getId() + "/ai-" + job.getId();
        // a original da IA fica sem selo (o Flat Lay do cadastro parte dela e o selo entra depois); a prévia já leva o selo
        MediaStoragePort.StoredObject raw = media.put(base + ".png", ImageOps.png(img), "image/png");
        MediaStoragePort.StoredObject preview = media.put(base + "-preview.jpg",
                ImageOps.jpeg(AiSeal.stamp(ImageOps.scaleToFit(img, 768, 768), Msg.t("multiPiece.selo_ia")), 0.9f), "image/jpeg");
        job.setResultJson(Json.write(Map.of("rawUrl", raw.url(), "rawKey", raw.key(), "previewUrl", preview.url(),
                "inferenceId", String.valueOf(outcome.inferenceId()))));
        job.setTotalCostUsd(outcome.costUsd());
        job.setOutputUrl(preview.url());
        job.setFinishedAt(Instant.now());
        return new AiImage(job.getId(), preview.url(), outcome.explanation(), outcome.quota());
    }

    /**
     * Instrução da recriação (em inglês: o modelo de imagem segue melhor). A peça tem de continuar a MESMA — cores,
     * estampa, logos, detalhes —, só a foto melhora; nada de pessoa, texto ou objetos novos.
     */
    static String recreatePrompt(String name, String category, String color) {
        StringBuilder hint = new StringBuilder();
        String n = name == null ? null : InputSanitizer.clean(name, 80);
        if (n != null && !n.isBlank()) {
            hint.append(" The item is: \"").append(n.replace("\"", "'")).append("\".");
        }
        if (category != null && Taxonomy.isValidCategory(category)) {
            hint.append(" Type: ").append(category.replace('_', ' ')).append('.');
        }
        if (color != null && Taxonomy.COLORS.containsKey(color)) {
            hint.append(" Main color: ").append(color.replace('_', ' ')).append('.');
        }
        return "Recreate the single clothing item from this photo as a clean, realistic e-commerce product photo." + hint
                + " Show only that one item, complete and uncut, front view, as a flat lay or on an invisible mannequin,"
                + " centered on a plain white studio background with soft, even lighting."
                + " Keep exactly the same colors, fabric texture, pattern, prints, logos, buttons, stitching and proportions;"
                + " do not add, remove or invent details. No person, no body parts, no text, no other objects.";
    }
}
