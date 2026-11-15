package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;

import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Vagas de desafio de uma pessoa (RF36.CA06): no máximo {@code max} desafios ativos ao mesmo tempo, e nunca dois do
 * mesmo desafio em andamento (dois 10×10 ativos na mesma conta dobravam a contagem "jogando agora" e a restrição de
 * peças). Puro: recebe as participações já lidas ({@code ChallengeService.mineRaw}).
 */
final class ChallengeSlotPolicy {
    private ChallengeSlotPolicy() {
    }

    private static boolean running(Map<String, Object> m) {
        return ChallengeService.ATIVO.equals(m.get("state")) || ChallengeService.AGUARDANDO.equals(m.get("state"));
    }

    /** 409 LIMITE_DESAFIOS com a lista dos ativos quando a pessoa já ocupa todas as vagas. */
    static void requireSlot(long active, int max, Supplier<List<Map<String, Object>>> mine) {
        if (active < max) {
            return;
        }
        List<Map<String, Object>> list = mine.get().stream().filter(ChallengeSlotPolicy::running)
                .map(m -> Map.<String, Object>of("id", m.get("id"), "name", m.get("name"))).toList();
        throw new ApiException(409, "LIMITE_DESAFIOS", Msg.t("challenge.voce_ja_tem_desafios_ativos", max), Map.of("active", list));
    }

    /** 409 DESAFIO_JA_ATIVO quando a pessoa já joga (ou espera começar) este mesmo desafio. */
    static void requireNotPlaying(List<Map<String, Object>> mine, String code, String name) {
        for (Map<String, Object> m : mine) {
            if (running(m) && code.equals(m.get("code")) && ChallengeService.P_ATIVO.equals(m.get("myStatus"))) {
                throw new ApiException(409, "DESAFIO_JA_ATIVO", Msg.t("challenge.voce_ja_joga_este_desafio", name), Map.of("active", m.get("id")));
            }
        }
    }
}
