package br.com.fashionai.application.lens;

import br.com.fashionai.application.hype.RecommendationScoring;
import br.com.fashionai.application.view.Views;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF54 · Visões do FashionAI Lens expostas pela API (contrato do MVP: JSON camelCase, datas ISO-8601). O frontend nunca
 * recebe entidade nem chave de storage: a imagem sai só por {@code GET /api/lens/scans/{id}/image}, para o dono.
 */
public final class LensViews {
    private LensViews() {
    }

    /** Caixa em % (0–100) da imagem, canto superior esquerdo. */
    public record Box(double x, double y, double w, double h) {
    }

    /** Cor da peça: código da paleta oficial (name), hex da paleta e fração da peça (0–1); a principal vem primeiro. */
    public record ColorShare(String name, String hex, double share) {
    }

    /** Melhor correspondência no guarda-roupa da pessoa (similarity 0–100). */
    public record TopMatch(UUID pieceId, int similarity) {
    }

    /**
     * @param status DETECTED, CORRECTED, ADDED_BY_USER (DISMISSED só na resposta do próprio descarte)
     */
    public record DetectionView(UUID id, int ordinal, Box box, String label, String category, String subcategory,
                                List<ColorShare> colors, String material, String pattern, List<String> styles,
                                List<String> occasions, double confidence, String confidenceBand, String status,
                                boolean wanted, UUID ownedItemId, TopMatch topMatch) {
    }

    public record ScanView(UUID id, String status, String errorCode, String source, String intent, Instant createdAt,
                           Instant expiresAt, Instant savedAt, int width, int height, int facesRedacted, String aiSource,
                           String algorithmVersion, String modelVersion, List<DetectionView> detections, ReadingView reading) {
    }

    /** Componentes 0–100 da semelhança; visual/cor nulos quando a dimensão não entrou na conta. */
    public record Components(Integer visual, int attributes, Integer color) {
    }

    public record MatchView(String scope, String targetType, UUID targetId, int similarity, Components components,
                            List<String> reasons, Views.PieceView piece) {
    }

    public record Matches(List<MatchView> items) {
    }

    public record StyleShare(String key, int share) {
    }

    public record PaletteColor(String name, String hex) {
    }

    /** Compatibilidade com o DNA de estilo (StyleCompatibility): score 0–100 e os termos usados. */
    public record Fit(Number score, Map<String, Object> parts) {
    }

    /**
     * Hype do grupo de peças públicas parecidas (mesmo par de atributos), ou INSUFFICIENT_DATA com menos de 5 itens.
     *
     * @param key   chave do grupo no formato do HypeSnapshotService.attributeKeys (cc:/st:/cm:)
     * @param label "Jaqueta · Azul-claro", na língua de quem lê
     */
    public record Trend(String status, String key, String label, Integer score, String level, String direction, int items) {
    }

    /** Quantas peças próprias parecidas, quantas peças do look sem correspondência e quantas próprias quase iguais. */
    public record Impact(int ownedMatches, int gaps, int redundancy) {
    }

    public record ReadingView(List<StyleShare> styles, List<PaletteColor> palette, List<String> occasions, String season,
                              Fit fit, Trend trend, Impact impact) {
    }

    /** state: own (peça sua parecida), alternative (peça sua de outra subcategoria) ou gap (lacuna). */
    public record SlotView(String slot, UUID detectionId, String state, Views.PieceView piece, List<Views.PieceView> alternatives) {
    }

    public record RecreatePlan(String mode, List<SlotView> slots, List<UUID> pieceIds, RecommendationScoring.Scores scores,
                               String createHref) {
    }

    public record ScanCard(UUID id, Instant createdAt, Instant savedAt, String status, int detections, String topStyle,
                           int owned, int gaps) {
    }

    public record OwnResult(DetectionView detection, String href) {
    }
}
