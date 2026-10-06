package br.com.fashionai.application.catalog.image;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * ImageCandidateScore e escolha da CANONICAL_PRODUCT_IMAGE entre as fotos oficiais do produto.
 * Score = 0,6 qualidade + 0,3 preferência de vista (FRONT/PACKSHOT › TOP › SIDE › BACK › SOLE › OTHER) + 0,1 aprovado.
 * Só foto APPROVED e que não é de detalhe vira canônica; detalhe vira DETAIL; a mesma foto em outra URL (pHash ≤ 6)
 * vira DUPLICATE (só de uma CANONICAL/ALTERNATE já escolhida). Sem nenhuma aprovada, não há canônica: o card segue com a foto principal antiga e o produto entra
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

    public static double score(Candidate c) {
        double view = VIEW_PREFERENCE.getOrDefault(c.imageType() == null ? "OTHER" : c.imageType(), 0.6);
        return 0.6 * c.quality() + 0.3 * view + (c.outcome() == CatalogImageValidator.Outcome.APPROVED ? 0.1 : 0);
    }

    public List<Ranked> rank(List<Candidate> candidates) {
        List<Candidate> sorted = new ArrayList<>(candidates);
        sorted.sort(Comparator.comparingDouble(ImageCandidateRanker::score).reversed());
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
            // só quem pode ser canônica/alternativa ancora duplicatas: um detalhe ou uma foto em revisão com score alto
            // não pode transformar a vista principal aprovada em DUPLICATE e deixar o produto sem canônica
            if ((role == Role.CANONICAL || role == Role.ALTERNATE) && c.phash() != null) {
                kept.put(c.id(), c.phash());
            }
            out.add(new Ranked(c, score(c), role));
        }
        return out;
    }
}
