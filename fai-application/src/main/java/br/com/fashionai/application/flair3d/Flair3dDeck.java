package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.CbcRules;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Regras do deck da partida (BASE_NUCLEOS.md, "O deck da partida"): tamanho máximo, sem repetição e as posições
 * obrigatórias. As cartas já chegam conferidas como da pessoa ({@link Flair3dCartas}).
 */
public final class Flair3dDeck {
    private Flair3dDeck() {
    }

    /** O que falta em cada obrigatória (vazio quando o deck cumpre todas). */
    public static List<Definicao.Obrigatoria> faltam(Definicao.Deck deck, Map<UUID, CbcRules.Card> cartas) {
        List<Definicao.Obrigatoria> out = new ArrayList<>();
        for (Definicao.Obrigatoria o : deck.obrigatorias()) {
            Set<String> posicoes = Set.of(o.posicao().split("\\|"));
            long tem = cartas.values().stream()
                    .filter(c -> posicoes.contains(CbcRules.ANY) || posicoes.contains(c.position()))
                    .count();
            if (tem < o.quantidade()) {
                out.add(new Definicao.Obrigatoria(o.posicao(), (int) (o.quantidade() - tem)));
            }
        }
        return out;
    }

    /** 422 DECK_INVALIDO com tamanho, máximo, repetidas e o que falta; nos núcleos sem deck não confere nada. */
    public static void validar(Definicao.Deck deck, List<UUID> ids, Map<UUID, CbcRules.Card> cartas) {
        if (deck.semDeck()) {
            return;
        }
        List<Definicao.Obrigatoria> faltam = faltam(deck, cartas);
        boolean repetidas = ids.size() != cartas.size();
        boolean grande = deck.tamanhoMax() != null && ids.size() > deck.tamanhoMax();
        if (faltam.isEmpty() && !repetidas && !grande && !ids.isEmpty()) {
            return;
        }
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("tamanho", ids.size());
        detalhes.put("tamanhoMax", deck.tamanhoMax());
        detalhes.put("repetidas", repetidas);
        detalhes.put("faltam", faltam);
        throw Flair3dErros.invalido("DECK_INVALIDO", "deck_invalido", detalhes);
    }

    /** Lê o deck gravado na partida ("[id, ...]"). */
    public static List<UUID> ids(String json) {
        return json == null ? List.of() : Json.uuids(json);
    }
}
