package br.com.fashionai.application.catalog.image;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * ImageCandidateScore e escolha da CANONICAL_PRODUCT_IMAGE entre as fotos oficiais do produto.
 * Score = 0,6 qualidade + 0,3 preferência de vista + 0,1 aprovado. A vista preferida segue a Regra de Enquadramento
 * (§9.1): peça de cima e acessório FRONT/PACKSHOT › TOP › SIDE › BACK; peça de baixo BACK primeiro; calçado SIDE primeiro.
 * Só foto APPROVED e que não é de detalhe vira canônica; detalhe vira DETAIL; a mesma foto em outra URL (pHash ≤ 6)
 * vira DUPLICATE. Sem nenhuma aprovada, não há canônica: o card segue com a foto principal antiga e o produto entra
 * na fila de revisão (fallback: outra foto → outra vista → revisão manual → rejeição).
 */
public final class ImageCandidateRanker {
    public enum Role { CANONICAL, ALTERNATE, DETAIL, DUPLICATE, REJECTED, REVIEW }

    public record Candidate(String id, String imageType, CatalogImageValidator.Outcome outcome, double quality, boolean detailView,
                            String phash) {
    }

    public record Ranked(Candidate candidate, double score, Role role) {
    }

    static final Map<String, Double> VIEW_PREFERENCE = Map.of("FRONT", 1.0, "PACKSHOT", 1.0, "TOP", 0.8, "SIDE", 0.7,
            "BACK", 0.5, "SOLE", 0.3, "OTHER", 0.6, "DETAIL", 0.1);

    /** Peça de baixo: a vista de trás mostra cós, patch e bolsos traseiros. Calçado: a lateral mostra o comprimento todo. */
    static final Map<PieceType, Map<String, Double>> VIEW_PREFERENCE_BY_TYPE = Map.of(
            PieceType.LOWER_PIECE, Map.of("BACK", 1.0, "FRONT", 0.6, "PACKSHOT", 0.6, "TOP", 0.5, "SIDE", 0.4, "SOLE", 0.2,
                    "OTHER", 0.5, "DETAIL", 0.1),
            PieceType.SHOES_PIECE, Map.of("SIDE", 1.0, "PACKSHOT", 0.8, "FRONT", 0.6, "TOP", 0.6, "BACK", 0.4, "SOLE", 0.3,
                    "OTHER", 0.5, "DETAIL", 0.1));

    public static double score(Candidate c) {
        return score(c, null);
    }

    public static double score(Candidate c, PieceType type) {
        Map<String, Double> pref = type == null ? VIEW_PREFERENCE : VIEW_PREFERENCE_BY_TYPE.getOrDefault(type, VIEW_PREFERENCE);
        double view = pref.getOrDefault(c.imageType() == null ? "OTHER" : c.imageType(), 0.6);
        return 0.6 * c.quality() + 0.3 * view + (c.outcome() == CatalogImageValidator.Outcome.APPROVED ? 0.1 : 0);
    }

    public List<Ranked> rank(List<Candidate> candidates) {
        return rank(candidates, null);
    }

    public List<Ranked> rank(List<Candidate> candidates, PieceType type) {
        List<Candidate> sorted = new ArrayList<>(candidates);
        sorted.sort(Comparator.comparingDouble((Candidate c) -> score(c, type)).reversed());
        List<Ranked> out = new ArrayList<>();
        Map<String, String> kept = new LinkedHashMap<>();
        boolean canonical = false;
        for (Candidate c : sorted) {
            Role role;
            boolean dup = c.phash() != null && kept.values().stream().anyMatch(p -> PerceptualHash.distance(p, c.phash()) <= PerceptualHash.DUPLICATE_DISTANCE);
            if (c.outcome() == CatalogImageValidator.Outcome.REJECTED) {
                role = Role.REJECTED;
            } else if (dup) {
                role = Role.DUPLICATE;
            } else if (c.detailView() || "DETAIL".equals(c.imageType())) {
                role = Role.DETAIL;
            } else if (c.outcome() == CatalogImageValidator.Outcome.NEEDS_REPROCESSING) {
                role = Role.REVIEW;
            } else if (!canonical) {
                role = Role.CANONICAL;
                canonical = true;
            } else {
                role = Role.ALTERNATE;
            }
            if (role != Role.REJECTED && role != Role.DUPLICATE && c.phash() != null) {
                kept.put(c.id(), c.phash());
            }
            out.add(new Ranked(c, score(c, type), role));
        }
        return out;
    }
}
