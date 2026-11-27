package br.com.fashionai.application.aura;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.fashionai.application.aura.AuraUnlocks.Item;
import br.com.fashionai.application.aura.AuraUnlocks.State;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.seal.SealHypeLookups;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SealHypeOffersService;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;

/**
 * Circuito Aura — leitura de "O que este card destrava" para uma peça ou look. A visibilidade é a mesma das rotas de
 * Hype (item privado só para o dono; o que a pessoa não pode ver responde como inexistente). Só lê: não grava sinal de
 * Hype, não recalcula nota, não emite cupom nem selo.
 */
@Service
public class AuraUnlocksService {
    private final HypeQueryService hype;
    private final SealHypeOffersService sealOffers;
    private final List<AuraUnlockProvider> providers;

    public AuraUnlocksService(HypeQueryService hype, SealHypeOffersService sealOffers, List<AuraUnlockProvider> providers) {
        this.hype = hype;
        this.sealOffers = sealOffers;
        this.providers = providers;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> unlocks(CurrentUser viewer, HypeEntityType type, UUID id) {
        // mesma regra de visibilidade do card: o resumo só traz o que quem pede pode ver
        Object visible = hype.summaries(viewer, type, List.of(id)).get("items");
        if (!(visible instanceof Map<?, ?> items) || !items.containsKey(id.toString())) {
            throw ApiException.notFound(type == HypeEntityType.PIECE ? Msg.t("common.peca") : Msg.t("entity.esquema"));
        }
        HypeScoreCurrent row = hype.currentOf(type, List.of(id)).get(id);
        State state = state(row, hype);
        List<Item> candidates = new ArrayList<>(AuraUnlockSources.flairBand(state));
        candidates.addAll(AuraUnlockSources.sealCampaigns(campaigns(viewer, type, id), state));
        for (AuraUnlockProvider provider : providers) {
            candidates.addAll(provider.items(viewer, type, id, state));
        }
        Map<String, Object> out = AuraUnlocks.assemble(state, hype.config().levelThresholds(), candidates).view();
        out.put("entityType", type.name());
        out.put("entityId", id.toString());
        return out;
    }

    /** Estado do Hype que vale para destravar: atualização pela mesma checagem dos selos de Hype. */
    static State state(HypeScoreCurrent row, HypeQueryService hype) {
        if (row == null) {
            return new State(null, null, null, false, false);
        }
        Double score = row.getScore() == null ? null : Math.round(row.getScore().doubleValue() * 10) / 10.0;
        return new State(row.getStatus(), score, row.getLevel(), row.isPublicEligible(), SealHypeLookups.freshHype(row, hype));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> campaigns(CurrentUser viewer, HypeEntityType type, UUID id) {
        Object list = sealOffers.offers(viewer, type, id, 0, 24).get("items");
        return list instanceof List<?> l ? (List<Map<String, Object>>) l : List.of();
    }
}
