package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dPecas;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * O adversário da casa da Batalha de Looks (reauditoria de 25/11/2026: "a nota do adversário é sorteada e não depende do
 * look dele"). Ele veste um look tirado da semente do guarda-roupa da casa (peças inventadas, sem marca), uma peça por
 * vaga, e esse look é avaliado pelas mesmas regras da rodada que o da pessoa: a nota dele muda com o desafio e é
 * reproduzível pela partida. A tela recebe as peças dele para vesti-lo e a família de cor dominante. Puro.
 */
final class BatalhaLooksAdversario {
    /** Cinco peças por vaga, de cores, ocasiões e materiais diferentes: nenhum desafio é cumprido de propósito. */
    static final Map<String, List<CbcRules.Card>> GUARDA_ROUPA = Map.of(
            "SUP", List.of(peca("SUP", "shirt", "blue", "work", "cotton"), peca("SUP", "t_shirt", "white", "casual", "cotton"),
                    peca("SUP", "blouse", "red", "party", "silk"), peca("SUP", "sweater", "green", "casual", "wool"),
                    peca("SUP", "blazer", "black", "formal", "wool")),
            "INF", List.of(peca("INF", "jeans", "blue", "casual", "denim"), peca("INF", "tailored_pants", "black", "business", "wool"),
                    peca("INF", "skirt", "pink", "date", "satin"), peca("INF", "shorts", "white", "vacation", "linen"),
                    peca("INF", "cargo_pants", "green", "outdoor", "nylon")),
            "CAL", List.of(peca("CAL", "sneakers", "white", "sport", "mesh"), peca("CAL", "boots", "black", "casual", "leather"),
                    peca("CAL", "heels", "red", "party", "leather"), peca("CAL", "loafers", "brown", "work", "leather"),
                    peca("CAL", "sandals", "pink", "vacation", "rubber")),
            "ACE", List.of(peca("ACE", "handbag", "black", "formal", "leather"), peca("ACE", "cap", "blue", "sport", "polyester"),
                    peca("ACE", "scarf", "green", "casual", "wool"), peca("ACE", "necklace", "white", "wedding", "metal"),
                    peca("ACE", "sunglasses", "pink", "vacation", "polyester")));

    private BatalhaLooksAdversario() {
    }

    private static CbcRules.Card peca(String vaga, String sub, String cor, String ocasiao, String material) {
        UUID id = UUID.nameUUIDFromBytes(("batalha-casa:" + vaga + ":" + sub + ":" + cor).getBytes(StandardCharsets.UTF_8));
        return new CbcRules.Card(id, vaga, "BRONZE", 60, null, "CASA", Set.of(), Set.of(cor), Set.of(ocasiao), Set.of(material),
                Map.of(), null, null, null, sub);
    }

    /** O look do adversário na rodada: uma peça da casa por vaga, tirada da semente. */
    static Map<String, CbcRules.Card> look(Contexto contexto, int rodada) {
        Map<String, CbcRules.Card> out = new LinkedHashMap<>();
        for (String vaga : BatalhaLooksNucleo.VAGAS) {
            out.put(vaga, contexto.sortear("casa" + rodada + vaga, GUARDA_ROUPA.get(vaga)));
        }
        return out;
    }

    /** A nota do look da casa pelas regras do desafio, como a da pessoa. */
    static int nota(BatalhaLooksRodadas.Desafio desafio, Map<String, CbcRules.Card> look) {
        return (int) Math.round(BatalhaLooksRodadas.pontos(BatalhaLooksRodadas.regras(desafio, look)));
    }

    /** {nota, familia, look:{SUP:{subcategoria, familia}}}: o que a tela mostra e veste no figurante ADVERSARIO. */
    static Map<String, Object> paraTela(Map<String, CbcRules.Card> look, int nota) {
        Map<String, Object> pecas = new LinkedHashMap<>();
        look.forEach((vaga, c) -> pecas.put(vaga, Map.of("subcategoria", c.subcategory(), "familia", Flair3dPecas.familias(c).iterator().next())));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("nota", nota);
        m.put("familia", Flair3dPecas.maiorGrupo(look.values(), Flair3dPecas::familias).getKey());
        m.put("look", pecas);
        return m;
    }
}
