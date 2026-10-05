package br.com.fashionai.application.catalog.image;

import br.com.fashionai.domain.model.enums.CatalogImagePresentation;
import br.com.fashionai.domain.model.enums.CatalogImageProcessingMode;
import br.com.fashionai.domain.model.enums.CatalogImageRights;
import br.com.fashionai.domain.model.enums.CatalogImageViewAngle;

import java.awt.image.BufferedImage;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * RF47 · Dados que atravessam o pipeline de imagens oficiais ({@value #PIPELINE_VERSION}). Docs:
 * docs/catalogo/PIPELINE_IMAGENS_OFICIAIS.md. Coordenadas: {@link Region} normalizada na imagem de TRABALHO (a fonte
 * decodificada, orientada e reduzida a no máximo {@link #WORK_MAX_SIDE} px no lado maior).
 */
public final class ImageModel {
    public static final String PIPELINE_VERSION = "CATALOG_IMAGE_PIPELINE_V2";
    /** lado máximo da imagem de trabalho (análise); a renderização volta à fonte em resolução cheia */
    public static final int WORK_MAX_SIDE = 1600;

    private ImageModel() {
    }

    /** Família de enquadramento (a estratégia): parte de cima, de baixo, peça inteira (vestido/macacão), calçado, acessório. */
    public enum PieceType {
        UPPER, LOWER, FULL_BODY, SHOES, ACCESSORY;

        public static PieceType ofCategory(String category) {
            if (category == null) {
                return ACCESSORY;
            }
            return switch (category) {
                case "upper_piece" -> UPPER;
                case "lower_piece" -> LOWER;
                case "full_body_piece" -> FULL_BODY;
                case "shoes_piece" -> SHOES;
                default -> ACCESSORY;
            };
        }
    }

    /** Borda do quadro (para "por onde o recorte semântico pode cortar" e "qual lado da foto cortou a peça"). */
    public enum Edge { TOP, RIGHT, BOTTOM, LEFT }

    /** Para que serve o enquadramento: master (peça inteira, sempre), card (pode cortar pelo lado permitido), quadrado, detalhe. */
    public enum Purpose { MASTER, CARD, SQUARE, DETAIL }

    /** Quadro de saída. Nunca estica: a escala é sempre uniforme. */
    public record CanvasSpec(String aspect, int width, int height) {
        public static final CanvasSpec MASTER_4X5 = new CanvasSpec("4:5", 1600, 2000);
        public static final CanvasSpec CARD_4X5 = new CanvasSpec("4:5", 800, 1000);
        public static final CanvasSpec SQUARE_1X1 = new CanvasSpec("1:1", 800, 800);
        public static final CanvasSpec THUMB_1X1 = new CanvasSpec("1:1", 320, 320);
        public static final CanvasSpec DETAIL_4X5 = new CanvasSpec("4:5", 1200, 1500);
        public static final CanvasSpec AI_ANALYSIS = new CanvasSpec("1:1", 768, 768);

        public double ratio() {
            return width / (double) height;
        }
    }

    // ───────────────────────────────────────────────────────── contexto e fonte

    /**
     * O produto do catálogo cuja foto está sendo processada — o pipeline usa a categoria/subcategoria para escolher a
     * estratégia e a cor para conferir que a foto é do produto (e da variante) certos.
     */
    public record ProductContext(UUID productId, UUID variantId, String brandSlug, String category, String subcategory,
                                 String variationCode, String colorCode, String colorHex, String productName,
                                 CatalogImageRights rights, boolean thirdPartyProcessingAllowed,
                                 Set<String> officialDomains, Set<String> brandCdnHosts) {
        public PieceType pieceType() {
            return PieceType.ofCategory(category);
        }
    }

    /** Uma foto candidata do produto, como está no catálogo (antes de buscar os bytes). */
    public record CandidateRef(UUID imageId, String imageUrl, String productPageUrl, String sourceType, String sourceDomain,
                               int position, UUID variantId) {
    }

    /**
     * Fonte baixada e validada: bytes nunca alterados (o hash é da fonte), imagem de trabalho orientada.
     *
     * @param requestedUrl URL do catálogo · @param fetchedUrl URL efetivamente baixada (versão em alta resolução da CDN)
     * @param meaningfulAlpha a fonte já vem recortada (PNG com fundo transparente de verdade)
     */
    public record SourceImage(CandidateRef ref, String requestedUrl, String fetchedUrl, String mime, long byteSize,
                              int width, int height, String sha256, long perceptualHash, long differenceHash,
                              boolean meaningfulAlpha, BufferedImage work, double workScale, Instant retrievedAt) {
        /** Fator para voltar da imagem de trabalho à fonte em resolução cheia. */
        public double toSourceScale() {
            return 1 / workScale;
        }
    }

    // ───────────────────────────────────────────────────────── análise

    /** Tipo de objeto encontrado na foto. */
    public enum ObjectKind { PRODUCT, PERSON, OTHER_GARMENT, PROP, TEXT_OVERLAY }

    public record DetectedObject(ObjectKind kind, String label, Region box, double confidence, String detector) {
    }

    /**
     * Segmentação primeiro-plano × fundo (ainda com pessoa e objetos, se houver).
     *
     * @param method NATIVE_ALPHA · REMBG_SELF_HOSTED · STUDIO_BACKDROP · LOCAL_FLOOD · THIRD_PARTY
     * @param backgroundUniformity 0–1, quão liso é o fundo (1 = packshot de estúdio)
     */
    public record Segmentation(PixelMask foreground, double confidence, String method, int backgroundRgb,
                               double backgroundUniformity, List<String> warnings) {
    }

    /**
     * Partes de pessoa na imagem de trabalho (máscaras já reamostradas). {@code person} = pele + rosto + cabelo
     * (o que nunca pode sobrar no master); {@code clothes} = roupa vestida.
     */
    public record PersonMask(PixelMask person, PixelMask clothes, double personFraction, String model) {
        public static PersonMask none(int w, int h) {
            return new PersonMask(new PixelMask(w, h), new PixelMask(w, h), 0, "none");
        }
    }

    /**
     * Resultado do isolamento do produto alvo: pessoa e distratores fora, buracos transparentes (NUNCA preenchidos).
     *
     * @param garment              máscara final do produto alvo
     * @param humanResidue         fração do produto que ainda é pele/rosto/cabelo (deve ser ~0)
     * @param objectResidue        fração do produto que pertence a outro objeto/peça
     * @param occludedFraction     fração da silhueta do produto encoberta por pessoa/objeto (o buraco que ficaria)
     * @param garmentCompleteness  0–1: peça inteira visível (sem buracos internos, sem corte pela borda da foto)
     * @param reconstructionConfidence confiança de uma reconstrução — sempre 0: o pipeline não gera pixels
     * @param truncatedEdges       bordas da FOTO que cortam o produto
     * @param removed              o que saiu: HUMAN, OTHER_GARMENT, PROP, SMALL_COMPONENT…
     */
    public record Isolation(PixelMask garment, double humanResidue, double objectResidue, double occludedFraction,
                            double garmentCompleteness, double reconstructionConfidence, Set<Edge> truncatedEdges,
                            List<String> removed, List<String> warnings) {
    }

    /** Ângulo + apresentação estimados da foto. */
    public record ViewGuess(CatalogImageViewAngle angle, CatalogImagePresentation presentation, double confidence,
                            Map<String, Double> signals) {
    }

    /** Uma região semântica da peça (gola, cós, cadarço…), normalizada na imagem de trabalho. */
    public record SemanticRegion(String code, Region box, double weight, double confidence, boolean mustBeVisible,
                                 boolean signature, String source) {
    }

    /**
     * SemanticFocusRegion: onde o olho deve cair no card. {@code primary} = união ponderada das regiões de maior peso;
     * {@code visualCenter} = ponto do quadro (0–1) onde o centro do {@code primary} deve ficar.
     */
    public record SemanticFocusRegion(PieceType pieceType, String subcategory, Region primary, List<SemanticRegion> regions,
                                      double visualCenterX, double visualCenterY, String profileId) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("pieceType", pieceType.name());
            m.put("subcategory", subcategory);
            m.put("primary", primary.toMap());
            m.put("visualCenter", List.of(Region.r(visualCenterX), Region.r(visualCenterY)));
            m.put("profile", profileId);
            m.put("regions", regions.stream().map(r -> {
                Map<String, Object> x = new LinkedHashMap<>();
                x.put("code", r.code());
                x.put("box", r.box().toMap());
                x.put("weight", r.weight());
                x.put("confidence", Region.r(r.confidence()));
                x.put("mustBeVisible", r.mustBeVisible());
                x.put("signature", r.signature());
                x.put("source", r.source());
                return x;
            }).toList());
            return m;
        }
    }

    // ───────────────────────────────────────────────────────── configuração por subcategoria

    /**
     * Regra de uma região semântica no registro (relativa à caixa do produto, 0–1), opcionalmente ancorada num landmark
     * do {@code LandmarkDetector} (a caixa é centrada nele).
     */
    public record RegionRule(String code, double weight, boolean mustBeVisible, boolean signature, String anchorLandmark,
                             Region relativeBox) {
    }

    /**
     * Perfil de enquadramento de uma subcategoria (Semantic Region Registry). Todos os limites são do quadro final.
     *
     * @param occupancyMin/Max   ocupação do lado limitante (0.70–0.90)
     * @param marginMin/Max      margem de segurança mínima/máxima por lado (0.04–0.08)
     * @param widthTarget        calçados: fração da largura do quadro ocupada (0.85–0.95); null nos demais
     * @param cuttableEdges      por onde o CARD pode cortar a peça (calça: BOTTOM; o MASTER nunca corta)
     * @param minCardPreservation fração mínima da peça que o card mantém visível
     * @param visualCenterX/Y    onde o centro da região de foco deve cair no card
     * @param baseline           calçado: base (sola) numa linha fixa em vez de centralizar
     * @param maxUpscale         ampliação máxima da fonte (acima disso a peça fica menor — nunca "inventa" detalhe)
     * @param detailRegion       código da região que vira a variante DETAIL
     * @param gate               limiares do Quality Gate que diferem do padrão do tipo de peça
     */
    public record FramingProfile(String id, PieceType pieceType, List<String> subcategories, List<RegionRule> regions,
                                 double occupancyMin, double occupancyMax, double marginMin, double marginMax,
                                 double[] widthTarget, Set<Edge> cuttableEdges, double minCardPreservation,
                                 double visualCenterX, double visualCenterY, boolean baseline, double maxUpscale,
                                 String detailRegion, Map<String, Double> gate) {
    }

    // ───────────────────────────────────────────────────────── enquadramento

    /** Partes da nota de um enquadramento (0–1 cada; total ponderado, menos penalidades). */
    public record CropScore(double total, double occupancy, double preservation, double focus, double centering,
                            double margin, List<String> penalties) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("total", Region.r(total));
            m.put("occupancy", Region.r(occupancy));
            m.put("preservation", Region.r(preservation));
            m.put("focus", Region.r(focus));
            m.put("centering", Region.r(centering));
            m.put("margin", Region.r(margin));
            m.put("penalties", penalties);
            return m;
        }
    }

    /**
     * Plano de enquadramento: a JANELA da imagem de trabalho (normalizada; pode passar de 0–1, o fundo completa — smart
     * padding) que vira o quadro inteiro. Mesma proporção do quadro ⇒ escala uniforme, nunca estica.
     *
     * @param window             janela na imagem de trabalho (proporção = proporção do quadro em pixels de trabalho)
     * @param scale              pixels do quadro por pixel da FONTE em resolução cheia (> 1 = ampliação)
     * @param occupancy          lado limitante do produto ÷ lado do quadro
     * @param areaOccupancy      área da caixa do produto ÷ área do quadro
     * @param widthOccupancy     largura do produto ÷ largura do quadro
     * @param margins            margem livre por borda (fração do quadro): TOP, RIGHT, BOTTOM, LEFT
     * @param productPreservation fração da peça que fica dentro do quadro (1 = inteira)
     * @param focusVisibility    fração da região de foco dentro da área segura
     */
    public record CropPlan(Purpose purpose, CanvasSpec canvas, Region window, double scale, double occupancy,
                           double areaOccupancy, double widthOccupancy, Map<Edge, Double> margins,
                           double productPreservation, double focusVisibility, CropScore score, String strategy) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("purpose", purpose.name());
            m.put("aspect", canvas.aspect());
            m.put("canvas", List.of(canvas.width(), canvas.height()));
            m.put("window", window.toMap());
            m.put("scale", Region.r(scale));
            m.put("occupancy", Region.r(occupancy));
            m.put("areaOccupancy", Region.r(areaOccupancy));
            m.put("widthOccupancy", Region.r(widthOccupancy));
            Map<String, Object> mg = new LinkedHashMap<>();
            margins.forEach((k, v) -> mg.put(k.name().toLowerCase(), Region.r(v)));
            m.put("margins", mg);
            m.put("productPreservation", Region.r(productPreservation));
            m.put("focusVisibility", Region.r(focusVisibility));
            m.put("score", score.toMap());
            m.put("strategy", strategy);
            m.put("stretched", false);
            return m;
        }
    }

    /** Entrada das estratégias de enquadramento: tudo em coordenadas da imagem de trabalho. */
    public record FramingInput(int workWidth, int workHeight, double workScale, Region productBox, PixelMask garment,
                               SemanticFocusRegion focus, FramingProfile profile, Set<Edge> truncatedEdges) {
    }

    // ───────────────────────────────────────────────────────── saída visual e qualidade

    /**
     * Variantes renderizadas (só no modo MATERIALIZED, ou em memória para métricas/overlay). Chave = nome da variante
     * (MASTER_TRANSPARENT, MASTER_WHITE, MASTER_NEUTRAL, CARD, SQUARE, THUMBNAIL, DETAIL, AI_ANALYSIS).
     */
    public record RenderedSet(Map<String, BufferedImage> variants, String cardBackgroundHex, List<String> operations) {
    }

    /** Fidelidade do produto entre a fonte e o master (nada de pixel inventado, cor e nitidez preservadas). */
    public record DetailReport(double meanDeltaE, double p95DeltaE, double sharpnessRatio, double logoSharpnessRatio,
                               double edgeHalo, boolean generative, List<String> warnings) {
    }

    /** Métricas de qualidade (chave → valor 0–1 ou unidade indicada na doc). Ver ImageQualityAnalyzer. */
    public record QualityReport(Map<String, Double> metrics, List<String> flags) {
        public double get(String k) {
            return metrics.getOrDefault(k, Double.NaN);
        }
    }

    public enum Decision { APPROVED, NEEDS_REVIEW, REJECTED }

    /**
     * Nível do resultado aprovado. MASTER: foto de catálogo FashionAI materializada (recorte limpo, fundo normalizado,
     * todos os critérios). FRAMED_PACKSHOT: modo PARAMETRIC sobre packshot de fundo liso, sem pessoa — visualmente
     * equivalente ao master. FRAMED_REFERENCE: modo PARAMETRIC sobre foto com modelo/cena — referência oficial
     * enquadrada, abaixo dos packshots; não é um master.
     */
    public enum Tier { MASTER, FRAMED_PACKSHOT, FRAMED_REFERENCE, NONE }

    /** Saída do Quality Gate: decisão, nível, nota 0–100, motivos (códigos estáveis, i18n no front) e avisos. */
    public record GateDecision(Decision decision, Tier tier, double score, List<String> reasons, List<String> warnings) {
    }

    /** Próximo passo quando o candidato não passa: outra foto, outro ângulo, revisão humana ou recusa. */
    public enum Fallback { NONE, ALTERNATE_IMAGE, ALTERNATE_VIEW, MANUAL_REVIEW, REJECT }

    /** Pontuação de um candidato (ImageCandidateScore) e o porquê. */
    public record CandidateScore(CandidateRef ref, double score, ViewGuess view, Map<String, Double> parts,
                                 List<String> disqualifiers, boolean duplicateOfBetter) {
        public boolean eligibleForMaster() {
            return disqualifiers.isEmpty() && !duplicateOfBetter;
        }
    }

    /** Uma etapa executada (log estruturado + trilha do job). */
    public record StageRecord(String stage, String status, long millis, Map<String, Object> detail) {
    }

    /**
     * Resultado de uma foto no pipeline. {@code frames} = enquadramentos para exibir a URL oficial (modo PARAMETRIC) —
     * chave = aspecto ("4:5", "1:1") → janela normalizada na FONTE + cor de fundo.
     */
    public record ImageOutcome(CandidateRef ref, CatalogImageProcessingMode mode, SourceImage source, ViewGuess view,
                               Segmentation segmentation, Isolation isolation, SemanticFocusRegion focus,
                               Map<Purpose, CropPlan> plans, RenderedSet rendered, DetailReport detail,
                               QualityReport quality, GateDecision decision, Fallback fallback,
                               Map<String, Object> frames, List<StageRecord> stages) {
    }

    /** Resultado do produto: todas as candidatas analisadas e a escolhida (CANONICAL_PRODUCT_IMAGE). */
    public record ProductOutcome(UUID productId, List<CandidateScore> ranking, List<ImageOutcome> outcomes,
                                 ImageOutcome canonical, Fallback fallback, List<String> notes) {
    }
}
