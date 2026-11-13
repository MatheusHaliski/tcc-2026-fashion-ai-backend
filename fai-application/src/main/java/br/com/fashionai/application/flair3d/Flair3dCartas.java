package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcCardMapper;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.service.FlairCollectionService;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

/**
 * As cartas FLAIR da pessoa no formato do motor (o mesmo caminho do FlairGameService: {@link CbcCardMapper} com as tags
 * de {@link FlairCollectionService#tagsOf}) e o país das marcas. Compartilhado pelos núcleos, pelo MAKE UP e pelos
 * elencos: carta inexistente ou de outra pessoa é 422 CARTA_ALHEIA.
 */
@Component
public class Flair3dCartas {
    private final FlairCardInstanceRepository cards;
    private final WardrobeItemRepository pieces;
    private final BrandRepository brands;

    public Flair3dCartas(FlairCardInstanceRepository cards, WardrobeItemRepository pieces, BrandRepository brands) {
        this.cards = cards;
        this.pieces = pieces;
        this.brands = brands;
    }

    /** As cartas pedidas, todas da pessoa (na ordem pedida, sem repetição). */
    public Map<UUID, CbcRules.Card> daPessoa(UUID userId, Collection<UUID> ids) {
        Set<UUID> pedidas = new LinkedHashSet<>();
        ids.stream().filter(Objects::nonNull).forEach(pedidas::add);
        if (pedidas.isEmpty()) {
            return Map.of();
        }
        List<FlairCardInstance> achadas = cards.findAllById(pedidas).stream().filter(c -> userId.equals(c.getOwnerId())).toList();
        Set<UUID> minhas = new LinkedHashSet<>();
        achadas.forEach(c -> minhas.add(c.getId()));
        List<UUID> alheias = pedidas.stream().filter(id -> !minhas.contains(id)).toList();
        if (!alheias.isEmpty()) {
            throw Flair3dErros.cartaAlheia(alheias);
        }
        return CbcCardMapper.models(achadas, pieces, FlairCollectionService::tagsOf);
    }

    /** País (ISO 2) de uma marca pelo nome, com memória por requisição. */
    public Function<String, String> paises() {
        Map<String, String> memoria = new HashMap<>();
        return nome -> nome == null || nome.isBlank() ? null : memoria.computeIfAbsent(nome.trim().toLowerCase(Locale.ROOT),
                k -> brands.findFirstByNameIgnoreCase(nome.trim()).map(Brand::getCountry).orElse(""));
    }

    public Contexto contexto(Map<UUID, CbcRules.Card> cartas, long semente) {
        return new Contexto(cartas, paises(), new Random(semente));
    }
}
