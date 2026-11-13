package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Forma de uma entrega antes de pontuar: vagas, zonas e áreas que o núcleo usa, carta na vaga da posição dela, sem
 * carta repetida e, nos núcleos com deck, só cartas do deck (422).
 */
public final class Flair3dEntregas {
    private Flair3dEntregas() {
    }

    public static void conferir(Definicao d, Entrega e, Map<UUID, CbcRules.Card> cartas, List<UUID> deck) {
        if (!d.deck().semDeck()) {
            Set<UUID> doDeck = new HashSet<>(deck);
            List<UUID> fora = e.cartas().values().stream().filter(Objects::nonNull).filter(id -> !doDeck.contains(id)).toList();
            if (!fora.isEmpty()) {
                throw Flair3dErros.invalido("CARTA_FORA_DO_DECK", "carta_fora_do_deck", Map.of("cartas", fora));
            }
        }
        List<String> problemas = new ArrayList<>();
        e.cartas().keySet().stream().filter(v -> !d.vagas().contains(v)).forEach(v -> problemas.add("VAGA:" + v));
        e.zonas().keySet().stream().filter(z -> !d.zonas().contains(z)).forEach(z -> problemas.add("ZONA:" + z));
        e.maquiagem().keySet().stream().filter(a -> !d.areas().contains(a)).forEach(a -> problemas.add("AREA:" + a));
        Set<UUID> vistas = new HashSet<>();
        e.cartas().forEach((vaga, id) -> {
            CbcRules.Card c = id == null ? null : cartas.get(id);
            if (id != null && !vistas.add(id)) {
                problemas.add("REPETIDA:" + vaga);
            }
            if (c != null && d.vagas().contains(vaga) && !vaga.equals(c.position())) {
                problemas.add("POSICAO:" + vaga);
            }
        });
        if (!problemas.isEmpty()) {
            Map<String, Object> detalhes = new LinkedHashMap<>();
            detalhes.put("problemas", problemas);
            throw Flair3dErros.invalido("ENTREGA_INVALIDA", "entrega_invalida", detalhes);
        }
    }
}
