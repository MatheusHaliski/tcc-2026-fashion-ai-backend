package br.com.fashionai.application.acervo;

import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.acervo.AcervoCompartimento;
import br.com.fashionai.domain.model.acervo.AcervoMovel;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Modo arrumação: proposta de lugar para cada peça, sem gravar nada. A regra é simples e explicável: o tipo de
 * compartimento vem do tipo da peça (pendurar, dobrar, guardar em gaveta); entre os compartimentos desse tipo, ganha o
 * que já tem mais peças iguais e, no empate, o mais vazio. Só entram móveis do modo "Meu espaço" (o guarda-roupa real).
 */
final class AcervoArrumacao {
    record Movimento(WardrobeItem peca, UUID de, UUID para, String tipo) { }
    record Plano(List<Movimento> movimentos, List<WardrobeItem> semDestino) { }

    private static final Set<String> PENDURAR = Set.of("shirt", "blazer", "jacket", "coat", "trench_coat", "overcoat", "parka",
            "dress", "suit", "vest", "cardigan", "kimono", "jumpsuit");
    private static final Set<String> DOBRAR = Set.of("sweater", "hoodie", "sweatshirt", "knit", "pullover");

    private AcervoArrumacao() {
    }

    /** Tipo de compartimento que combina com a peça. */
    static String tipoPara(WardrobeItem w) {
        String categoria = w.getCategory() == null ? "" : w.getCategory();
        String sub = w.getSubcategory() == null ? "" : w.getSubcategory().toLowerCase(java.util.Locale.ROOT);
        if (categoria.equals("accessory_piece")) {
            return AcervoCompartimento.GAVETA;
        }
        if (categoria.equals("shoes_piece") || categoria.equals("lower_piece")) {
            return AcervoCompartimento.PRATELEIRA;
        }
        if (categoria.equals("full_body_piece") || PENDURAR.contains(sub)) {
            return AcervoCompartimento.CABIDEIRO;
        }
        if (DOBRAR.contains(sub)) {
            return AcervoCompartimento.PRATELEIRA;
        }
        return AcervoCompartimento.GAVETA;
    }

    /**
     * @param pecas  peças a arrumar, na ordem em que serão colocadas
     * @param todas  todas as peças da pessoa (para saber o que já está em cada compartimento)
     */
    static Plano plano(List<WardrobeItem> pecas, List<WardrobeItem> todas, AcervoMapa mapa) {
        List<AcervoCompartimento> reais = mapa.compartimentos.stream()
                .filter(c -> {
                    AcervoMovel m = mapa.movelDe(c);
                    return m != null && AcervoMovel.MEU_ESPACO.equals(m.getModo());
                })
                .toList();
        Map<UUID, Integer> ocupacao = new HashMap<>();
        Map<String, Integer> iguais = new HashMap<>();
        for (WardrobeItem w : todas) {
            UUID lugar = mapa.lugar(w.getId());
            if (lugar != null) {
                ocupacao.merge(lugar, 1, Integer::sum);
                iguais.merge(lugar + "|" + w.getSubcategory(), 1, Integer::sum);
            }
        }
        List<Movimento> movimentos = new ArrayList<>();
        List<WardrobeItem> semDestino = new ArrayList<>();
        for (WardrobeItem w : pecas) {
            String tipo = tipoPara(w);
            UUID atual = mapa.lugar(w.getId());
            AcervoCompartimento onde = mapa.compartimento(atual);
            if (onde != null && onde.getTipo().equals(tipo) && reais.contains(onde)) {
                continue;
            }
            AcervoCompartimento melhor = reais.stream()
                    .filter(c -> c.getTipo().equals(tipo))
                    .max(Comparator
                            .comparingInt((AcervoCompartimento c) -> iguais.getOrDefault(c.getId() + "|" + w.getSubcategory(), 0))
                            .thenComparingInt(c -> -ocupacao.getOrDefault(c.getId(), 0))
                            .thenComparingInt(c -> -reais.indexOf(c)))
                    .orElse(null);
            if (melhor == null) {
                semDestino.add(w);
                continue;
            }
            movimentos.add(new Movimento(w, atual, melhor.getId(), tipo));
            ocupacao.merge(melhor.getId(), 1, Integer::sum);
            iguais.merge(melhor.getId() + "|" + w.getSubcategory(), 1, Integer::sum);
            if (atual != null) {
                ocupacao.merge(atual, -1, Integer::sum);
            }
        }
        return new Plano(movimentos, semDestino);
    }
}
