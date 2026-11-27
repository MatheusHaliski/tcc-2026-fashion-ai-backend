package br.com.fashionai.application.service;

import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.enums.HypeLevel;

/**
 * Circuito Aura (fase 1) — faixa mínima de Hype de uma oferta de cupom (promoção de selo ou combinação FLAIR), irmã do
 * {@link CouponMinimumRules}. A oferta guarda o código da faixa ({@code min_hype_level}); vazio = oferta sem exigência,
 * que é o caso de toda oferta antiga. O cupom só é emitido quando o card apresentado tem Hype público e atualizado na
 * faixa pedida ou acima, e guarda a faixa dessa hora: queda posterior não revoga cupom já emitido.
 *
 * <p>Só lê o Hype: nada aqui grava sinal nem muda nota.</p>
 */
public final class CouponHypeRules {
    public static final String INVALIDA = "FAIXA_HYPE_INVALIDA";
    public static final String INSUFICIENTE = "HYPE_INSUFICIENTE";

    private CouponHypeRules() {
    }

    /** Faixa vinda do formulário da oferta: vazio = sem exigência; código fora das seis faixas = 400. */
    public static String resolve(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        HypeLevel level = parse(raw);
        if (level == null) {
            String valid = Arrays.stream(HypeLevel.values()).map(Enum::name).collect(Collectors.joining(", "));
            throw ApiException.badRequest(INVALIDA, Msg.t("coupon.hype_faixa_invalida", valid));
        }
        return level.name();
    }

    /** Código gravado → faixa; nulo quando vazio ou desconhecido (dado antigo nunca derruba a leitura). */
    public static HypeLevel parse(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        try {
            return HypeLevel.valueOf(code.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** A faixa do card atende à oferta? Oferta sem exigência atende sempre; card sem Hype que conte, nunca. */
    public static boolean meets(String minimum, HypeLevel current) {
        HypeLevel min = parse(minimum);
        return min == null || current != null && current.ordinal() >= min.ordinal();
    }

    /** Barra a emissão quando a oferta exige faixa e o card não chegou lá: 409 e nada é emitido. */
    public static void require(String minimum, HypeLevel current) {
        if (!meets(minimum, current)) {
            throw insufficient(minimum, current);
        }
    }

    public static ApiException insufficient(String minimum, HypeLevel current) {
        return ApiException.conflict(INSUFICIENTE, lockedText(parse(minimum), current));
    }

    /**
     * Campos de Hype na visão de uma oferta para quem a vê: a faixa exigida, a faixa atual do card apresentado, se
     * atende e, quando não, o texto de "travado". Devolve se atende.
     */
    public static boolean offerView(Map<String, Object> view, String minimum, HypeLevel current) {
        HypeLevel min = parse(minimum);
        boolean met = meets(minimum, current);
        view.put("minHypeLevel", min == null ? null : min.name());
        view.put("hypeCurrentLevel", min == null || current == null ? null : current.name());
        view.put("hypeMet", met);
        view.put("hypeLockedReason", met ? null : lockedText(min, current));
        return met;
    }

    /** "Travado: falta chegar a Em alta (o card está em Relevante)" — ou, sem Hype que conte, o motivo. */
    public static String lockedText(HypeLevel minimum, HypeLevel current) {
        String need = Msg.t("aura.faixa." + minimum.name());
        return current == null ? Msg.t("coupon.hype_travado_sem_hype", need) : Msg.t("coupon.hype_travado", need, Msg.t("aura.faixa." + current.name()));
    }
}
