package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Carta FLAIR ({@link FlairCardInstance}) no formato do motor ({@link CbcRules.Card}): as tags vêm do retrato da geração
 * ({@code tags_json}) ou, em cartas antigas, da peça (função {@code tagsOf}); os números de Hype do retrato; as datas
 * ("entrou em", "última vez usada") da peça viva. Compartilhado pelos Desafios de Montagem e pelos jogos do FLAIR 3D MAKE UP.
 */
public final class CbcCardMapper {
    private CbcCardMapper() {
    }

    /** As peças vivas das cartas de origem PIECE, por id (uma leitura para a lista toda). */
    public static Map<UUID, WardrobeItem> pieces(Collection<FlairCardInstance> list, WardrobeItemRepository pieces) {
        Set<UUID> ids = list.stream().filter(c -> "PIECE".equals(c.getOriginType())).map(FlairCardInstance::getOriginId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        return pieces.findAllById(ids).stream().collect(Collectors.toMap(WardrobeItem::getId, Function.identity()));
    }

    public static Map<UUID, CbcRules.Card> models(Collection<FlairCardInstance> list, WardrobeItemRepository pieces,
                                                  Function<WardrobeItem, Map<String, Object>> tagsOf) {
        return models(list, pieces(list, pieces), tagsOf);
    }

    /** Cartas no formato do motor, na ordem da lista; {@code byId} são as peças já carregadas. */
    public static Map<UUID, CbcRules.Card> models(Collection<FlairCardInstance> list, Map<UUID, WardrobeItem> byId,
                                                  Function<WardrobeItem, Map<String, Object>> tagsOf) {
        Map<UUID, CbcRules.Card> out = new LinkedHashMap<>();
        for (FlairCardInstance c : list) {
            WardrobeItem w = "PIECE".equals(c.getOriginType()) ? byId.get(c.getOriginId()) : null;
            out.put(c.getId(), model(c, w, tagsOf));
        }
        return out;
    }

    public static CbcRules.Card model(FlairCardInstance c, WardrobeItem w, Function<WardrobeItem, Map<String, Object>> tagsOf) {
        Map<String, Object> tags = c.getTagsJson() != null ? Json.map(c.getTagsJson()) : tagsOf.apply(w);
        Map<String, Double> hype = new HashMap<>();
        if (c.getHypeJson() != null) {
            Json.map(c.getHypeJson()).forEach((k, v) -> {
                if (v instanceof Number n) {
                    hype.put(k, n.doubleValue());
                }
            });
        }
        Instant added = null;
        LocalDate lastWorn = null;
        if (w != null) {
            added = w.getCreatedAt();
            if (w.getPurchaseDate() != null) {
                // comprada antes de entrar no app: vale a data da compra (C2 olha a compra, não o cadastro)
                Instant bought = w.getPurchaseDate().atStartOfDay(ZoneOffset.UTC).toInstant();
                added = added == null || bought.isBefore(added) ? bought : added;
            }
            lastWorn = w.getLastWornDate();
        }
        return new CbcRules.Card(c.getId(), c.getPosition(), c.getTier(), c.getOvr(), c.getBrandName(), c.getOriginType(),
                Set.copyOf(strings(tags.get("styles"))), Set.copyOf(strings(tags.get("colors"))), Set.copyOf(strings(tags.get("occasions"))),
                Set.copyOf(strings(tags.get("materials"))), hype, added, lastWorn, c.getCategory(), c.getSubcategory());
    }

    static List<String> strings(Object v) {
        if (v instanceof Collection<?> c) {
            return c.stream().filter(Objects::nonNull).map(String::valueOf).toList();
        }
        if (v instanceof String s && !s.isBlank()) {
            return List.of(s);
        }
        return List.of();
    }
}
