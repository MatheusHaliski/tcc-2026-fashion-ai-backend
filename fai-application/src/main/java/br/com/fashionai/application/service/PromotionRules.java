package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import br.com.fashionai.domain.model.enums.PromotionType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Regras puras das promoções de selo (RF20.CA11–CA13 / RF21.CA21–CA23 / RNF12), extraídas de {@link SealService}:
 * campos do formulário, link https da loja, motivo de indisponibilidade (período, cota, selo ativo), vínculo elegível e
 * prefixo do código do cupom. Sem repositório, Spring ou relógio global: quem chama passa o instante de referência.
 * O {@link SealService} continua dono da transação, da autorização, das consultas, do bloqueio da promoção no resgate
 * e da unicidade do código.
 */
final class PromotionRules {
    /** Tipos que uma marca pode criar; os demais (show, meet &amp; greet, pré-venda…) são exclusivos de celebridade. */
    static final Set<PromotionType> BRAND_TYPES = Set.of(PromotionType.DESCONTO_ECOMMERCE, PromotionType.CUPOM_LOJA,
            PromotionType.FRETE_GRATIS, PromotionType.BRINDE, PromotionType.ACESSO_ANTECIPADO, PromotionType.EVENTO);

    private PromotionRules() {
    }

    // ------------------------------------------------------------------ formulário (na ordem em que o serviço checa)

    /** Checado antes de consultar o perfil do emissor. */
    static void requireType(PromotionType type) {
        if (type == null) {
            throw ApiException.badRequest("TIPO_OBRIGATORIO", Msg.t("seal.escolha_o_tipo_da_promocao"));
        }
    }

    static void requireTypeFor(PromotionType type, boolean celebrity) {
        if (!celebrity && !BRAND_TYPES.contains(type)) {
            throw ApiException.badRequest("TIPO_INVALIDO", Msg.t("seal.tipo_exclusivo_de_promocoes_de"));
        }
    }

    /** Desconto opcional entre 1 e 90 %. */
    static Integer discountPercent(Integer pct) {
        if (pct != null && (pct < 1 || pct > 90)) {
            throw ApiException.badRequest("DESCONTO_INVALIDO", Msg.t("seal.desconto_entre_1_e_90"));
        }
        return pct;
    }

    /** O término pode coincidir com o início, mas não vir antes. */
    static void requirePeriod(Instant startsAt, Instant expiresAt) {
        if (startsAt != null && expiresAt != null && expiresAt.isBefore(startsAt)) {
            throw ApiException.badRequest("PERIODO_INVALIDO", Msg.t("seal.a_promocao_termina_antes_de"));
        }
    }

    /** Limite por pessoa: ausente vira 1 e nunca fica abaixo de 1. */
    static int perUserLimit(Integer raw) {
        return raw == null ? 1 : Math.max(1, raw);
    }

    static String requiredSealKind(boolean celebrity) {
        return celebrity ? "PREMIUM_SEAL" : "BRAND_SEAL";
    }

    // ------------------------------------------------------------------ links externos

    /** Link http(s) de loja terceira (ou nulo); só https com host é aceito. */
    static String storeUrl(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String v = raw.trim();
        if (httpsOnly(v) == null) {
            throw ApiException.badRequest("LINK_INVALIDO", Msg.t("seal.informe_o_link_da_loja"));
        }
        return v;
    }

    /** Link externo exibido ao usuário (loja, cupom): só https com host; o resto (http, javascript:, data:…) vira null. */
    static String httpsOnly(String raw) {
        if (raw == null) {
            return null;
        }
        String v = raw.trim();
        if (!v.matches("(?i)https://[^\\s/?#]+[^\\s]{0,500}")) {
            return null;
        }
        try {
            java.net.URI uri = java.net.URI.create(v);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getHost().contains(".") ? v : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    // ------------------------------------------------------------------ disponibilidade e elegibilidade

    /** Motivo pelo qual a promoção não pode ser resgatada em {@code now}, ou null se está disponível. */
    static String unavailable(Promotion p, Instant now) {
        if (p.getStatus() != PromotionStatus.AVAILABLE) {
            return Msg.t("seal.promocao_2", (p.getStatus() == PromotionStatus.EXPIRED ? "expirada" : Msg.t("seal.indisponivel")));
        }
        if (p.getStartsAt() != null && p.getStartsAt().isAfter(now)) {
            return Msg.t("seal.a_promocao_comeca_em", p.getStartsAt());
        }
        if (p.getExpiresAt() != null && !p.getExpiresAt().isAfter(now)) {
            return Msg.t("seal.promocao_expirada");
        }
        if (p.getTotalQuota() != null && p.getRedeemedCount() >= p.getTotalQuota()) {
            return Msg.t("seal.promocao_esgotada");
        }
        if (p.getSeal() != null && p.getSeal().getStatus() != SealStatus.ACTIVE) {
            return Msg.t("seal.o_selo_desta_promocao_esta");
        }
        return null;
    }

    /** Primeiro vínculo aprovado, ainda válido em {@code now} e do selo exigido pela promoção (se houver). */
    static SealBond eligibleBond(Promotion p, List<SealBond> candidates, Instant now) {
        return candidates.stream().filter(b -> b.getStatus() == SealBondStatus.APPROVED)
                .filter(b -> b.getExpiresAt() == null || b.getExpiresAt().isAfter(now))
                .filter(b -> p.getSeal() == null || (b.getSeal() != null && b.getSeal().getId().equals(p.getSeal().getId())))
                .findFirst().orElse(null);
    }

    /** Consentimento da parceira: entre os vínculos aprovados da celebridade, algum para a marca e ainda válido. */
    static boolean partnerBondValid(List<SealBond> approvedBonds, UUID partnerId, Instant now) {
        return approvedBonds.stream()
                .anyMatch(b -> b.getTargetOwner().getId().equals(partnerId) && (b.getExpiresAt() == null || b.getExpiresAt().isAfter(now)));
    }

    // ------------------------------------------------------------------ código do cupom

    /**
     * Prefixo do código: até 5 caracteres alfanuméricos do @ do emissor e, com marca parceira, "X" + até 4 do @ dela.
     * {@code partnerUsername} null significa promoção sem parceira.
     */
    static String codePrefix(String ownerUsername, String partnerUsername) {
        String prefix = ownerUsername.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        prefix = prefix.substring(0, Math.min(5, prefix.length()));
        if (partnerUsername != null) {
            String partner = partnerUsername.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
            prefix = prefix + "X" + partner.substring(0, Math.min(4, partner.length()));
        }
        return prefix;
    }
}
