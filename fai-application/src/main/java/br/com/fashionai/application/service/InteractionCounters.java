package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.DnaScheme;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;

/**
 * Normalização dos contadores persistidos de interação (RF19) no próprio conteúdo: qual campo cada interação move por
 * tipo de alvo e piso em zero (nunca contagem negativa). Função pura, sem repositório nem {@code CounterStorePort}: o
 * {@link SocialService} continua dono da transação e do espelho no store.
 * <p>
 * Campos: {@code likes}, {@code comments}, {@code shares}, {@code saves}, {@code remixes}. Só o look guarda
 * {@code saves}; peça e DNA ignoram esse campo (e qualquer campo desconhecido), assim como entidades que não sejam
 * look, peça ou DNA.
 */
final class InteractionCounters {
    private InteractionCounters() {
    }

    /** Soma {@code delta} ao contador {@code field} da entidade, com piso em zero. */
    static void apply(Object entity, String field, long delta) {
        switch (entity) {
            case Scheme s -> scheme(s, field, delta);
            case WardrobeItem w -> piece(w, field, delta);
            case DnaScheme d -> dna(d, field, delta);
            default -> {
            }
        }
    }

    private static long floor(long current, long delta) {
        return Math.max(0, current + delta);
    }

    private static void scheme(Scheme s, String field, long delta) {
        switch (field) {
            case "likes" -> s.setLikeCount(floor(s.getLikeCount(), delta));
            case "comments" -> s.setCommentCount(floor(s.getCommentCount(), delta));
            case "shares" -> s.setShareCount(floor(s.getShareCount(), delta));
            case "saves" -> s.setSaveCount(floor(s.getSaveCount(), delta));
            case "remixes" -> s.setRemixCount(floor(s.getRemixCount(), delta));
            default -> {
            }
        }
    }

    private static void piece(WardrobeItem w, String field, long delta) {
        switch (field) {
            case "likes" -> w.setLikesCount(floor(w.getLikesCount(), delta));
            case "comments" -> w.setCommentCount(floor(w.getCommentCount(), delta));
            case "shares" -> w.setSharesCount(floor(w.getSharesCount(), delta));
            case "remixes" -> w.setRemixesCount(floor(w.getRemixesCount(), delta));
            default -> {
            }
        }
    }

    private static void dna(DnaScheme d, String field, long delta) {
        switch (field) {
            case "likes" -> d.setLikeCount(floor(d.getLikeCount(), delta));
            case "comments" -> d.setCommentCount(floor(d.getCommentCount(), delta));
            case "shares" -> d.setShareCount(floor(d.getShareCount(), delta));
            case "remixes" -> d.setRemixCount(floor(d.getRemixCount(), delta));
            default -> {
            }
        }
    }
}
